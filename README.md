# Stuorg API

Express / TypeScript API for Stuorg. It is deployed on Vercel and can optionally use Supabase Postgres through Prisma.

## Run locally

Use Node 22. Install dependencies, create a local environment file, then start the API:

```sh
npm ci
cp .env.example .env
npm run dev
```

The API listens on port 5001 by default. Use `npm run build` to generate Prisma Client and compile the app, then `npm start` to run the compiled version. Use `npm run typecheck` to check TypeScript.

## Configuration

- `NODE_ENV`: `development` (default), `test`, or `production`.
- `PORT`: local port from 1 to 65535. Defaults to `5001`.
- `CORS_ORIGINS`: comma-separated frontend origins. Required outside development; locally defaults to `http://localhost:3000`.
- `DATABASE_URL`: optional PostgreSQL URL. Use Supabase’s transaction pooler in deployed environments.

Copy `.env.example` to `.env` for local development. Do not commit `.env` or put database secrets in frontend code.

## Deploy to Vercel

Set the Vercel project root to `stuorg-api` and use Node 22. Set the install command to `npm ci` and the build command to `npm run build`.

Configure `NODE_ENV`, `CORS_ORIGINS`, and optional `DATABASE_URL` separately for Preview and Production. Use separate database credentials for preview deployments. Configure firewall and rate limiting in Vercel before public release.

## Logging

Pino writes readable logs in development (`debug`), JSON to stdout in production (`info`), and stays silent in tests. `runtimeConfig.ts` validates an optional `LOG_LEVEL`: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, or `silent`. Production does not require `pino-pretty`.

Each request receives a server-generated UUID in `X-Request-ID`. Incoming IDs are ignored. `AsyncLocalStorage` carries that ID through controllers, services, and dependencies. HTTP middleware logs one outcome with method, route pattern, status, and duration; unmatched routes use `<unmatched>`. Successes use `info`, 4xx use `warn`, and 5xx use `error`.

Use `getLogger()` from `src/infrastructure/logging/logger.ts` at the point of logging. Outside requests it returns the base logger. Keep messages controlled and fields limited to operation names, recognized provider codes, and statuses:

```ts
getLogger().error({ dependency: "prisma", code: "P2002", status: 409 }, "Database operation failed");
```

Log dependency diagnostics once and service decisions separately. Let HTTP middleware own request summaries. Never log raw errors, messages, stacks, causes, request/response payloads, credentials, or arbitrary URLs. Pino redaction protects configured fields; it cannot scrub secrets embedded in strings. Logs remain local/stdout; no external collector or file output is configured.
