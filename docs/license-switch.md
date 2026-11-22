# Licence switch ("API Payment Pending")

Vendor-controlled lock, switched from a Google Sheet. Server-enforced.

## While LOCKED
- Admin: Settings → Deposit wallets (tab), Trading → Charges, Trading → API sources show a non-closable
  "API Payment Pending" notice (with a "Back" link to leave the page); their API routes return 402
  (`/api/admin/payment-setup|api-sources|charge-settings`, and DELETE `/api/admin/order-charges`).
  Order report (GET order charges) and every other admin section keep working.
- App: only ONE LP account can use the app — the first to sign in after the lock. Any other LP sees the notice.
- Broker view shows the notice for everyone; `/api/trades` returns 402.
- Everything else (other admin pages, dashboard, wallets, deposits, withdrawals for the seated user) works.
- "Pay now" → `/license/pay`: QR (`client/public/license/qr.png` or the sheet's `qr_url`), amount, pay-to, reference.

## Sheet
Header row: `app | locked | amount | currency | pay_to | pay_name | note | qr_url`, one row with `app = swissliquidity`.
Leave `amount` empty to let the client enter any amount: the payment page then builds a UPI QR / UPI app link
(`upi://pay?pa=<pay_to>&am=<amount>&cu=INR&tn=<reference>`) when `pay_to` is a UPI ID and currency is INR.
The owner's switch sheet is "SLq licence switch" in the owner's Google account (ask the owner for access).
`locked`: ON/OFF (also TRUE/FALSE, YES/NO, 1/0). File → Share → Publish to web → CSV → put the link in the
server `.env` as `LICENSE_SHEET_CSV_URL` (server only; never sent to browsers).

## Behaviour
- Checked every `LICENSE_POLL_MINUTES` (5). Unlocking clears the single-user pin.
- Sheet unreachable → last known state is kept. No sheet configured → never locked.
- Fresh install with a sheet configured starts locked until the first successful read (`LICENSE_DEFAULT_LOCKED`).
