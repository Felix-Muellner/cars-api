# Cars API

Node.js + Express 5 REST API for car inventory (CommonJS).
Requires Node 24+ (CI and the devcontainer use Node 24, the current LTS).
Domain terms and rules: read CONTEXT.md before changing behavior.
Data is stored in PostgreSQL 18; the devcontainer and CI provide it
and set `DATABASE_URL` and `TEST_DATABASE_URL` (see .env.example).
Developer setup details: docs/development.md.

## Commands

- `npm start`: run the API on http://127.0.0.1:3000 (`HOST`/`PORT`
  change it) with the Postgres store (needs `DATABASE_URL` and a
  migrated database)
- `npm test`: run the tests (`node --test`, with node:test + supertest).
  Put tests in test/*.test.js; tests that need Postgres go in
  test/pgCarsStore.test.js (needs `TEST_DATABASE_URL`)
- `npm run migrate`: apply new migrations to the `DATABASE_URL` database
- `npm run db:seed`: add the two example cars if the table is empty
- `npm run lint:api`: generate the OpenAPI spec and lint it with
  Redocly (rules in redocly.yaml)
- `npm run check`: lint + spec lint + tests
- `npm run check:migrations`: fail if a migration already on `main`
  was changed (CI runs it on every PR)
- `docker compose up --build`: build the image and run it with its own
  Postgres (migrates and seeds first); `docker compose down -v` removes
  it. CI's `container` job checks /health and /api/cars this way

## Code layout

- `src/app.js`: createApp(), the routes and their `@openapi` JSDoc
  annotations
- `src/openapi.js`: builds the OpenAPI spec from app.js; served at
  /api-docs (Swagger UI) and /api-docs.json
- `src/carsStore.js`: in-memory store (ping/list/get/create/update/remove),
  the default for createApp() and the route tests
- `src/pgCarsStore.js`: Postgres store with the same interface; turns
  connection failures into `DatabaseUnavailableError` (503)
- `src/errors.js`: `DatabaseUnavailableError`
- `src/config.js`: reads `HOST` and `PORT`
- `src/database.js`: creates the pg pool and checks the database at
  startup
- `src/migrate.js`, `src/seed.js`: run migrations, add the example cars
- `src/validation.js`: input and id validation
- `src/server.js`: connects to the database and starts the server
- `migrations/`: SQL migrations (node-pg-migrate)
- `scripts/`: entry points for `npm run lint:api` (build-openapi.js),
  `migrate`, `db:seed` and `check:migrations`
- `test/storeContract.js`: tests every store must pass
- `.devcontainer/`: Docker Compose with the workspace and Postgres
  (Docker is available inside the workspace)
- `Dockerfile`, `.dockerignore`, `compose.yaml`: the app image and how
  to run it with Postgres

## Workflow Guidelines

- Never commit directly to `main`.
- Always create and switch to a feature branch before modifying any
  file (code or docs). The branch prefix is the commit type: `feat/`,
  `fix/`, `docs/`, `test/`, `refactor/`, `ci/` or `chore/`.
- Commit messages: `type: summary (closes #N)` for the commit that
  completes an issue, `type: summary (#N)` for other commits on it.
- Every PR closes an issue. If none exists, create one with
  `gh issue create` first.
- Open a pull request using `gh pr create` upon completion for human review.

## Database

- Pass values to SQL only as parameters (`$1`, `$2`, ...), never in
  the SQL text.
- Never edit, rename or delete a migration in `migrations/` that is on
  `main`. Change the schema by adding a new migration
  (`npx node-pg-migrate create <name> -j sql`).
- A store change must keep both stores passing test/storeContract.js.

## Definition of done

- New or changed behavior has a test in test/ that failed before the
  change (not needed for docs-, ci- or chore-only changes).
- `npm run check` passes.
- If the API changed: the `@openapi` annotations in src/app.js
  (including their examples), README and CONTEXT.md are updated.
- The PR description says which issue it closes ("Closes #N").
