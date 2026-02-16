# Testing

## Test stacks

- Unit tests: Vitest (`tests/unit`)
- Integration tests: Vitest (`tests/integration`)
- E2E tests: Playwright (`tests/e2e`)

## Commands

Run unit tests:

```bash
npm run test:unit
```

Run integration tests:

```bash
npm run test:integration
```

Run e2e tests:

```bash
npm run test:e2e
```

Run all tests:

```bash
npm run test:all
```

## DB behavior for E2E

`npm run test:e2e` automatically resets and seeds the database first.

Script flow:
1. `npm run db:test:reset`
2. `playwright test`

## Playwright browser install

If Playwright browsers are missing:

```bash
npx playwright install chromium
```

## Quality gates

Recommended local pre-push sequence:

```bash
npm run typecheck
npm run lint
npm run test:all
npm run build
```
