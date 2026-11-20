# Handoff — Swiss Liquidity (sfx-lp)

State as of 2026-11-20 (session closed), branch `claude/friendly-noether-u03gym`. Read this first in a new session.

## Done
- **Phase 0–2**: repo isolated from Curreex/FXIncap/SuimFX; design system from Figma; screens
  01–18 (welcome → dashboard), History page, responsive phone/tablet/desktop, light theme.
- **Brand**: "Swiss Liquidity" / short "SLq", editable in Admin → Settings → Branding (`Branding.appName/shortName`).
- **Security**: deploy webhook gated, demo user dev-only, strong prod secrets, KYC + deposit proofs
  in `private_uploads` served only via `GET /api/files/private/:name` (owner/admin), secure cookies on HTTPS.
- **Curreex DB backup**: taken 2026-11-19 15:18 UTC with `scripts/ops/backup-curreex-db.sh`
  (encrypted copy in `/root/curreex-backups/` on the droplet + downloaded by the owner).
  ⚠ The backup password was exposed in chat — owner should re-run the backup with a new password.
- **Phase 3 (2026-11-19, live as `202611191653-10627d1`)**: wallet (transfer sheet), deposit (3-step +
  proof), withdraw (payout wallet sheet), trade overview + open/closed positions (now inside AppShell;
  legacy `design/brokerview/*` and `TopbarPageFrame` are no longer used by the user app), performance,
  reports, KYC documents, notices, settings, support/help/about/FAQ. Shared pieces in
  `components/sfx/kit.tsx`, `trade.tsx`, `ContentPage.tsx`. API no longer falls back to demo deposit
  addresses — admin must set each network's address in Admin → Settings → Deposit wallets or that network is disabled.
- **Staging first went LIVE (2026-11-19 16:31 UTC)**: bundle `202611191600-0a39249` on http://168.144.73.76:8080
  (`/welcome`, `/admin/login` → 200; `/api/health` → ok). All 4 units active, 0 restarts.
  Curreex HTTP status unchanged (301 before/after). RAM used ~590/961 MB, swap ~200 MB;
  sfx-api ~75 MB, sfx-web ~55 MB. Admin login `admin@swissliquidity.com`; password only in the server
  `.env` (`ADMIN_PASSWORD=`, readable by root/swissliq) and in a private file on the owner's PC.
- **Admin rebuilt (2026-11-19, Aurum admin designs in `docs/designs/admin/*.zip`)**: the old
  LMAX-era admin UI is gone. Sections: Overview, Users (wallet adjust, lock-in, password, push),
  KYC Reviews, Deposits, Withdrawals (+ payout wallets), Trading (order report, trade results =
  old prof-loss, charges, API sources), Reports (P&L PDFs), Support (Support/FAQ/Help/About content),
  Notices (+ optional push), Settings (branding, deposit wallets, data export/reset). Shared UI in
  `client/components/admin/ui.tsx`; old URLs redirect via `next.config.ts`. No support-ticket or
  audit-log API exists yet, so those parts of the design are not built.
- **Email via Resend (2026-11-19)**: sign-up with emailed 6-digit code (unconfirmed accounts can't
  sign in), forgot/reset password (single-use 30-min link to `CLIENT_URL/reset-password`), optional
  emailed code at every sign-in (Security screen / Settings toggle). Server env `RESEND_API_KEY`,
  `EMAIL_FROM` (staging: `onboarding@resend.dev`, which only delivers to the Resend account owner's
  inbox — verify a domain in Resend and change `EMAIL_FROM` before real users). Key kept in the server
  `.env` and in a private file on the owner's PC only.
- Deploy agent self-updates from each bundle; `publish-bundle.sh` strips CRLF from `ops/*.sh`
  (a Windows-built bundle once broke it with a CRLF shebang).

## Domains (2026-11-20)
- **https://app.swissconnector.com** (client app) and **https://adm.swissconnector.com** (admin; `/` → `/admin`,
  `app…/admin*` → adm). Cloudflare zone `swissconnector.com`, proxied A records → 168.144.73.76.
  Zone SSL mode left at "Full" and "Always Use HTTPS" left off because the apex `swissconnector.com`
  (2.57.91.91, not ours) shares the zone; our Nginx redirects HTTP→HTTPS itself.
- Origin TLS: Cloudflare Origin CA cert (app + adm, expires 2041-11-16) in `/home/swissliq/ssl/`
  (key root-only, 600). The private key was generated on the owner's PC (`C:/Users/sprsr/.sfxlp/ssl/`).
