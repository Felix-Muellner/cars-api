# Development guide

Details for working on the Cars API. The [README](../README.md) has the
short version.

## The development environment

The GitHub Codespace (defined in [`.devcontainer/`](../.devcontainer))
runs two containers with Docker Compose:

| Container | What it runs |
| :--- | :--- |
| `app` | The workspace: Node.js 24, npm, GitHub CLI, Claude Code. You and the API run here. |
| `postgres` | PostgreSQL 18 (`postgres:18` image) with two databases: `cars` and `cars_test`. |

When the Codespace starts, it runs `npm run migrate && npm run db:seed`, so
the `cars` database is up to date and has the two example cars. Then
`npm start` is all you need.

The database files live in a Docker volume, so your cars survive restarts of
the Codespace. Rebuilding the Codespace without that volume starts from an
empty database (which the start-up commands migrate and seed again).

## Environment variables

| Variable | Used by | Codespace value |
| :--- | :--- | :--- |
| `DATABASE_URL` | `npm start`, `npm run migrate`, `npm run db:seed` | `postgres://cars:cars@postgres:5432/cars` |
| `TEST_DATABASE_URL` | `npm test` | `postgres://cars:cars@postgres:5432/cars_test` |
| `HOST` | `npm start` | not set (default `127.0.0.1`) |
| `PORT` | `npm start` | not set (default `3000`) |

The Codespace and CI set them for you. Elsewhere, copy
[`.env.example`](../.env.example) to `.env` (git-ignored) and adjust it;
the npm scripts load `.env` if it exists, and variables that are already set
win over it. The password `cars` is not a secret: these databases are local
and thrown away. The project has no real secrets, because it is never
deployed.

## The database

### Schema and migrations

The schema (tables, columns, constraints) is built by **migrations**: SQL
files in [`migrations/`](../migrations), each one a single change. `npm run
migrate` applies the ones a database has not had yet and records them in the
`pgmigrations` table, so every database ends up with the same schema.

To change the schema, add a new migration:

```bash
npx node-pg-migrate create add-car-color -j sql
```

Write the change under `-- Up Migration` (and how to undo it under
`-- Down Migration`), then run `npm run migrate`.

**Never edit, rename or delete a migration that is already on `main`.**
Databases that ran the old version would never pick up the edit. CI checks
this (`npm run check:migrations`).

The app never changes the schema itself. If the table is missing, `npm
start` stops with "The cars table does not exist. Run npm run migrate."

### Example cars

`npm run db:seed` adds Toyota Corolla and Honda Civic, but only if the
`cars` table is empty, so it never touches your own cars. Ids are never
reused: if you delete car 1, the Swagger UI example "An existing car" (id 1)
returns 404 until the database is recreated.

## Tests

`npm test` runs three kinds of tests:

| File | What it tests | Needs Postgres |
| :--- | :--- | :--- |
| `test/cars.test.js`, `test/openapi.test.js` | HTTP routes, validation, errors, `/health`, API docs, with the in-memory store | no |
| `test/config.test.js` | reading `HOST` and `PORT` | no |
| `test/carsStore.test.js` | the store contract (`test/storeContract.js`) against the in-memory store | no |
| `test/pgCarsStore.test.js` | the store contract against Postgres, the table constraints, startup checks, seeding, and the app end to end | yes |

The Postgres tests use `TEST_DATABASE_URL` (`cars_test`), migrate it, and
empty the `cars` table before each test, so they never touch your
development data. They all live in one file because `node --test` runs files
in parallel and they share one table.

If Postgres is not running, only the Postgres tests fail, with one message:
"Cannot reach Postgres at … Is the database running?".

## Running outside the Codespace

You need Node.js 24 and a PostgreSQL 18 server. With Docker, for example:

```bash
docker run -d --name cars-postgres -p 5432:5432 \
  -e POSTGRES_USER=cars -e POSTGRES_PASSWORD=cars -e POSTGRES_DB=cars \
  postgres:18
until docker exec cars-postgres pg_isready -h 127.0.0.1 -U cars; do sleep 1; done
docker exec cars-postgres createdb -U cars cars_test

cp .env.example .env   # points at localhost:5432
npm install
npm run migrate
npm run db:seed
npm start
```

## Running the API in a container

### Image and container, in short

- An **image** is a packaged copy of the app: Node.js 24, the code and the
  npm packages it needs, built from the recipe in
  [`Dockerfile`](../Dockerfile). It never changes once built.
- A **container** is a running copy of an image. You can start several
  containers from one image, stop them, and throw them away.
- **Docker** builds images and runs containers. **Docker Compose** starts
  several containers that belong together, described in
  [`compose.yaml`](../compose.yaml).

Packing the app this way means it runs the same everywhere: in the
Codespace, in CI, or on a server. Hosting companies usually expect an image.

### What `docker compose up --build` does

1. Builds the `cars-api` image from the `Dockerfile` (production packages
   only, runs as the unprivileged `node` user, listens on `0.0.0.0:3000`).
2. Starts `db`, a fresh PostgreSQL 18 with its own data volume (separate
   from the Codespace's `cars` database).
3. When `db` is healthy, runs `migrate` once: it applies the migrations and
   adds the two example cars to an empty table, then exits.
4. Starts `api` and checks `/health` every 5 seconds.

Useful commands:

```bash
docker compose up --build -d   # start in the background
docker compose ps              # see the containers and whether api is healthy
docker compose logs api        # see what the API printed
docker compose stop db         # try an outage: /health and /api/cars now answer 503
docker compose start db        # and back to 200
docker compose down -v         # stop everything and delete the data
```

CI runs the same `compose.yaml` on every pull request and checks `/health`
and `/api/cars` (the `container` job in
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

Docker in the Codespace comes from the `docker-in-docker` feature in
`.devcontainer/devcontainer.json`. If `docker` is not found, rebuild the
Codespace.

### Showing the API to someone (briefly)

The Codespace can share port 3000 with a public https link: in VS Code open
the **Ports** tab, right-click port 3000 and choose **Port Visibility →
Public**, then copy the forwarded address and add `/api-docs`. The link works
only while the Codespace runs.

The API has no login, so **anyone with the link can add, change and delete
cars**. Share it only briefly and set the port back to Private afterwards.

## Troubleshooting

| Message | What to do |
| :--- | :--- |
| `DATABASE_URL is not set` | Outside the Codespace: create `.env` from `.env.example`. |
| `Cannot connect to the database at …` / `Cannot reach Postgres at …` | Postgres is not running or not reachable. In the Codespace, rebuild the container; in CI, check the `postgres` service. |
| `The cars table does not exist. Run npm run migrate.` | Run `npm run migrate`. |
| `PORT must be a whole number from 1 to 65535` | Fix or unset `PORT`. |
| `EADDRINUSE` / port 3000 is already allocated | Something else uses port 3000, e.g. `npm start` and `docker compose up` at the same time. Stop one, or start `npm start` with another `PORT`. |
| `docker: command not found` | Rebuild the Codespace, so the Docker feature is installed. |
| `Not run migration … is preceding already run migration …` | A new migration has an older timestamp than one that already ran. Create it again with `npx node-pg-migrate create`. |
