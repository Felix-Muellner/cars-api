const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { DatabaseUnavailableError } = require("../src/errors");

const validCar = { make: "Ford", model: "Mustang", year: 2022 };

describe("GET /api/cars", () => {
  test("returns 200 with all cars", async () => {
    const res = await request(createApp()).get("/api/cars");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, [
      { id: 1, make: "Toyota", model: "Corolla", year: 2020 },
      { id: 2, make: "Honda", model: "Civic", year: 2021 },
    ]);
  });
});

describe("GET /api/cars/:id", () => {
  test("returns 200 with the car", async () => {
    const res = await request(createApp()).get("/api/cars/1");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { id: 1, make: "Toyota", model: "Corolla", year: 2020 });
  });

  test("returns 400 for a non-numeric id", async () => {
    const res = await request(createApp()).get("/api/cars/abc");

    assert.equal(res.status, 400);
  });

  test("returns 404 for an unknown id", async () => {
    const res = await request(createApp()).get("/api/cars/999");

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { message: "Car not found" });
  });
});

describe("POST /api/cars", () => {
  test("returns 201 with the created car", async () => {
    const res = await request(createApp()).post("/api/cars").send(validCar);

    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { id: 3, ...validCar });
  });

  test("returns 400 when a required field is missing", async () => {
    const res = await request(createApp())
      .post("/api/cars")
      .send({ make: "Ford", model: "Mustang" });

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      message: "Invalid car",
      errors: ["year must be an integer from 1886 to next year"],
    });
  });

  test("returns 400 when there is no body", async () => {
    const res = await request(createApp()).post("/api/cars");

    assert.equal(res.status, 400);
  });

  test("returns 400 when year is not a number", async () => {
    const res = await request(createApp())
      .post("/api/cars")
      .send({ ...validCar, year: "banana" });

    assert.equal(res.status, 400);
  });

  test("returns 400 when year is out of range", async () => {
    const res = await request(createApp())
      .post("/api/cars")
      .send({ ...validCar, year: 1700 });

    assert.equal(res.status, 400);
  });

  test("returns 400 when make is only whitespace", async () => {
    const res = await request(createApp())
      .post("/api/cars")
      .send({ ...validCar, make: "   " });

    assert.equal(res.status, 400);
  });

  test("returns 201 when make and model are exactly 100 characters", async () => {
    const res = await request(createApp())
      .post("/api/cars")
      .send({ ...validCar, make: "a".repeat(100), model: "b".repeat(100) });

    assert.equal(res.status, 201);
    assert.equal(res.body.make, "a".repeat(100));
  });

  test("returns 400 when make or model is 101 characters", async () => {
    const res = await request(createApp())
      .post("/api/cars")
      .send({ ...validCar, make: "a".repeat(101), model: "b".repeat(101) });

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      message: "Invalid car",
      errors: [
        "make must be at most 100 characters",
        "model must be at most 100 characters",
      ],
    });
  });

  test("counts the length after trimming spaces", async () => {
    const res = await request(createApp())
      .post("/api/cars")
      .send({ ...validCar, make: `  ${"a".repeat(100)}  ` });

    assert.equal(res.status, 201);
    assert.equal(res.body.make, "a".repeat(100));
  });

  test("counts an emoji or accented letter as one character", async () => {
    const make = "🚗".repeat(50) + "é".repeat(50);
    const res = await request(createApp())
      .post("/api/cars")
      .send({ ...validCar, make });

    assert.equal(res.status, 201);
    assert.equal(res.body.make, make);
  });
});

describe("PUT /api/cars/:id", () => {
  test("returns 200 with the updated car", async () => {
    const res = await request(createApp()).put("/api/cars/1").send(validCar);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { id: 1, ...validCar });
  });

  test("returns 400 when a required field is missing", async () => {
    const res = await request(createApp())
      .put("/api/cars/1")
      .send({ make: "Ford" });

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      message: "Invalid car",
      errors: [
        "model must be a non-empty string",
        "year must be an integer from 1886 to next year",
      ],
    });
  });

  test("returns 400 when model is 101 characters", async () => {
    const res = await request(createApp())
      .put("/api/cars/1")
      .send({ ...validCar, model: "b".repeat(101) });

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      message: "Invalid car",
      errors: ["model must be at most 100 characters"],
    });
  });

  test("returns 404 for an unknown id", async () => {
    const res = await request(createApp()).put("/api/cars/999").send(validCar);

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { message: "Car not found" });
  });

  test("returns 404 when the car is deleted between the check and the update", async () => {
    const store = {
      async get(id) {
        return { id, ...validCar };
      },
      async update() {
        return undefined;
      },
    };
    const res = await request(createApp({ store })).put("/api/cars/1").send(validCar);

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { message: "Car not found" });
  });
});

describe("error responses", () => {
  test("returns 400 with a JSON body for malformed JSON", async () => {
    const res = await request(createApp())
      .post("/api/cars")
      .set("Content-Type", "application/json")
      .send("{bad");

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { message: "Invalid JSON" });
  });

  test("returns 404 with a JSON body for an unknown route", async () => {
    const res = await request(createApp()).get("/nope");

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { message: "Not found" });
  });

  test("returns 500 with a JSON body and no stack trace for an unexpected error", async () => {
    const store = {
      list() {
        throw new Error("boom");
      },
    };
    const res = await request(createApp({ store })).get("/api/cars");

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { message: "Internal server error" });
  });

  test("returns 503 when the store says the database is unavailable", async () => {
    const store = {
      async list() {
        throw new DatabaseUnavailableError(new Error("connect ECONNREFUSED"));
      },
    };
    const res = await request(createApp({ store })).get("/api/cars");

    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { message: "Service unavailable" });
  });

  test("returns 500 with a JSON body when the store rejects", async () => {
    const store = {
      async list() {
        throw new Error("boom");
      },
    };
    const res = await request(createApp({ store })).get("/api/cars");

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { message: "Internal server error" });
  });
});

describe("DELETE /api/cars/:id", () => {
  test("returns 204 with no content", async () => {
    const res = await request(createApp()).delete("/api/cars/1");

    assert.equal(res.status, 204);
    assert.equal(res.text, "");
  });

  test("returns 400 for a non-numeric id", async () => {
    const res = await request(createApp()).delete("/api/cars/abc");

    assert.equal(res.status, 400);
  });

  test("returns 404 for an unknown id", async () => {
    const res = await request(createApp()).delete("/api/cars/999");

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { message: "Car not found" });
  });
});

describe("GET /health", () => {
  test("returns 200 when the store can reach its data", async () => {
    const res = await request(createApp()).get("/health");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: "ok" });
  });

  test("returns 503 when the store cannot reach its data", async () => {
    const store = {
      async ping() {
        throw new Error("database down");
      },
    };
    const res = await request(createApp({ store })).get("/health");

    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { message: "Service unavailable" });
  });
});
