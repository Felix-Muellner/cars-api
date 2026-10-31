# Cars REST API

A lightweight RESTful API for managing car inventory data, built with Node.js and Express.

This project serves as a foundational backend project to practice core web API design, standard API documentation, iterative database integration, containerization, and modern deployment workflows.

---

## 🎯 Project Objectives & Roadmap

- [x] **Phase 1: Core REST API**  
  Implement full CRUD endpoints with Express, standard HTTP status codes, and an in-memory data store.
- [x] **Phase 1.5: Agent-ready foundation**  
  Add tests, linting, CI and written context (CLAUDE.md, CONTEXT.md) so agents can check their own work.
- [x] **Phase 2: API Documentation**  
  Define and document all endpoints using the OpenAPI Specification (OAS).
- [x] **Phase 3: Database Persistence**  
  Persist cars in PostgreSQL 18 with SQL migrations (node-pg-migrate), database constraints and a 100-character limit on make and model. Postgres runs as a Compose service in the devcontainer and as a service container in CI.
- [ ] **Phase 4: Container**  
  Make the API ready to run anywhere: HOST/PORT from the environment, a health check endpoint and 503 responses when the database is down. Package it as a Docker image that starts together with Postgres via `docker compose up` and is built and tested in CI. This is the last phase of the project.

Phases are numbered by topic, not by the order in which they are completed.

### Possible next steps (not part of this project)

- **Continuous Delivery:** publish the container image and deploy it automatically from GitHub Actions. *(CI, meaning lint and tests on every PR, was delivered in Phase 1.5.)*
- **Cloud Deployment:** run the container at a cloud provider, with a managed database, secrets and TLS.

These are left out on purpose: a live service costs money and needs ongoing care (updates, security, protecting the write endpoints from strangers). The project ends with a free, runnable container instead.

---

## 🛠️ Tech Stack & Tooling

* **Runtime:** Node.js
* **Package Manager:** npm
* **Framework:** Express.js
* **API Documentation:** OpenAPI 3.0 via swagger-jsdoc, Swagger UI at `/api-docs`
* **Testing:** node:test + supertest
* **Linting:** ESLint, Redocly CLI (OpenAPI spec)
* **CI:** GitHub Actions with a Postgres service container (`npm run check` on every push and PR)
* **Database:** PostgreSQL 18, via [pg](https://node-postgres.com/) with SQL migrations ([node-pg-migrate](https://salsita.github.io/node-pg-migrate/))
* **Dev Environment:** GitHub Codespace with Docker Compose (workspace + Postgres)
* **Code Editor:** Visual Studio Code
* **API Testing:** Swagger UI ("Try it out" at `/api-docs`, with example requests for each endpoint)
* **Version Control:** Git, GitHub

---

## 🤖 Agentic Workflow

The development workflow changed between phases:

- **Phase 1 – manual local development:** The code was written and run locally by hand. The Gemini LLM chat interface on the web served as the assistant for questions, explanations and code suggestions, which were copied into the project manually.
- **Phase 2 onwards – ephemeral GitHub Codespace:** Development moves into a short-lived GitHub Codespace defined by the repository's devcontainer configuration. [Claude Code CLI](https://claude.com/claude-code) runs directly in the Codespace, where it can read the codebase, edit files and run commands. The [GitHub CLI (`gh`)](https://cli.github.com/) handles planning and project management from the terminal, such as creating issues under milestones, labeling them and working through them.

Because the environment is ephemeral and fully described by the devcontainer, every session starts from the same reproducible state, and the repository (code, issues and milestones) remains the single source of truth.

---

## 🚀 API Endpoints (Cars)

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/cars` | Retrieve all cars | `200 OK` |
| `GET` | `/api/cars/:id` | Retrieve a specific car by ID | `200 OK` / `400 Bad Request` / `404 Not Found` |
| `POST` | `/api/cars` | Add a new car | `201 Created` / `400 Bad Request` |
| `PUT` | `/api/cars/:id` | Update an existing car | `200 OK` / `400 Bad Request` / `404 Not Found` |
| `DELETE` | `/api/cars/:id` | Remove a car by ID | `204 No Content` / `400 Bad Request` / `404 Not Found` |
| `GET` | `/health` | Check that the API can reach its database | `200 OK` / `503 Service Unavailable` |

A car is `{ id, make, model, year }`. `make` and `model` must be non-empty and at most 100 characters (after trimming spaces), and `year` must be a whole number from 1886 to next year. Ids are assigned by the server, never reused, and may have gaps. Cars are stored in PostgreSQL and survive restarts.

Every error response has a JSON body `{ "message": string }`. Validation failures also include `errors: string[]`. A body that is not valid JSON returns `400` with `"Invalid JSON"`, an unknown route returns `404` with `"Not found"`, an unreachable database returns `503` with `"Service unavailable"` (try again later), and any other unexpected server error returns `500` with `"Internal server error"`, without a stack trace.

## ⚙️ Getting Started

### Quick start (GitHub Codespace)

Open the repository in a Codespace. It starts PostgreSQL, applies the migrations and adds two example cars for you. Then:

```bash
npm start
```

The API runs at `http://127.0.0.1:3000`. Interactive API docs (Swagger UI) are at `http://127.0.0.1:3000/api-docs`. Use "Try it out" and pick a named example to send a request. The raw OpenAPI spec is at `/api-docs.json`.

To run it on your own machine (Node.js 24 and PostgreSQL 18), see the [development guide](docs/development.md#running-outside-the-codespace).

### Commands

```bash
npm start         # run the API
npm test          # run the tests (the Postgres tests need TEST_DATABASE_URL)
npm run migrate   # apply new database migrations
npm run db:seed   # add the two example cars to an empty database
npm run check     # lint + spec lint + tests (CI runs this and check:migrations)
```

The [development guide](docs/development.md) covers environment variables, migrations, the test layout and troubleshooting.
