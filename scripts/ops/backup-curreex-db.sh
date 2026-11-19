#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-off, READ-ONLY backup of the Curreex MongoDB database.
#
#   • Reads Curreex's database (mongodump). Never writes to it, never restarts it.
#   • Encrypts the backup with a password you choose (AES-256).
#   • Checks the backup is readable (mongorestore --dryRun, writes nothing).
#   • Prints a one-time download link (valid 30 minutes) so you can save the file
#     and upload it to Google Drive. The link stops working after one download.
#
# Run as root in the DigitalOcean Droplet Console:
#   bash backup-curreex-db.sh
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

BACKUP_DIR=/root/curreex-backups
STAMP=$(date -u +%Y-%m-%d_%H%M)
WORK=$(mktemp -d /root/.curreex-backup-XXXXXX)
RAW="$WORK/curreex-db-$STAMP.archive.gz"
ENC_NAME="curreex-db-$STAMP.archive.gz.enc"
ENC="$BACKUP_DIR/$ENC_NAME"
LINK_MINUTES=30
UFW_RULE_ADDED=""
PORT=""

say()  { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

cleanup() {
  rm -rf "$WORK"                                   # unencrypted copy never stays on disk
  if [[ -n "$UFW_RULE_ADDED" ]]; then ufw delete allow "$PORT/tcp" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

[[ $EUID -eq 0 ]] || fail "Please run as root (the DigitalOcean console logs you in as root)."

# ── 1. Tools ────────────────────────────────────────────────────────────────
say "Step 1/6 · Checking backup tools"
if ! command -v mongodump >/dev/null || ! command -v mongorestore >/dev/null; then
  echo "  mongodump not found — installing MongoDB Database Tools (does not touch MongoDB itself)…"
  if ! apt-get install -y mongodb-database-tools >/dev/null 2>&1; then
    DEB=/tmp/mongodb-database-tools.deb
    curl -fsSL -o "$DEB" "https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2404-x86_64-100.10.0.deb" \
      || fail "Could not download MongoDB Database Tools."
    apt-get install -y "$DEB" >/dev/null || fail "Could not install MongoDB Database Tools."
    rm -f "$DEB"
  fi
fi
command -v openssl >/dev/null || fail "openssl is missing."
command -v python3 >/dev/null || fail "python3 is missing."
ok "$(mongodump --version | head -1)"

# ── 2. Find Curreex's database connection (read from its .env, never printed) ──
say "Step 2/6 · Locating the Curreex database"
MONGO_URI=""
for f in /home/curreex/htdocs/curreex.com/server/.env $(find /home -maxdepth 6 -path '*curreex*' -name .env 2>/dev/null); do
  [[ -f "$f" ]] || continue
  line=$(grep -E '^[[:space:]]*MONGO_URI[[:space:]]*=' "$f" | tail -1 || true)
  if [[ -n "$line" ]]; then
    MONGO_URI=$(echo "${line#*=}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//')
    ok "Found connection settings in $f"
    break
  fi
done
if [[ -z "$MONGO_URI" ]]; then
  echo "  Could not find Curreex's MONGO_URI automatically."
  read -r -s -p "  Paste the MongoDB connection string (hidden), or press Enter for mongodb://127.0.0.1:27017: " MONGO_URI; echo
  MONGO_URI=${MONGO_URI:-mongodb://127.0.0.1:27017}
fi

# ── 3. Dump (read-only, low priority so Curreex keeps its CPU/disk) ──────────
say "Step 3/6 · Backing up the database (read-only)"
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
FREE_MB=$(df -Pm /root | awk 'NR==2{print $4}')
(( FREE_MB > 1024 )) || fail "Less than 1 GB free disk space; aborting to protect Curreex."
nice -n 15 ionice -c3 mongodump --uri="$MONGO_URI" --archive="$RAW" --gzip --quiet \
  || fail "mongodump failed. If MongoDB needs a login that isn't in Curreex's .env, re-run and paste the connection string when asked."
ok "Backup created ($(du -h "$RAW" | cut -f1))"

# ── 4. Verify the backup can be restored (dry run: writes nothing) ───────────
say "Step 4/6 · Verifying the backup"
mongorestore --archive="$RAW" --gzip --dryRun --quiet >/dev/null 2>&1 \
  || mongorestore --uri="$MONGO_URI" --archive="$RAW" --gzip --dryRun --quiet >/dev/null \
  || fail "Verification failed — the backup could not be read."
ok "Backup is readable and complete"

# ── 5. Encrypt ───────────────────────────────────────────────────────────────
say "Step 5/6 · Encrypting"
echo "  Choose a password for the backup file. Store it safely (e.g. a password manager)."
echo "  Without it the backup cannot be opened."
while true; do
  read -r -s -p "  Backup password (min 12 characters): " P1; echo
  read -r -s -p "  Repeat password: " P2; echo
  [[ "$P1" == "$P2" ]] || { echo "  Passwords did not match. Try again."; continue; }
  (( ${#P1} >= 12 )) || { echo "  Too short. Try again."; continue; }
  break
done
PASS="$P1" openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$RAW" -out "$ENC" -pass env:PASS
unset P1 P2
chmod 600 "$ENC"
SHA=$(sha256sum "$ENC" | cut -d' ' -f1)
ok "Encrypted file: $ENC ($(du -h "$ENC" | cut -f1))"
ok "SHA-256: $SHA"

# ── 6. One-time download link ────────────────────────────────────────────────
say "Step 6/6 · One-time download link"
TOKEN=$(openssl rand -hex 24)
PORT=$(( 20000 + RANDOM % 20000 ))
IP=$(curl -fsS --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null || hostname -I | awk '{print $1}')
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "$PORT/tcp" >/dev/null && UFW_RULE_ADDED=1   # removed automatically when this script ends
fi

cat <<EOF

  ┌───────────────────────────────────────────────────────────────────────┐
    Open this link on your computer or phone to download the backup:

      http://$IP:$PORT/$TOKEN/$ENC_NAME

    • Works once, for $LINK_MINUTES minutes. The file is encrypted, so it is
      safe even though the link is plain http.
    • Then upload the downloaded file to the client's Google Drive.
    • Keep this console open until the download finishes.
  └───────────────────────────────────────────────────────────────────────┘
EOF

FILE="$ENC" NAME="$ENC_NAME" TOKEN="$TOKEN" PORT="$PORT" MINUTES="$LINK_MINUTES" python3 - <<'PY'
import os, sys, threading, http.server, socketserver
path, name, token = os.environ["FILE"], os.environ["NAME"], os.environ["TOKEN"]
port, minutes = int(os.environ["PORT"]), int(os.environ["MINUTES"])
done = threading.Event()

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path != f"/{token}/{name}" or done.is_set():
            self.send_response(404); self.end_headers(); return
        size = os.path.getsize(path)
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Disposition", f'attachment; filename="{name}"')
        self.send_header("Content-Length", str(size))
        self.end_headers()
        try:
            with open(path, "rb") as f:
                while chunk := f.read(1 << 16):
                    self.wfile.write(chunk)
            done.set()
            print("\n  ✓ Download completed. Closing the link.", flush=True)
        except (BrokenPipeError, ConnectionResetError):
            print("\n  ! Download interrupted — the link still works, try again.", flush=True)

class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

srv = S(("0.0.0.0", port), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
if not done.wait(minutes * 60):
    print("\n  ! Link expired without a completed download.", flush=True)
srv.shutdown()
PY

cat <<EOF

  Finished.
  • Encrypted backup kept on the server: $ENC (root-only)
  • SHA-256 (to confirm the downloaded file is intact): $SHA
  • To restore later:  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in $ENC_NAME -out curreex.archive.gz
                       mongorestore --archive=curreex.archive.gz --gzip --uri="<target>"
  • Nothing in Curreex was changed.
EOF
