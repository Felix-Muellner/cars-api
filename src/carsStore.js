// in-memory store: the default for createApp() and the route tests; same
// interface as pgCarsStore.js (both must pass test/storeContract.js)
const seedCars = [
  { id: 1, make: "Toyota", model: "Corolla", year: 2020 },
  { id: 2, make: "Honda", model: "Civic", year: 2021 },
];

function createCarsStore(initialCars = []) {
  // copy each car so updates never leak into initialCars or other stores
  const cars = initialCars.map((car) => ({ ...car }));
  let nextId = cars.reduce((max, car) => Math.max(max, car.id), 0) + 1;

  return {
    // the cars are in memory, so they are always reachable
    async ping() {},

    async list() {
      return cars;
    },

    async get(id) {
      return cars.find((c) => c.id === id);
    },

    async create({ make, model, year }) {
      const newCar = { id: nextId++, make, model, year };
      cars.push(newCar);
      return newCar;
    },

    async update(id, { make, model, year }) {
      const car = cars.find((c) => c.id === id);

      if (!car) {
        return undefined;
      }

      car.make = make;
      car.model = model;
      car.year = year;

      return car;
    },

    async remove(id) {
      const carIndex = cars.findIndex((c) => c.id === id);

      if (carIndex === -1) {
        return false;
      }

      cars.splice(carIndex, 1);
      return true;
    },
  };
}

module.exports = { createCarsStore, seedCars };
