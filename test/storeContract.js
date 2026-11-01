// How every store must behave. carsStore.test.js runs this against the
// in-memory store and pgCarsStore.test.js against the Postgres store, so the
// two cannot drift apart. makeStore returns a new, empty store.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const ford = { make: "Ford", model: "Mustang", year: 2022 };
const honda = { make: "Honda", model: "Civic", year: 2021 };
const toyota = { make: "Toyota", model: "Corolla", year: 2020 };

function storeContract(name, makeStore) {
  describe(`${name} store contract`, () => {
    test("list of an empty store is empty", async () => {
      const store = await makeStore();

      assert.deepEqual(await store.list(), []);
    });

    test("create assigns a positive integer id and get returns the car", async () => {
      const store = await makeStore();

      const car = await store.create(ford);

      assert.ok(Number.isInteger(car.id) && car.id > 0);
      assert.deepEqual(car, { id: car.id, ...ford });
      assert.deepEqual(await store.get(car.id), car);
    });

    test("get returns undefined for an unknown id", async () => {
      const store = await makeStore();

      assert.equal(await store.get(999), undefined);
    });

    test("update replaces make, model and year and returns the car", async () => {
      const store = await makeStore();
      const { id } = await store.create(ford);

      const updated = await store.update(id, honda);

      assert.deepEqual(updated, { id, ...honda });
      assert.deepEqual(await store.get(id), { id, ...honda });
    });

    test("update returns undefined for an unknown id", async () => {
      const store = await makeStore();

      assert.equal(await store.update(999, honda), undefined);
    });

    test("remove returns true, then false the second time", async () => {
      const store = await makeStore();
      const { id } = await store.create(ford);

      assert.equal(await store.remove(id), true);
      assert.equal(await store.get(id), undefined);
      assert.equal(await store.remove(id), false);
    });

    test("ids are not reused after a delete", async () => {
      const store = await makeStore();
      await store.create(ford);
      const removed = await store.create(honda);
      await store.remove(removed.id);

      const created = await store.create(toyota);

      // ids may have gaps, so only check that it is new
      assert.ok(created.id > removed.id);
    });

    test("ping resolves when the store can reach its data", async () => {
      const store = await makeStore();

      await store.ping();
    });

    test("list returns all cars ordered by id", async () => {
      const store = await makeStore();
      const first = await store.create(ford);
      const second = await store.create(honda);
      const third = await store.create(toyota);
      // an update must not move a car to the end
      await store.update(first.id, { ...ford, year: 2023 });

      const ids = (await store.list()).map((car) => car.id);

      assert.deepEqual(ids, [first.id, second.id, third.id]);
    });
  });
}

module.exports = { storeContract };
