# Operations Runbook

## Daily development workflow

1. Pull latest changes:

```bash
git pull
```

2. Install deps if lockfile changed:

```bash
npm install
```

3. Regenerate Prisma client if schema changed:

```bash
npm run prisma:generate
```

4. Start app:

```bash
npm run dev
```

5. Open app:
- `http://localhost:3000`

## Database workflow

Apply schema changes during development:

```bash
npm run prisma:migrate
```

Reset and reseed local DB:

```bash
npm run db:test:reset
```

Warning: `db:test:reset` is destructive for local data.

## Testing workflow

Fast local checks:

```bash
npm run typecheck
npm run lint
npm run test:unit
```

Full validation:

```bash
npm run test:all
npm run build
```

## Useful commands

Run integration tests only:

```bash
npm run test:integration
```

Run e2e tests only:

```bash
npm run test:e2e
```

Run production server after build:

```bash
npm run start
```

Forward Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/v1/stripe/webhook
```

## Troubleshooting

Postgres port already in use:
- Stop existing DB container/process on `5432`, then restart your local DB.

Prisma client out of date:
- Run `npm run prisma:generate`.

E2E fails due to missing browser:
- Run `npx playwright install chromium`.

Unexpected test failures after schema changes:
- Run `npm run db:test:reset` and rerun tests.
