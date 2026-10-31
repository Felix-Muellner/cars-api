const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");

describe("GET /api-docs.json", () => {
  test("returns 200 with an OpenAPI 3.0 spec", async () => {
    const res = await request(createApp()).get("/api-docs.json");

    assert.equal(res.status, 200);
    assert.equal(res.body.openapi, "3.0.0");
  });

  test("documents every operation with an operationId", async () => {
    const res = await request(createApp()).get("/api-docs.json");

    const operations = Object.entries(res.body.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, op]) => [`${method.toUpperCase()} ${path}`, op.operationId])
    );
    assert.deepEqual(Object.fromEntries(operations), {
      "GET /api/cars": "listCars",
      "POST /api/cars": "createCar",
      "GET /api/cars/{id}": "getCar",
      "PUT /api/cars/{id}": "replaceCar",
      "DELETE /api/cars/{id}": "deleteCar",
      "GET /health": "getHealth",
    });
  });
});

describe("5xx responses", () => {
  test("every car operation documents 500 and 503", async () => {
    const res = await request(createApp()).get("/api-docs.json");

    for (const [path, methods] of Object.entries(res.body.paths).filter(([path]) => path.startsWith("/api/cars"))) {
      for (const [method, op] of Object.entries(methods)) {
        assert.ok(op.responses["500"] && op.responses["503"], `${method.toUpperCase()} ${path}`);
      }
    }
  });
});

describe("request examples", () => {
  test("the ModelTooLong example is rejected for its length", async () => {
    const res = await request(createApp()).get("/api-docs.json");
    const example = res.body.components.examples.ModelTooLong.value;

    const created = await request(createApp()).post("/api/cars").send(example);

    assert.equal(created.status, 400);
    assert.deepEqual(created.body.errors, ["model must be at most 100 characters"]);
  });
});

describe("GET /api-docs", () => {
  test("returns 200 with the Swagger UI page", async () => {
    const res = await request(createApp()).get("/api-docs/");

    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/html/);
    assert.match(res.text, /swagger-ui/);
  });
});
