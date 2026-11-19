#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time server setup for Swiss Liquidity on the existing droplet (run as root).
# Curreex is never edited, stopped or restarted. Everything new lives under the
# separate Linux user "swissliq" (/home/swissliq), with hard memory limits.
#
#   1. Safety checks            5. Config (.env with generated secrets)
#   2. 2 GB swap (if none)      6. Services with memory caps + auto-deploy timer
#   3. User + private Node 22   7. Daily backups of the Swiss Liquidity data
#   4. Own MongoDB database     8. Temporary test address on port 8080
#
# Safe to re-run: existing config and passwords are kept.
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

U=swissliq
H=/home/$U
APP=$H/app
NODE_VERSION=22.12.0
CHANNEL=${SFX_CHANNEL:-staging}
DB_NAME=sfxlp_$CHANNEL
API_PORT=5100
WEB_PORT=3100
TEST_PORT=8080
REPO=lovusayani/sfx-lp
REF=${SFX_REF:-main}   # git commit/branch the setup files are taken from

say()  { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
note() { printf '  • %s\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
trap 'fail "Stopped at line $LINENO. Nothing in Curreex was changed. Send this screen to Claude."' ERR

[[ $EUID -eq 0 ]] || fail "Run as root."
IP=$(curl -fsS --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null || hostname -I | awk '{print $1}')

# ── 1. Safety checks ─────────────────────────────────────────────────────────
say "1/8 · Safety checks"
FREE_MB=$(df -Pm / | awk 'NR==2{print $4}')
(( FREE_MB > 4096 )) || fail "Less than 4 GB free disk; stopping to protect Curreex."
for p in $API_PORT $WEB_PORT $TEST_PORT; do
  ss -ltnH "sport = :$p" | grep -q . || continue
  # On a re-run these ports belong to our own services / test site; anything else is a conflict.
  if [[ $p == "$TEST_PORT" && -f /etc/nginx/sites-enabled/swissliq-test.conf ]]; then continue; fi
  if [[ $p != "$TEST_PORT" ]] && systemctl is-active --quiet sfx-api.service sfx-web.service 2>/dev/null; then continue; fi
  fail "Port $p is already in use by another program."
done
ok "Disk free: ${FREE_MB} MB · RAM: $(free -m | awk '/Mem:/{print $2}') MB · ports $API_PORT/$WEB_PORT free"
CURREEX_BEFORE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H 'Host: curreex.com' http://127.0.0.1/ || true)
note "Curreex responds with HTTP $CURREEX_BEFORE (checked again at the end)"

# ── 2. Swap ──────────────────────────────────────────────────────────────────
say "2/8 · Memory safety buffer (swap)"
if swapon --show | grep -q .; then
  ok "Swap already present ($(free -m | awk '/Swap:/{print $2}') MB) — left as is"
else
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10' > /etc/sysctl.d/90-swissliq-swap.conf && sysctl -q -p /etc/sysctl.d/90-swissliq-swap.conf
  ok "2 GB swap added (used only under memory pressure)"
fi

# ── 3. User + private Node.js ────────────────────────────────────────────────
say "3/8 · Separate user and private Node.js"
id "$U" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$U"
passwd -l "$U" >/dev/null 2>&1 || true            # no password logins
chmod 750 "$H"
mkdir -p "$APP"/{releases,shared/uploads,shared/private_uploads,shared/backups,state,bin,logs}
if [[ ! -x $H/.node/bin/node ]] || [[ "$($H/.node/bin/node -v)" != "v$NODE_VERSION" ]]; then
  T=$(mktemp -d); cd "$T"
  curl -fsSLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz"
  curl -fsSLO "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
  grep " node-v$NODE_VERSION-linux-x64.tar.xz\$" SHASUMS256.txt | sha256sum -c --quiet
  rm -rf "$H/.node" && mkdir -p "$H/.node" && tar -xJf "node-v$NODE_VERSION-linux-x64.tar.xz" -C "$H/.node" --strip-components=1
  cd / && rm -rf "$T"
fi
chown -R "$U:$U" "$H"
chmod 700 "$APP/shared/private_uploads" "$APP/shared/backups"
ok "User $U ready · Node $($H/.node/bin/node -v) (private to $U; Curreex's Node untouched)"

# ── 4. Database ──────────────────────────────────────────────────────────────
say "4/8 · Own database ($DB_NAME)"
ENV_FILE=$APP/shared/.env
if [[ -f $ENV_FILE ]] && grep -q '^MONGO_URI=' "$ENV_FILE"; then
  ok "Database already configured — keeping it"
else
  if ! ss -ltnH 'sport = :27017' | grep -q .; then
    echo "  MongoDB is not running on this server (Curreex may use a hosted database)."
    read -r -s -p "  Paste a MongoDB connection string for Swiss Liquidity (hidden): " SFX_MONGO_URI; echo
    [[ -n "$SFX_MONGO_URI" ]] || fail "A database connection is required."
  else
    DB_PASS=$(openssl rand -hex 24)
    T=$(mktemp -d); chown "$U:$U" "$T"
    sudo -u "$U" bash -c "cd '$T' && PATH='$H/.node/bin:\$PATH' npm init -y >/dev/null && PATH='$H/.node/bin:\$PATH' npm i --silent mongodb@6 >/dev/null"
    cat > "$T/mk.js" <<'JS'
const { MongoClient } = require("mongodb");
(async () => {
  const uri = process.env.ADMIN_URI || "mongodb://127.0.0.1:27017";
  const c = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await c.db("admin").command({ listDatabases: 1, nameOnly: true });
  } catch (e) { if (/auth|Unauthorized|requires authentication/i.test(e.message)) { console.log("NEEDS_AUTH"); process.exit(3); } throw e; }
  const db = c.db(process.env.DB);
  const exists = (await db.command({ usersInfo: "sfxlp_app" })).users.length > 0;
  const roles = [{ role: "readWrite", db: process.env.DB }];
  if (exists) await db.command({ updateUser: "sfxlp_app", pwd: process.env.PW, roles });
  else await db.command({ createUser: "sfxlp_app", pwd: process.env.PW, roles });
  const auth = (await c.db("admin").command({ getCmdLineOpts: 1 }).catch(() => ({ parsed: {} }))).parsed?.security?.authorization;
  console.log(auth === "enabled" ? "AUTH_ON" : "AUTH_OFF");
  await c.close();
})().catch((e) => { console.error("DB_ERROR", e.message); process.exit(2); });
JS
    trap - ERR; set +e
    RES=$(cd "$T" && DB=$DB_NAME PW=$DB_PASS "$H/.node/bin/node" mk.js 2>&1); RC=$?
    if [[ $RC -eq 3 ]]; then
      echo "  MongoDB requires an administrator login to create the new database user."
      read -r -s -p "  Paste a MongoDB admin connection string (hidden, used once, not saved): " ADMIN_URI; echo
      RES=$(cd "$T" && ADMIN_URI=$ADMIN_URI DB=$DB_NAME PW=$DB_PASS "$H/.node/bin/node" mk.js 2>&1); RC=$?
      unset ADMIN_URI
    fi
    set -e; trap 'fail "Stopped at line $LINENO. Nothing in Curreex was changed. Send this screen to Claude."' ERR
    rm -rf "$T"
    [[ $RC -eq 0 ]] || fail "Could not create the database user: $RES"
    SFX_MONGO_URI="mongodb://sfxlp_app:$DB_PASS@127.0.0.1:27017/$DB_NAME?authSource=$DB_NAME"
    ok "Database $DB_NAME with its own user sfxlp_app (read/write on $DB_NAME only)"
    [[ "$RES" == *AUTH_OFF* ]] && note "Note: MongoDB password checks are OFF server-wide (Curreex's setting). The new user is ready for when they are turned on; not changed now to avoid affecting Curreex."
  fi
fi

# ── 5. Config ────────────────────────────────────────────────────────────────
say "5/8 · Configuration"
ADMIN_PASSWORD=""
if [[ ! -f $ENV_FILE ]]; then
  read -r -p "  Admin login email for Swiss Liquidity [admin@swissliquidity.com]: " ADMIN_EMAIL
  ADMIN_EMAIL=${ADMIN_EMAIL:-admin@swissliquidity.com}
  ADMIN_PASSWORD="Sl-$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-18)!9"
  umask 077
  cat > "$ENV_FILE" <<EOF
APP_ENV=$CHANNEL
NODE_ENV=production
PORT=$API_PORT
MONGO_URI=$SFX_MONGO_URI
CLIENT_URL=http://$IP:$TEST_PORT
CLIENT_URLS=
COOKIE_SECURE=false
JWT_ACCESS_SECRET=$(openssl rand -hex 48)
JWT_REFRESH_SECRET=$(openssl rand -hex 48)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
UPLOAD_DIR=uploads
PRIVATE_UPLOAD_DIR=private_uploads
MAX_FILE_SIZE_MB=10
ADMIN_NAME=Swiss Liquidity Admin
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TRADES_API_BASE_URL=
TRADES_API_KEY=
DEPLOY_WEBHOOK_SECRET=
EOF
  umask 022
  ok "Created $ENV_FILE with freshly generated secrets (readable only by $U)"
else
  ok "Keeping existing $ENV_FILE"
fi
chown "$U:$U" "$ENV_FILE" && chmod 600 "$ENV_FILE"

# ── 6. Services + auto-deploy ────────────────────────────────────────────────
say "6/8 · Services (memory-capped) and auto-deploy"
cat > /etc/systemd/system/sfx-api.service <<EOF
[Unit]
Description=Swiss Liquidity API
After=network.target
ConditionPathExists=$APP/current

[Service]
User=$U
WorkingDirectory=$APP/shared
Environment=NODE_ENV=production
ExecStart=$H/.node/bin/node --max-old-space-size=192 $APP/current/server/dist/server.js
Restart=always
RestartSec=5
MemoryHigh=230M
MemoryMax=300M
CPUQuota=60%
Nice=5
NoNewPrivileges=true
ProtectSystem=full
StandardOutput=append:$APP/logs/api.log
StandardError=append:$APP/logs/api.log

[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/sfx-web.service <<EOF
[Unit]
Description=Swiss Liquidity web app
After=network.target sfx-api.service
ConditionPathExists=$APP/current

[Service]
User=$U
WorkingDirectory=$APP/current/web
Environment=NODE_ENV=production PORT=$WEB_PORT HOSTNAME=127.0.0.1 NEXT_TELEMETRY_DISABLED=1
ExecStart=$H/.node/bin/node --max-old-space-size=160 server.js
Restart=always
RestartSec=5
MemoryHigh=200M
MemoryMax=260M
CPUQuota=60%
Nice=5
NoNewPrivileges=true
ProtectSystem=full
StandardOutput=append:$APP/logs/web.log
StandardError=append:$APP/logs/web.log

[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/sfx-deploy.service <<EOF
[Unit]
Description=Swiss Liquidity pull-deploy
After=network-online.target

[Service]
Type=oneshot
User=$U
Environment=SFX_CHANNEL=$CHANNEL SFX_REPO=$REPO PATH=$H/.node/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$APP/bin/swissliq-deploy.sh
StandardOutput=append:$APP/logs/deploy.log
StandardError=append:$APP/logs/deploy.log
EOF
cat > /etc/systemd/system/sfx-deploy.timer <<EOF
[Unit]
Description=Check for new Swiss Liquidity builds every 2 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
EOF
echo "$U ALL=(root) NOPASSWD: /usr/bin/systemctl restart sfx-api.service sfx-web.service" > /etc/sudoers.d/swissliq
chmod 440 /etc/sudoers.d/swissliq && visudo -cq -f /etc/sudoers.d/swissliq
curl -fsSL "https://raw.githubusercontent.com/$REPO/$REF/scripts/ops/swissliq-deploy.sh" -o "$APP/bin/swissliq-deploy.sh" \
  || fail "Could not download the deploy agent."
chown "$U:$U" "$APP/bin/swissliq-deploy.sh" && chmod 750 "$APP/bin/swissliq-deploy.sh"
cat > /etc/logrotate.d/swissliq <<EOF
$APP/logs/*.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
systemctl daemon-reload
systemctl enable sfx-api.service sfx-web.service sfx-deploy.timer >/dev/null 2>&1
ok "Services installed: sfx-api (≤300 MB), sfx-web (≤260 MB), auto-deploy every 2 min"

# ── 7. Daily backups ─────────────────────────────────────────────────────────
say "7/8 · Daily backups"
cat > "$APP/bin/backup.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APP=/home/swissliq/app
URI=$(grep '^MONGO_URI=' "$APP/shared/.env" | cut -d= -f2-)
D=$(date -u +%F)
nice -n 15 mongodump --uri="$URI" --archive="$APP/shared/backups/db-$D.archive.gz" --gzip --quiet
tar -C "$APP/shared" -czf "$APP/shared/backups/files-$D.tar.gz" private_uploads uploads
find "$APP/shared/backups" -type f -mtime +14 -delete
EOF
chown "$U:$U" "$APP/bin/backup.sh" && chmod 750 "$APP/bin/backup.sh"
cat > /etc/systemd/system/sfx-backup.service <<EOF
[Unit]
Description=Swiss Liquidity daily backup
[Service]
Type=oneshot
User=$U
Nice=15
ExecStart=$APP/bin/backup.sh
EOF
cat > /etc/systemd/system/sfx-backup.timer <<EOF
[Unit]
Description=Swiss Liquidity daily backup (02:30 UTC)
[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload && systemctl enable --now sfx-backup.timer >/dev/null 2>&1
command -v mongodump >/dev/null && ok "Daily backups at 02:30 UTC, kept 14 days" || note "mongodump not found — backups will start once MongoDB tools are installed"

# ── 8. Temporary test address (until the domain + HTTPS are ready) ───────────
say "8/8 · Temporary test address http://$IP:$TEST_PORT"
if command -v nginx >/dev/null && [[ -d /etc/nginx/sites-enabled ]]; then
  cat > /etc/nginx/sites-available/swissliq-test.conf <<EOF
# Swiss Liquidity temporary test address. Replaced by the real domain + HTTPS later.
server {
  listen $TEST_PORT;
  server_name _;
  client_max_body_size 12m;
  location /api/     { proxy_pass http://127.0.0.1:$API_PORT; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; }
  location /uploads/ { proxy_pass http://127.0.0.1:$API_PORT; }
  location /         { proxy_pass http://127.0.0.1:$WEB_PORT; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; }
}
EOF
  ln -sfn /etc/nginx/sites-available/swissliq-test.conf /etc/nginx/sites-enabled/swissliq-test.conf
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx && ok "Nginx: new site added and reloaded (Curreex config untouched)"
  else
    rm -f /etc/nginx/sites-enabled/swissliq-test.conf
    note "Nginx config test failed — new site removed again, nothing reloaded"
  fi
  if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow $TEST_PORT/tcp >/dev/null && ok "Firewall: port $TEST_PORT opened"; fi
else
  note "Nginx with sites-enabled not found — test address skipped (tell Claude which web server Curreex uses)"
fi

# ── First deploy ─────────────────────────────────────────────────────────────
say "First deploy"
if sudo -u "$U" env SFX_CHANNEL=$CHANNEL SFX_REPO=$REPO PATH="$H/.node/bin:/usr/local/bin:/usr/bin:/bin" "$APP/bin/swissliq-deploy.sh"; then
  if [[ -f "$APP/state/deployed.version" ]]; then
    ok "Running version $(cat "$APP/state/deployed.version")"
  else
    note "No build published on GitHub yet — the server checks every 2 minutes and deploys automatically once one appears."
  fi
else
  note "First deploy did not finish — see $APP/logs/api.log and web.log"
fi
systemctl start sfx-deploy.timer

CURREEX_AFTER=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H 'Host: curreex.com' http://127.0.0.1/ || true)
trap - ERR
cat <<EOF

  ════════════════════════════════════════════════════════════════════
   Swiss Liquidity setup finished
   • Test address:   http://$IP:$TEST_PORT
   • Admin panel:    http://$IP:$TEST_PORT/admin/login
EOF
if [[ -n "$ADMIN_PASSWORD" ]]; then cat <<EOF
   • Admin email:    $(grep '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2-)
   • Admin password: $ADMIN_PASSWORD
     (shown ONCE — save it in a password manager, do NOT paste it in chat)
EOF
fi
cat <<EOF
   • Curreex HTTP status before / after: $CURREEX_BEFORE / $CURREEX_AFTER
   • Memory now: $(free -m | awk '/Mem:/{print $3" MB used of "$2" MB"}'), swap $(free -m | awk '/Swap:/{print $3" MB used"}')
  ════════════════════════════════════════════════════════════════════
EOF
