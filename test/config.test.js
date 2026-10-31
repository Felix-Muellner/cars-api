const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { readConfig } = require("../src/config");
const { createApp } = require("../src/app");

describe("readConfig", () => {
  test("defaults to 127.0.0.1:3000", () => {
    assert.deepEqual(readConfig({}), { host: "127.0.0.1", port: 3000 });
  });

  test("reads HOST and PORT from the environment", () => {
    assert.deepEqual(readConfig({ HOST: "0.0.0.0", PORT: "8080" }), { host: "0.0.0.0", port: 8080 });
  });

  test("treats empty values as not set", () => {
    assert.deepEqual(readConfig({ HOST: "", PORT: "" }), { host: "127.0.0.1", port: 3000 });
  });

  for (const port of ["abc", "0", "65536", "3000.5", "-1", " 3000"]) {
    test(`rejects PORT=${JSON.stringify(port)}`, () => {
      assert.throws(() => readConfig({ PORT: port }), {
        message: `PORT must be a whole number from 1 to 65535, got "${port}"`,
      });
    });
  }
});

describe("OpenAPI servers", () => {
  test("uses a relative URL, so Swagger UI works on any host and port", async () => {
    const res = await request(createApp()).get("/api-docs.json");

    assert.deepEqual(res.body.servers, [{ url: "/" }]);
  });
});
