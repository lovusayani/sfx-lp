# SfX LP

LP account and funds management — an installable web app (PWA) for LPs plus an admin panel.

- **Web app** (`client/`): Next.js (App Router), React, TypeScript, Tailwind CSS
- **API** (`server/`): Node.js, Express, TypeScript, MongoDB (Mongoose), JWT access + refresh tokens

## Features

Authentication, onboarding, KYC, wallets (main / trade, swap), deposits, withdrawals,
trades & broker view, charges, P&L reports, notices & push notifications, and admin management.

## Local development

```bash
# API
cd server && cp .env.example .env   # fill in a DEV MongoDB URI and secrets
npm install && npm run dev            # http://localhost:5000/api/health

# Web app
cd client && cp .env.example .env.local
npm install && npm run dev            # http://localhost:3000
```

## Environments

Development, staging and production each use their **own** database, storage bucket,
Firebase project and API credentials. Secrets are never committed — only `.env.example`
templates live in the repo. See `docs/` for deployment notes.
