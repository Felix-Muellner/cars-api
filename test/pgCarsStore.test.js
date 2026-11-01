// All tests that need Postgres live in this one file: node --test runs files
// in parallel, and every test here empties the cars table of cars_test.
const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { Pool } = require("pg");
const request = require("supertest");
const { createApp } = require("../src/app");
const { createPool, checkDatabase, describeUrl } = require("../src/database");
const { migrate } = require("../src/migrate");
const { seed } = require("../src/seed");
const { createPgCarsStore } = require("../src/pgCarsStore");
const { DatabaseUnavailableError } = require("../src/errors");
const { storeContract } = require("./storeContract");

// returns a pool for databaseUrl, or rejects with one clear message
async function connectToTestDatabase(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  }

  const pool = createPool(databaseUrl);
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    await pool.end();
    throw new Error(
      `Cannot reach Postgres at ${describeUrl(databaseUrl)}. Is the database running? ` +
        "(Codespace: rebuild the container. CI: check the postgres service.) " +
        // connecting to "localhost" can fail with an AggregateError that has no message
        `Cause: ${err.message || err.code}`,
      { cause: err }
    );
  }
  return pool;
}

test("connecting to an unreachable database fails with one clear message", async () => {
  await assert.rejects(connectToTestDatabase("postgres://cars:secret@127.0.0.1:1/cars_test"), {
    message: /^Cannot reach Postgres at postgres:\/\/127\.0\.0\.1:1\/cars_test\. Is the database running\?/,
  });
});

describe("server startup without a usable database", () => {
  // runs src/server.js with only the given environment variables
  const startServer = (env) =>
    spawnSync(process.execPath, ["src/server.js"], {
      cwd: path.join(__dirname, ".."),
      env,
      encoding: "utf8",
      timeout: 10000,
    });

  test("exits with a clear message when DATABASE_URL is not set", () => {
    const result = startServer({});

    assert.equal(result.status, 1);
    assert.match(result.stderr, /DATABASE_URL is not set/);
  });

  test("exits with a clear message when the database is unreachable", () => {
    const result = startServer({ DATABASE_URL: "postgres://cars:secret@127.0.0.1:1/cars" });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Cannot connect to the database at postgres:\/\/127\.0\.0\.1:1\/cars/);
    assert.doesNotMatch(result.stderr, /secret/);
  });

  test("exits with a clear message when DATABASE_URL is not a valid URL", () => {
    const result = startServer({ DATABASE_URL: "not a url" });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Cannot connect to the database at the configured DATABASE_URL/);
  });
});

test("a pool logs errors of idle connections instead of crashing the app", () => {
  const pool = createPool("postgres://cars:cars@127.0.0.1:1/cars");

  assert.equal(pool.listenerCount("error"), 1);
  return pool.end();
});

describe("an unreachable database", () => {
  // localhost can fail with an AggregateError (IPv6 and IPv4), 127.0.0.1 with a plain error
  for (const host of ["127.0.0.1", "localhost"]) {
    test(`the store rejects with DatabaseUnavailableError (${host})`, async () => {
      const pool = createPool(`postgres://cars:cars@${host}:1/cars`);

      try {
        await assert.rejects(createPgCarsStore(pool).list(), DatabaseUnavailableError);
      } finally {
        await pool.end();
      }
    });
  }

  // a pool whose queries fail with err, for outages that are hard to cause for real
  const failingPool = (err) => ({
    async query() {
      throw err;
    },
  });
  const pgError = (message, code) => Object.assign(new Error(message), { code });

  for (const err of [
    pgError("terminating connection due to administrator command", "57P01"),
    pgError("the database system is starting up", "57P03"),
    pgError("connection failure", "08006"),
    new Error("timeout exceeded when trying to connect"),
    new Error("Connection terminated unexpectedly"),
  ]) {
    test(`"${err.message}" counts as an outage`, async () => {
      await assert.rejects(createPgCarsStore(failingPool(err)).get(1), DatabaseUnavailableError);
    });
  }

  test("other database errors are passed on unchanged", async () => {
    const err = pgError('relation "cars" does not exist', "42P01");

    await assert.rejects(createPgCarsStore(failingPool(err)).get(1), (thrown) => thrown === err);
  });

  test("a request gives 503", async () => {
    const pool = createPool("postgres://cars:cars@127.0.0.1:1/cars");
    const app = createApp({ store: createPgCarsStore(pool) });

    const res = await request(app).get("/api/cars");

    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { message: "Service unavailable" });
    await pool.end();
  });

  test("GET /health gives 503", async () => {
    const pool = createPool("postgres://cars:cars@127.0.0.1:1/cars");
    const app = createApp({ store: createPgCarsStore(pool) });

    const res = await request(app).get("/health");

    assert.equal(res.status, 503);
    await pool.end();
  });
});

