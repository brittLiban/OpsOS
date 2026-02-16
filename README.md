# Ops OS

Ops OS is a configurable internal operations dashboard for service businesses.

Tech stack:
- Next.js App Router + TypeScript (strict)
- Prisma + PostgreSQL
- Tailwind + shadcn/ui
- React Hook Form + Zod
- TanStack Table
- Vitest + Playwright

## Docs

All setup and usage docs are in `docs/`:

- `docs/README.md` - docs index
- `docs/getting-started.md` - local setup and running the app
- `docs/stripe-billing.md` - Stripe billing + webhook setup
- `docs/testing.md` - test strategy and commands
- `docs/operations.md` - daily development workflow

## Quick Start

```bash
npm install
npm run dev:up
```

Open `http://localhost:3000`.

`dev:up` starts local Postgres (Docker) if needed, runs Prisma generate + db push, then starts Next.js dev.
It does not reset your existing data.
