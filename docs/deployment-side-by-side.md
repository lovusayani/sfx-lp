# Running Swiss Liquidity next to Curreex on one server

Goal: both apps on the same machine and the same MongoDB server, fully isolated.
Nothing belonging to Curreex is edited, restarted or reused.

| Item | Curreex (unchanged) | Swiss Liquidity (new) |
|---|---|---|
| Code folder | `/home/curreex/htdocs/curreex.com` | `/var/www/swissliquidity` (own Linux user `swissliq`) |
| PM2 apps | `curreex-server`, `curreex-client` | `sfx-lp-api`, `sfx-lp-web` (PM2 under user `swissliq`) |
| Ports | 5000 (API), 3001 (web) | **5100** (API), **3100** (web) — bound to 127.0.0.1 only |
| Domain | curreex.com | e.g. `app.swissliquidity.com` (own Nginx server block) |
| HTTPS | existing cert | new Let's Encrypt cert for the new domain |
| Database | Curreex database | **new database** `sfxlp_prod` (+ `sfxlp_staging`) |
| DB user | Curreex user | **new user** with `readWrite` on `sfxlp_*` only |
| Uploads | Curreex uploads | `/var/www/swissliquidity/server/uploads` + `private_uploads` |
| Secrets | Curreex `.env` | own `server/.env` (chmod 600, owner `swissliq`) |
| Firebase / Resend / Telegram | Curreex keys | new, separate keys |

## Database isolation

Same MongoDB server, different database and a user that can only touch it:

```js
use admin
db.createUser({
  user: "sfxlp_app",
  pwd: "<generated>",
  roles: [{ role: "readWrite", db: "sfxlp_prod" }, { role: "readWrite", db: "sfxlp_staging" }]
})
```

`MONGO_URI=mongodb://sfxlp_app:<pwd>@127.0.0.1:27017/sfxlp_prod?authSource=admin`

If MongoDB currently runs **without authentication**, enabling it would affect Curreex,
so that change is only made with the owner's explicit approval and a maintenance window.

## Nginx (new file, Curreex config untouched)

```nginx
server {
  server_name app.swissliquidity.com;
  client_max_body_size 12m;
  location /api/ { proxy_pass http://127.0.0.1:5100; proxy_set_header Host $host;
                   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                   proxy_set_header X-Forwarded-Proto $scheme; }
  location /uploads/ { proxy_pass http://127.0.0.1:5100; }
  location / { proxy_pass http://127.0.0.1:3100; proxy_set_header Host $host; }
}
```

Validate with `nginx -t` before `systemctl reload nginx` (reload, never restart).

## Backups

Nightly `mongodump --db sfxlp_prod` + `private_uploads/` tarball, encrypted, kept 14 days
locally and copied off-server (bucket of your choice).
