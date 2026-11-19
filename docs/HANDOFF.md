# Handoff — Swiss Liquidity (sfx-lp)

State as of 2026-11-19, branch `claude/friendly-noether-u03gym`. Read this first in a new session.

## Done
- **Phase 0–2**: repo isolated from Curreex/FXIncap/SuimFX; design system from Figma; screens
  01–18 (welcome → dashboard), History page, responsive phone/tablet/desktop, light theme.
- **Brand**: "Swiss Liquidity" / short "SLq", editable in Admin → Setup (`Branding.appName/shortName`).
- **Security**: deploy webhook gated, demo user dev-only, strong prod secrets, KYC + deposit proofs
  in `private_uploads` served only via `GET /api/files/private/:name` (owner/admin), secure cookies on HTTPS.
- **Curreex DB backup**: taken 2026-11-19 15:18 UTC with `scripts/ops/backup-curreex-db.sh`
  (encrypted copy in `/root/curreex-backups/` on the droplet + downloaded by the owner).
  ⚠ The backup password was exposed in chat — owner should re-run the backup with a new password.

## Deployment design (same droplet as Curreex, Curreex untouched)
- Droplet `curreex-prod` (DigitalOcean, blr1, 1 vCPU / 1 GB / 25 GB, Ubuntu 24.04, IP 168.144.73.76),
  swap 2 GB already present, Nginx with `sites-enabled/curreex.com.conf`. No DO firewall, no DO backups.
- **MongoDB is hosted (Atlas)**, not on the droplet. Swiss Liquidity uses the same cluster with its own
  database `sfxlp_staging` and its own user `sfxlp_app` (role `readWrite@sfxlp_staging` only).
- GitHub Actions is **locked (account billing)** → bundles are built locally with
  `scripts/ops/publish-bundle.sh staging`, which force-updates the artifact-only branch `deploy-staging`.
- Server: user `swissliq`, private Node 22 in `/home/swissliq/.node`, app in `/home/swissliq/app`
  (`releases/`, `current`, `shared/.env|uploads|private_uploads|backups`, `logs/`).
  systemd: `sfx-api` (port 5100, MemoryMax 300M), `sfx-web` (3100, 260M), `sfx-deploy.timer`
  (pulls deploy-staging every 2 min, checksum + health check + rollback), `sfx-backup.timer` (02:30 UTC).
  Temporary test site: Nginx `swissliq-test.conf` on :8080 → http://168.144.73.76:8080
- One-time setup: `scripts/ops/setup-swissliq.sh` (run as root; idempotent; never touches Curreex).

## Next steps (in order)
1. Create Atlas DB user `sfxlp_app` with `readWrite` on `sfxlp_staging` only
   (Atlas CLI: `atlas dbusers create readWrite@sfxlp_staging --username sfxlp_app --password <generated>`,
   after `atlas auth login`; pick the project Curreex uses).
2. Run setup on the droplet as root:
   `curl -fsSL https://raw.githubusercontent.com/lovusayani/sfx-lp/<commit>/scripts/ops/setup-swissliq.sh -o /root/setup-swissliq.sh && SFX_REF=<commit> bash /root/setup-swissliq.sh`
3. Verify: `systemctl is-active sfx-api sfx-web sfx-deploy.timer`, `tail /home/swissliq/app/logs/deploy.log`,
   open http://168.144.73.76:8080, confirm Curreex still answers (`curl -I -H 'Host: curreex.com' http://127.0.0.1/`).
4. Phase 3: redesign wallet, deposit, withdraw, brokerview/trade, performance, reports, notices,
   profile, settings, support, FAQ/about pages with `components/sfx/*`.
5. Domain + HTTPS (owner to provide domain and DNS provider), Resend email (sign-up, reset, OTP, 2FA),
   PWA manifest/service worker, admin redesign (later, owner to discuss).

## Rules agreed with the owner
- Never modify, restart or deploy to Curreex; never touch its database.
- No droplet upgrade for now. Ask before any change outside `/home/swissliq` and the new Nginx site.
- Secrets never in chat or git; generated on the server or entered in hidden prompts.
