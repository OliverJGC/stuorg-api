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

### Local test utility

If the gitignored `src/modules/testUtilities` folder is present locally, run the temporary test server instead of `npm run dev`:

```sh
npm run dev:test
```

It requires development mode, listens on `127.0.0.1` on the configured API port, and serves the regular API alongside the test endpoint. The folder is not included in a fresh checkout, so this command requires the local utility files.

## Before pushing

- `npm run fix` applies ESLint fixes, then formats code with Prettier.
- `npm run check` runs lint, formatting checks, typechecking, and tests.

## Configuration

- `NODE_ENV`: `development` (default), `test`, or `production`.
- `PORT`: local port from 1 to 65535. Defaults to `5001`.
- `CORS_ORIGINS`: comma-separated frontend origins. Required outside development; locally defaults to `http://localhost:3000`.
- `DATABASE_URL`: optional PostgreSQL URL. Use Supabase’s transaction pooler in deployed environments.

Copy `.env.example` to `.env` for local development. Do not commit `.env` or put database secrets in frontend code.

## Deploy to Vercel

Set the Vercel project root to `stuorg-api` and use Node 22. Set the install command to `npm ci` and the build command to `npm run build`.

Configure `NODE_ENV`, `CORS_ORIGINS`, and optional `DATABASE_URL` separately for Preview and Production. Use separate database credentials for preview deployments. Configure firewall and rate limiting in Vercel before public release.