describe("postgres", () => {
  let pool;

  before(async () => {
    pool = await connectToTestDatabase(process.env.TEST_DATABASE_URL);
    await migrate(process.env.TEST_DATABASE_URL);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE cars RESTART IDENTITY");
  });

  after(async () => {
    await pool?.end();
  });

  // beforeEach has already emptied the table
  storeContract("postgres", async () => createPgCarsStore(pool));

  describe("checkDatabase", () => {
    test("resolves for a migrated database", async () => {
      await checkDatabase(pool, process.env.TEST_DATABASE_URL);
    });

    test("says to run npm run migrate when the cars table is missing", async () => {
      // a schema without tables stands in for a database that was never migrated
      await pool.query("CREATE SCHEMA IF NOT EXISTS not_migrated");
      const unmigrated = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        options: "-c search_path=not_migrated",
      });

      try {
        await assert.rejects(checkDatabase(unmigrated, process.env.TEST_DATABASE_URL), {
          message: /The cars table does not exist\. Run npm run migrate\./,
        });
      } finally {
        await unmigrated.end();
      }
    });
  });

  describe("app with the postgres store", () => {
    test("a created car can be read back and is listed", async () => {
      const app = createApp({ store: createPgCarsStore(pool) });

      const created = await request(app).post("/api/cars").send({ make: " Ford ", model: "Mustang", year: 2022 });
      const read = await request(app).get(`/api/cars/${created.body.id}`);
      const list = await request(app).get("/api/cars");

      assert.equal(created.status, 201);
      assert.deepEqual(read.body, { id: created.body.id, make: "Ford", model: "Mustang", year: 2022 });
      assert.deepEqual(list.body, [read.body]);
    });

    test("PUT and DELETE change the stored car", async () => {
      const app = createApp({ store: createPgCarsStore(pool) });
      const { body: car } = await request(app).post("/api/cars").send({ make: "Ford", model: "Mustang", year: 2022 });

      const replaced = await request(app).put(`/api/cars/${car.id}`).send({ make: "Honda", model: "Civic", year: 2021 });
      const deleted = await request(app).delete(`/api/cars/${car.id}`);
      const afterDelete = await request(app).get(`/api/cars/${car.id}`);

      assert.deepEqual(replaced.body, { id: car.id, make: "Honda", model: "Civic", year: 2021 });
      assert.equal(deleted.status, 204);
      assert.equal(afterDelete.status, 404);
    });

    test("a database error that is not an outage gives 500", async () => {
      // a schema without tables: the query fails with "relation cars does not exist"
      await pool.query("CREATE SCHEMA IF NOT EXISTS not_migrated");
      const unmigrated = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        options: "-c search_path=not_migrated",
      });
      const app = createApp({ store: createPgCarsStore(unmigrated) });

      try {
        const res = await request(app).get("/api/cars");

        assert.equal(res.status, 500);
        assert.deepEqual(res.body, { message: "Internal server error" });
      } finally {
        await unmigrated.end();
      }
    });
  });

  describe("seed", () => {
    test("adds the two example cars to an empty table", async () => {
      const added = await seed(pool);

      assert.equal(added, 2);
      assert.deepEqual(await createPgCarsStore(pool).list(), [
        { id: 1, make: "Toyota", model: "Corolla", year: 2020 },
        { id: 2, make: "Honda", model: "Civic", year: 2021 },
      ]);
    });

    test("does nothing when the table already has a car", async () => {
      const store = createPgCarsStore(pool);
      const ford = await store.create({ make: "Ford", model: "Mustang", year: 2022 });

      const added = await seed(pool);

      assert.equal(added, 0);
      assert.deepEqual(await store.list(), [ford]);
    });
  });

  describe("cars table", () => {
    const insert = (make, model, year) =>
      pool.query("INSERT INTO cars (make, model, year) VALUES ($1, $2, $3) RETURNING *", [make, model, year]);

    test("accepts a valid car and assigns id 1", async () => {
      const { rows } = await insert("Ford", "Mustang", 2022);

      assert.deepEqual(rows, [{ id: 1, make: "Ford", model: "Mustang", year: 2022 }]);
    });

    test("accepts make and model of exactly 100 characters", async () => {
      await insert("a".repeat(100), "🚗".repeat(100), 2022);
    });

    test("rejects a blank make or model", async () => {
      await assert.rejects(insert("  ", "Mustang", 2022), { code: "23514" });
      await assert.rejects(insert("Ford", "", 2022), { code: "23514" });
    });

    test("rejects a year before 1886", async () => {
      await assert.rejects(insert("Ford", "Mustang", 1885), { code: "23514" });
    });

    test("rejects a make of 101 characters", async () => {
      // 22001: value too long for type character varying(100)
      await assert.rejects(insert("a".repeat(101), "Mustang", 2022), { code: "22001" });
    });

    test("rejects a missing field", async () => {
      // 23502: not-null violation
      await assert.rejects(insert("Ford", null, 2022), { code: "23502" });
    });

    test("rejects an id chosen by the client", async () => {
      // 428C9: cannot insert a non-DEFAULT value into a GENERATED ALWAYS column
      await assert.rejects(
        pool.query("INSERT INTO cars (id, make, model, year) VALUES (99, 'Ford', 'Mustang', 2022)"),
        { code: "428C9" }
      );
    });
  });
});
