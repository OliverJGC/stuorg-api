# Stuorg API

Express 5 / TypeScript API deployed as a native Vercel Express application. Prisma 6 targets Supabase Postgres. Authentication and domain features are deferred; no application endpoints are exposed during this bootstrap phase.

## Local development

Use Node 22 (22.9 or newer for optional environment-file loading). Run `npm ci`, copy `.env.example` to `.env`, then run `npm run dev`. Local scripts load `.env` when present; already-set environment variables take precedence.

`npm run build` generates Prisma Client and compiles the app. `npm run typecheck` checks TypeScript. `npm start` runs the compiled local server on PORT (default 5001), listening on all interfaces. Production Vercel uses the exported Express app rather than this listener.

## Configuration and secrets

- `NODE_ENV`: development (default), test, or production. Set production for deployed environments.
- `PORT`: integer 1–65535; only used by the local listener.
- `CORS_ORIGINS`: comma-separated exact frontend origins, e.g. `https://stuorg.example`. Required outside development; defaults to `http://localhost:3000` in development. No wildcards, trailing slashes, paths, credentials, query strings, or fragments. Preview frontend origins must be listed explicitly.
- `DATABASE_URL`: optional PostgreSQL URL. When absent, Prisma is not initialized. When present, use Supabase's transaction pooler with TLS and Prisma-compatible PgBouncer settings. The commented example shows `pgbouncer=true`, `connection_limit=1`, `connect_timeout=3`, `pool_timeout=3`, and `socket_timeout=3`. Missing connection limits/timeouts receive these defaults; explicit values are preserved. Size the total connection budget across serverless instances against the Supabase pool capacity.

Commit only `.env.example`. Store actual secrets in local ignored `.env` files or Vercel environment settings. Never put a database password or service-role key in frontend variables. Runtime configuration is validated once and injected; Prisma receives the validated URL explicitly. Prisma CLI reads its schema environment separately. Client generation needs no live database; schema validation requires a URL but does not connect. No migrations or domain models exist, and builds never apply migrations.

## Vercel deployment

Set the project root to `stuorg-api`, framework preset to Express, Node version to 22.x, install command to `npm ci`, and build command to `npm run build`. Use native Express detection of `src/index.ts`; no API prefix or rewrite is needed. The default export is the platform adapter exception to named-export conventions.

Set NODE_ENV and CORS_ORIGINS separately for Preview and Production. Configure DATABASE_URL only when a database is available, using separate preview credentials/data. Preview deployments must not accidentally use production database secrets. Keep deployment protection enabled for previews as appropriate.

Configure Vercel Firewall/rate limiting at the platform edge before public rollout; there is no per-instance application limiter. TLS termination and platform request limits belong to Vercel. Application JSON bodies are capped at 100 KB; compressed request bodies are rejected. CORS permits Authorization and Content-Type headers, with cookie credentials disabled. Rejected origins receive no CORS permission, so browsers block access to the response. CORS does not authenticate callers; non-browser clients can reach public endpoints.

## Operations

All routes currently return a JSON 404 response. Prisma is instantiated once per application instance when `DATABASE_URL` is configured. The bootstrap does not install request logging or process signal handlers; Vercel manages deployed function instances.

## Manual deployment checks

No automated tests are included, following architecture.md. Check build/typecheck and Prisma schema validation, then manually inspect allowed and rejected CORS origins, bearer-header preflights, JSON 404s, and security headers. Each future controller must handle its own expected and unexpected errors using `API_MESSAGE`. Exercise invalid configuration, an occupied port, and startup with absent, reachable, and unreachable database configuration locally. Finally verify the same behavior in a protected Vercel preview before production rollout. A successful local check alone does not verify platform routing or a real database connection.
