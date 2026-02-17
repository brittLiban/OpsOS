# Getting Started

## Prerequisites

- Node.js 20+ (project currently runs on Node 24 in local validation)
- npm 10+
- Docker (recommended for local PostgreSQL)

## 1) Install dependencies

```bash
npm install
```

## Fastest path (one command)

```bash
npm run dev:up
```

This command:
- starts local Postgres via Docker if needed
- runs `prisma generate`
- runs `prisma db push` (no reset)
- starts Next.js dev server

Use this if you want to keep your existing database data.

## 2) Configure environment

Create/update `.env` in repo root:

```env
DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
OPSOS_SECRET_ENCRYPTION_KEY="change-this-to-a-long-random-secret"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# Optional: Email + Calendar integrations
GOOGLE_OAUTH_CLIENT_ID=""
GOOGLE_OAUTH_CLIENT_SECRET=""
MICROSOFT_OAUTH_CLIENT_ID=""
MICROSOFT_OAUTH_CLIENT_SECRET=""
```

This project already includes that default local value.

## 3) Start PostgreSQL

If you do not already have local PostgreSQL running, start one via Docker:

```bash
docker run --name opsos-postgres ^
  -e POSTGRES_USER=johndoe ^
  -e POSTGRES_PASSWORD=randompassword ^
  -e POSTGRES_DB=mydb ^
  -p 5432:5432 ^
  -d postgres:16
```

PowerShell note: `^` above is for line breaks; you can also run as a single line.

## 4) Generate Prisma client

```bash
npm run prisma:generate
```

## 5) Initialize DB schema + seed

```bash
npm run db:test:reset
```

This command:
- pushes schema to DB (`prisma db push --force-reset`)
- seeds baseline workspace/users/pipeline data (`npm run db:seed`)

Warning: this resets/wipes your local DB data.

## 6) Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Optional: Production build check

```bash
npm run build
npm run start
```