- Nginx site `/etc/nginx/sites-available/swissliq.conf` (source: `scripts/ops/nginx/swissliq.conf`),
  not default_server; real client IP from `CF-Connecting-IP`. Curreex unchanged (301 / https 200).
- `shared/.env`: `CLIENT_URL=https://app.swissconnector.com`, `CLIENT_URLS=https://adm.swissconnector.com`,
  `COOKIE_SECURE=true` (previous file kept as `.env.bak-*`).
- Test port :8080 closed (Nginx `swissliq-test.conf` disabled, ufw rule removed).
- Cloudflare API token (zone-scoped: DNS, SSL and Certificates, Zone Settings) is in the owner's
  `C:/Users/sprsr/.sfxlp/cloudflare.token.txt`; delete it in Cloudflare when no longer needed.

## Live on staging now
- Release `202611191815-33d0586` (admin rebuild + onboarding design fix + Resend email), deployed
  2026-11-19 18:29 UTC. `sfx-api`/`sfx-web` active, `/api/health` 200, Curreex 301 (unchanged).
- Owner still to test end to end: sign-up code, forgot password link, sign-in code (only the Resend
  account owner's Gmail receives mail until a domain is verified). The new admin hasn't been checked
  in a browser yet; first full run of real email is the owner's test.
- Updated app designs (`docs/designs/app/*.zip`: Welcome, Onboarding 2–3, Sign in, Create account)
  were compared with the app; only onboarding 2–3 differed and is fixed.

## Deployment design (same droplet as Curreex, Curreex untouched)
- Droplet `curreex-prod` (DigitalOcean, blr1, 1 vCPU / 1 GB / 25 GB, Ubuntu 24.04, IP 168.144.73.76),
  swap 2 GB already present, Nginx with `sites-enabled/curreex.com.conf`. No DO firewall, no DO backups.
- **MongoDB is hosted (Atlas)**, not on the droplet, and **separate from Curreex**: Atlas account
  tradeauto474 → org "Swiss@2026" → "Project 0" → free **M0 cluster `sfxlp`** (AWS Mumbai,
  host `sfxlp.xn0ylew.mongodb.net`). DB `sfxlp_staging`, user `sfxlp_app` (role `readWrite@sfxlp_staging`
  only). Network Access: 168.144.73.76/32 only. (Curreex's cluster `lmax1.kg4yh0f` lives in a different
  Atlas account and is not used.) M0 limits: 512 MB storage, shared CPU — upgrade before real users.
- Setup takes `SFX_MONGO_HOST=<host>` to point at a cluster other than Curreex's.
- Setup also ran `ufw allow 8080/tcp` (ufw is active on the droplet); remove when the test port goes away.
- Local publishing from Windows: push as GitHub account `lovusayani` (the default gh account
  `srsinfoacademy` has no write access). Bundles built on Windows ship Windows `node_modules`; the app
  has no native deps today, but re-check before adding any (bcrypt, sharp…).
- GitHub Actions is **locked (account billing)** → bundles are built locally with
  `scripts/ops/publish-bundle.sh staging`, which force-updates the artifact-only branch `deploy-staging`.
- Server: user `swissliq`, private Node 22 in `/home/swissliq/.node`, app in `/home/swissliq/app`
  (`releases/`, `current`, `shared/.env|uploads|private_uploads|backups`, `logs/`).
  systemd: `sfx-api` (port 5100, MemoryMax 300M), `sfx-web` (3100, 260M), `sfx-deploy.timer`
  (pulls deploy-staging every 2 min, checksum + health check + rollback), `sfx-backup.timer` (02:30 UTC).
  Temporary test site: Nginx `swissliq-test.conf` on :8080 → http://168.144.73.76:8080
- One-time setup: `scripts/ops/setup-swissliq.sh` (run as root; idempotent; never touches Curreex).

## Next steps (in order)
1. Owner tests email + new admin on staging and reports issues. Then remove the unused legacy UI (`design/`, old dashboard
   components). Publish with `scripts/ops/publish-bundle.sh staging` (agent deploys within ~2 min).
   Windows bundles include `sharp-win32` (unused: no next/image) — harmless.
2. Domain + HTTPS — done (see Domains).
3. Verify a sending domain in Resend and set `EMAIL_FROM=Name <no-reply@domain>` in `shared/.env`.
4. PWA manifest/service worker. Optional: support tickets + admin audit log (needs new API).

## Rules agreed with the owner
- Never modify, restart or deploy to Curreex; never touch its database.
- No droplet upgrade for now. Ask before any change outside `/home/swissliq` and the new Nginx site.
- Secrets never in chat or git; generated on the server or entered in hidden prompts.
