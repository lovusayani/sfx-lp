#!/usr/bin/env bash
# Build the Swiss Liquidity bundle locally and publish it to branch "deploy-<channel>"
# (a single-commit branch holding only the latest bundle). Used while GitHub Actions
# is unavailable; the server's deploy agent picks it up within ~2 minutes.
#   scripts/ops/publish-bundle.sh [staging|production]
set -Eeuo pipefail

CHANNEL=${1:-staging}
ROOT=$(git rev-parse --show-toplevel)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"; git -C "$ROOT" worktree prune' EXIT

cd "$ROOT"
[[ -z "$(git status --porcelain -- server client scripts)" ]] || { echo "Commit your changes first."; exit 1; }
COMMIT=$(git rev-parse HEAD)
VERSION="$(date -u +%Y%m%d%H%M)-${COMMIT::7}"

echo "▶ Building API"
(cd server && npm ci --no-audit --no-fund >/dev/null && npm run build >/dev/null && npm prune --omit=dev >/dev/null)
echo "▶ Building web app"
(cd client && npm ci --no-audit --no-fund >/dev/null && npx tsc --noEmit && NEXT_TELEMETRY_DISABLED=1 npx next build >/dev/null)

echo "▶ Assembling bundle $VERSION"
B="$WORK/bundle/sfx-lp"
mkdir -p "$B/server" "$B/web" "$B/ops"
cp -r server/dist server/node_modules server/package.json "$B/server/"
cp -r client/.next/standalone/. "$B/web/"
cp -r client/.next/static "$B/web/.next/static"
cp -r client/public "$B/web/public"
cp scripts/ops/swissliq-deploy.sh "$B/ops/"
# Windows checkouts add CRLF; a CRLF shebang breaks the deploy agent on Linux.
sed -i 's/\r$//' "$B"/ops/*.sh
echo "$VERSION" > "$B/VERSION"
echo "$COMMIT" > "$B/COMMIT"
tar -C "$WORK/bundle" -czf "$WORK/sfx-lp.tar.gz" sfx-lp
SUM=$(sha256sum "$WORK/sfx-lp.tar.gz" | cut -d' ' -f1)

echo "▶ Publishing to branch deploy-$CHANNEL"
git worktree add --detach "$WORK/wt" >/dev/null 2>&1
cd "$WORK/wt"
git checkout --orphan "tmp-deploy-$CHANNEL" >/dev/null 2>&1
git rm -rfq . >/dev/null 2>&1 || true
cp "$WORK/sfx-lp.tar.gz" .
echo "$SUM" > sfx-lp.tar.gz.sha256
echo "$VERSION" > VERSION
printf '# deploy-%s\n\nBuild artifact only (latest %s bundle from %s). Do not merge.\n' "$CHANNEL" "$CHANNEL" "$COMMIT" > README.md
git add -A
git commit -qm "Bundle $VERSION ($CHANNEL) from $COMMIT"
for i in 1 2 3 4; do
  git push -q --force origin "HEAD:refs/heads/deploy-$CHANNEL" && break
  sleep $((2 ** i))
done
git checkout -q --detach && git branch -D "tmp-deploy-$CHANNEL" >/dev/null

cd "$ROOT/server" && npm install --no-audit --no-fund >/dev/null   # restore dev deps locally
echo "✓ Published $VERSION ($(du -h "$WORK/sfx-lp.tar.gz" | cut -f1), sha256 $SUM)"
