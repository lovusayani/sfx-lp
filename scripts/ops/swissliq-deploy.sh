#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Swiss Liquidity pull-deploy agent. Runs as user "swissliq" from a systemd timer.
#   1. Looks at the GitHub release "<channel>-latest" (built by GitHub Actions).
#   2. If it is new: downloads it, verifies the SHA-256, unpacks it.
#   3. Switches the "current" symlink, restarts sfx-api / sfx-web.
#   4. Health-checks both; on failure switches back to the previous release.
# Touches only /home/swissliq. Needs no GitHub credentials (public releases).
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

APP=/home/swissliq/app
REPO="${SFX_REPO:-lovusayani/sfx-lp}"
CHANNEL="${SFX_CHANNEL:-staging}"
STATE="$APP/state"
KEEP=3
API_HEALTH="http://127.0.0.1:${SFX_API_PORT:-5100}/api/health"
WEB_HEALTH="http://127.0.0.1:${SFX_WEB_PORT:-3100}/welcome"

log() { echo "[$(date -u +%FT%TZ)] $*"; }

mkdir -p "$STATE" "$APP/releases"
exec 9>"$STATE/deploy.lock"
flock -n 9 || { log "another deploy is running"; exit 0; }

# Where builds come from:
#   branch  (default) — branch "deploy-<channel>" holds the latest bundle (built outside GitHub Actions)
#   release           — GitHub release "<channel>-latest" (built by GitHub Actions)
SOURCE="${SFX_SOURCE:-branch}"
if [[ "$SOURCE" == "release" ]]; then
  meta=$(curl -fsSL --max-time 20 -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/releases/tags/$CHANNEL-latest") || { log "no release yet"; exit 0; }
  read -r TAR_URL SHA_URL < <(python3 -c '
import json,sys
a={x["name"]:x["browser_download_url"] for x in json.load(sys.stdin).get("assets",[])}
print(a.get("sfx-lp.tar.gz",""), a.get("sfx-lp.tar.gz.sha256",""))' <<<"$meta")
else
  # Resolve the branch to an exact commit so CDN caching can never serve a stale file.
  COMMIT=$(curl -fsSL --max-time 20 -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/commits/deploy-$CHANNEL" | python3 -c 'import json,sys;print(json.load(sys.stdin)["sha"])') \
    || { log "no deploy-$CHANNEL branch yet"; exit 0; }
  [[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { log "could not resolve deploy-$CHANNEL"; exit 0; }
  TAR_URL="https://raw.githubusercontent.com/$REPO/$COMMIT/sfx-lp.tar.gz"
  SHA_URL="https://raw.githubusercontent.com/$REPO/$COMMIT/sfx-lp.tar.gz.sha256"
fi
[[ -n "$TAR_URL" && -n "$SHA_URL" ]] || { log "no bundle published yet"; exit 0; }

WANT=$(curl -fsSL --max-time 20 "$SHA_URL" | tr -d '[:space:]')
[[ "$WANT" =~ ^[0-9a-f]{64}$ ]] || { log "bad checksum file"; exit 1; }
[[ "$WANT" == "$(cat "$STATE/deployed.sha256" 2>/dev/null)" ]] && exit 0
[[ "$WANT" == "$(cat "$STATE/failed.sha256" 2>/dev/null)" ]] && exit 0   # don't retry a known-bad build

TMP=$(mktemp -d "$APP/releases/.incoming-XXXXXX")
trap 'rm -rf "$TMP"' EXIT
log "new build found, downloading"
curl -fsSL --max-time 600 -o "$TMP/b.tar.gz" "$TAR_URL"
GOT=$(sha256sum "$TMP/b.tar.gz" | cut -d' ' -f1)
[[ "$GOT" == "$WANT" ]] || { log "checksum mismatch — refusing to deploy"; exit 1; }

tar -xzf "$TMP/b.tar.gz" -C "$TMP"
VERSION=$(tr -cd 'A-Za-z0-9._-' < "$TMP/sfx-lp/VERSION")
[[ -n "$VERSION" ]] || { log "bundle has no VERSION"; exit 1; }
NEW="$APP/releases/$VERSION"
rm -rf "$NEW"; mv "$TMP/sfx-lp" "$NEW"

PREV=$(readlink -f "$APP/current" 2>/dev/null || true)
switch_to() { ln -sfn "$1" "$APP/current.tmp" && mv -Tf "$APP/current.tmp" "$APP/current"; }
restart() { sudo -n /usr/bin/systemctl restart sfx-api.service sfx-web.service; }
healthy() {
  for _ in $(seq 1 45); do
    if curl -fsS --max-time 3 "$API_HEALTH" >/dev/null && curl -fsS --max-time 5 -o /dev/null "$WEB_HEALTH"; then return 0; fi
    sleep 2
  done
  return 1
}

log "deploying $VERSION"
switch_to "$NEW"
restart || true
if healthy; then
  echo "$WANT" > "$STATE/deployed.sha256"
  echo "$VERSION" > "$STATE/deployed.version"
  install -m 750 "$NEW/ops/swissliq-deploy.sh" "$APP/bin/swissliq-deploy.sh" 2>/dev/null || true
  ls -1dt "$APP"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
  log "deployed $VERSION ✓"
else
  log "health check FAILED for $VERSION — rolling back"
  echo "$WANT" > "$STATE/failed.sha256"
  if [[ -n "$PREV" && -d "$PREV" ]]; then switch_to "$PREV"; restart || true; healthy && log "rolled back to $(basename "$PREV") ✓"; fi
  exit 1
fi
