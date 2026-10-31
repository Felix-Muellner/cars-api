# Cars API: domain context

Shared vocabulary and rules. Use these exact names in code, tests,
OpenAPI schemas and examples, and the README.

## Terms

- **Car**: a stored car. Fields: `id` (positive integer, assigned by
  the server), `make` (string), `model` (string), `year` (integer).
- **CarInput**: what a client sends to create or replace a car:
  `make`, `model`, `year`. Never includes `id`.
- **Error**: every 4xx response body is `{ "message": string }`,
  plus `errors: string[]` for validation failures. Every 5xx body is
  `{ "message": "Internal server error" }`, never a stack trace.
- **Store**: the object that keeps cars. Routes talk to it only
  through list, get, create, update, remove, which all return
  Promises. Two implementations with the same behavior:
  - in-memory (`createCarsStore` in `src/carsStore.js`): the default
    for `createApp()`, used by the route tests, seeded with two cars;
  - Postgres (`createPgCarsStore` in `src/pgCarsStore.js`): used by
    `src/server.js`.
- **Store contract**: the tests in `test/storeContract.js` that both
  stores must pass.
- **Database**: PostgreSQL 18. `cars` is the development database
  (`DATABASE_URL`), `cars_test` the test database
  (`TEST_DATABASE_URL`), whose cars table is emptied before each test.
- **Migration**: one numbered SQL file in `migrations/` that changes
  the schema, applied once per database by `npm run migrate`
  (node-pg-migrate records it in the `pgmigrations` table).
- **Seed data**: the two example cars (Toyota Corolla, Honda Civic).

## Rules

- `make` and `model` must be non-empty after trimming spaces and at
  most 100 characters after trimming. Length counts characters, not
  UTF-16 units (an emoji is one character). Too long gives 400
  "Invalid car" with e.g. "make must be at most 100 characters".
- `year` must be a whole number from 1886 to next year.
- A car id in the URL must be a positive integer, otherwise 400
  "Invalid car id".
- PUT replaces all of make, model and year (no partial updates).
  Order of checks: bad id 400, unknown id 404, bad body 400.
- A body that is not valid JSON gives 400 "Invalid JSON". An unknown
  route gives 404 "Not found".
- `GET /api/cars` lists cars ordered by id.
- Ids are never reused and may have gaps (Postgres also uses up an id
  when an insert fails). Never assume ids are consecutive.
- The server listens on 127.0.0.1:3000 (hard-coded until Phase 4).

### Database

- Table `cars`: `id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
  (clients cannot choose ids), `make varchar(100)` and
  `model varchar(100)` (NOT NULL, not blank after trimming),
  `year integer` (NOT NULL, >= 1886). These constraints are a safety
  net behind `src/validation.js`; "year at most next year" changes
  over time, so only validation.js checks it.
- Put values into queries only as parameters (`$1`, `$2`, ...), never
  into the SQL text. This prevents SQL injection.
- Never edit, rename or delete a migration that is on `main`; change
  the schema with a new migration. CI enforces this
  (`npm run check:migrations`), and node-pg-migrate refuses to run a
  new migration that sorts before one that already ran.
- The app never migrates the database itself. At startup it exits
  with a clear message if `DATABASE_URL` is not set, the database is
  unreachable, or the cars table is missing ("Run npm run migrate.").
- If the database fails during a request, the response is 500
  "Internal server error" (after at most a 5 second connection
  timeout); the app keeps running and recovers when the database is
  back.
- Seed data goes only into the development database, only when its
  cars table is empty (`npm run db:seed`), and never in a migration.
- All tests that use Postgres live in `test/pgCarsStore.test.js`,
  because `node --test` runs test files in parallel.

## Phase 4 decisions

- HOST and PORT come from the environment, defaulting to `127.0.0.1`
  and `3000`. The Docker image sets `HOST=0.0.0.0`, because inside a
  container 127.0.0.1 is unreachable from outside.
- `GET /health` returns 200 `{ "status": "ok" }` when the store can
  reach its data, and 503 `{ "message": "Service unavailable" }` when
  it cannot.
- If the database is unreachable during a request, the response is 503
  `{ "message": "Service unavailable" }`. Any other unexpected error
  stays 500 "Internal server error".
- `docker compose up` runs migrations and seeding as a one-off
  `migrate` service before the API starts; the API itself still never
  migrates.

## Out of scope

Continuous delivery and cloud deployment (the former Phases 5 and 6)
are not part of this project. The API has no authentication, so it
must not be exposed publicly for long.
