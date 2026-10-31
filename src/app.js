const express = require("express");
const swaggerUi = require("swagger-ui-express");
const openapiSpec = require("./openapi");
const { createCarsStore, seedCars } = require("./carsStore");
const { validateCarInput, parseCarId } = require("./validation");

function createApp({ store = createCarsStore(seedCars) } = {}) {
  const app = express();

  app.use(express.json());

  app.get("/api-docs.json", (req, res) => {
    res.json(openapiSpec);
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

  /**
   * @openapi
   * components:
   *   parameters:
   *     CarId:
   *       name: id
   *       in: path
   *       required: true
   *       description: Positive integer car id
   *       schema:
   *         type: integer
   *       examples:
   *         existing:
   *           summary: An existing car
   *           value: 1
   *         unknown:
   *           summary: An unknown car (404)
   *           value: 999
   *   schemas:
   *     Car:
   *       type: object
   *       properties:
   *         id:
   *           type: integer
   *           example: 1
   *         make:
   *           type: string
   *           example: Toyota
   *         model:
   *           type: string
   *           example: Corolla
   *         year:
   *           type: integer
   *           example: 2020
   *     CarInput:
   *       type: object
   *       required: [make, model, year]
   *       properties:
   *         make:
   *           type: string
   *           minLength: 1
   *           maxLength: 100
   *           description: Must not be empty after trimming spaces, at most 100 characters after trimming
   *           example: Ford
   *         model:
   *           type: string
   *           minLength: 1
   *           maxLength: 100
   *           description: Must not be empty after trimming spaces, at most 100 characters after trimming
   *           example: Mustang
   *         year:
   *           type: integer
   *           minimum: 1886
   *           description: From 1886 to next year
   *           example: 2022
   *     Health:
   *       type: object
   *       properties:
   *         status:
   *           type: string
   *           example: ok
   *     Error:
   *       type: object
   *       properties:
   *         message:
   *           type: string
   *           example: Car not found
   *     ValidationError:
   *       type: object
   *       properties:
   *         message:
   *           type: string
   *           example: Invalid car
   *         errors:
   *           type: array
   *           items:
   *             type: string
   *           example: [year must be an integer from 1886 to next year]
   *   examples:
   *     ValidCar:
   *       summary: A valid car
   *       value:
   *         make: Ford
   *         model: Mustang
   *         year: 2022
   *     MissingFields:
   *       summary: Missing model and year (400)
   *       value:
   *         make: Ford
   *     YearOutOfRange:
   *       summary: Year before 1886 (400)
   *       value:
   *         make: Ford
   *         model: Mustang
   *         year: 1800
   *     BlankMake:
   *       summary: Make is only spaces (400)
   *       value:
   *         make: "  "
   *         model: Mustang
   *         year: 2022
   *     ModelTooLong:
   *       summary: Model longer than 100 characters (400)
   *       value:
   *         make: Ford
   *         model: Mustang GT Fastback Premium Convertible with the California Special Package and the Performance Pack Level 2
   *         year: 2022
   *     InvalidCarIdError:
   *       summary: The id is not a positive integer
   *       value:
   *         message: Invalid car id
   *     InvalidJsonError:
   *       summary: The body is not valid JSON
   *       value:
   *         message: Invalid JSON
   *     InvalidCarError:
   *       summary: The body fails validation
   *       value:
   *         message: Invalid car
   *         errors:
   *           - model must be a non-empty string
   *           - year must be an integer from 1886 to next year
   *   responses:
   *     InvalidCarId:
   *       description: The id is not a positive integer
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Error'
   *           example:
   *             message: Invalid car id
   *     InvalidCar:
   *       description: The body is not valid JSON (message "Invalid JSON"), or make or model is not a non-empty string of at most 100 characters, or year is not an integer from 1886 to next year (message "Invalid car" with errors)
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ValidationError'
   *           examples:
   *             invalidJson:
   *               $ref: '#/components/examples/InvalidJsonError'
   *             invalidCar:
   *               $ref: '#/components/examples/InvalidCarError'
   *     CarNotFound:
   *       description: Car not found
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Error'
   *           example:
   *             message: Car not found
   *     ServiceUnavailable:
   *       description: The database is unreachable; try again later
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Error'
   *           example:
   *             message: Service unavailable
   *     InternalError:
   *       description: Unexpected server error
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Error'
   *           example:
   *             message: Internal server error
   */

  /**
   * @openapi
   * /api/cars:
   *   get:
   *     tags: [Cars]
   *     operationId: listCars
   *     summary: List all cars
   *     responses:
   *       200:
   *         description: All cars in the store
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Car'
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  app.get('/api/cars', async (req, res) => {
    res.status(200).json(await store.list());
  });

  /**
   * @openapi
   * /api/cars/{id}:
   *   get:
   *     tags: [Cars]
   *     operationId: getCar
   *     summary: Get a car by id
   *     parameters:
   *       - $ref: '#/components/parameters/CarId'
   *     responses:
   *       200:
   *         description: The requested car
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Car'
   *       400:
   *         $ref: '#/components/responses/InvalidCarId'
   *       404:
   *         $ref: '#/components/responses/CarNotFound'
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  app.get('/api/cars/:id', async (req, res) => {
      const carId = parseCarId(req.params.id);
      if (carId === undefined) {
          return res.status(400).json({ message: "Invalid car id" });
      }

      const car = await store.get(carId);

      if (!car) {
          return res.status(404).json({ message: "Car not found" });
      }

      res.status(200).json(car);
  });

  /**
   * @openapi
   * /api/cars:
   *   post:
   *     tags: [Cars]
   *     operationId: createCar
   *     summary: Create a car
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CarInput'
   *           examples:
   *             valid:
   *               $ref: '#/components/examples/ValidCar'
   *             missingFields:
   *               $ref: '#/components/examples/MissingFields'
   *             yearOutOfRange:
   *               $ref: '#/components/examples/YearOutOfRange'
   *             blankMake:
   *               $ref: '#/components/examples/BlankMake'
   *             modelTooLong:
   *               $ref: '#/components/examples/ModelTooLong'
   *     responses:
   *       201:
   *         description: The created car
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Car'
   *       400:
   *         $ref: '#/components/responses/InvalidCar'
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  app.post('/api/cars', async (req, res) => {
      const { car, errors } = validateCarInput(req.body);
      if (!car) {
          return res.status(400).json({ message: "Invalid car", errors });
      }

      const newCar = await store.create(car);

      res.status(201).json(newCar);
  });

  /**
   * @openapi
   * /api/cars/{id}:
   *   put:
   *     tags: [Cars]
   *     operationId: replaceCar
   *     summary: Replace a car
   *     parameters:
   *       - $ref: '#/components/parameters/CarId'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CarInput'
   *           examples:
   *             valid:
   *               $ref: '#/components/examples/ValidCar'
   *             missingFields:
   *               $ref: '#/components/examples/MissingFields'
   *             yearOutOfRange:
   *               $ref: '#/components/examples/YearOutOfRange'
   *             blankMake:
   *               $ref: '#/components/examples/BlankMake'
   *             modelTooLong:
   *               $ref: '#/components/examples/ModelTooLong'
   *     responses:
   *       200:
   *         description: The updated car
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Car'
   *       400:
   *         description: The id is not a positive integer (message "Invalid car id"), the body is not valid JSON (message "Invalid JSON"), or the body is invalid (message "Invalid car" with errors)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ValidationError'
   *             examples:
   *               invalidId:
   *                 $ref: '#/components/examples/InvalidCarIdError'
   *               invalidJson:
   *                 $ref: '#/components/examples/InvalidJsonError'
   *               invalidCar:
   *                 $ref: '#/components/examples/InvalidCarError'
   *       404:
   *         description: Car not found (checked after the id and before the body is validated)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             example:
   *               message: Car not found
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  app.put('/api/cars/:id', async (req, res) => {
      const carId = parseCarId(req.params.id);
      if (carId === undefined) {
          return res.status(400).json({ message: "Invalid car id" });
      }

      if (!(await store.get(carId))) {
          return res.status(404).json({ message: "Car not found" });
      }

      const { car, errors } = validateCarInput(req.body);
      if (!car) {
          return res.status(400).json({ message: "Invalid car", errors });
      }

      const updatedCar = await store.update(carId, car);
      // the car can be deleted between the check above and the update
      if (!updatedCar) {
          return res.status(404).json({ message: "Car not found" });
      }

      res.status(200).json(updatedCar);
  });

  /**
   * @openapi
   * /api/cars/{id}:
   *   delete:
   *     tags: [Cars]
   *     operationId: deleteCar
   *     summary: Delete a car
   *     parameters:
   *       - $ref: '#/components/parameters/CarId'
   *     responses:
   *       204:
   *         description: Car deleted, no content
   *       400:
   *         $ref: '#/components/responses/InvalidCarId'
   *       404:
   *         $ref: '#/components/responses/CarNotFound'
   *       500:
   *         $ref: '#/components/responses/InternalError'
   */
  app.delete('/api/cars/:id', async (req, res) => {
      const carId = parseCarId(req.params.id);
      if (carId === undefined) {
          return res.status(400).json({ message: "Invalid car id" });
      }

      if (!(await store.remove(carId))) {
          return res.status(404).json({ message: "Car not found" });
      }

      res.status(204).send();
  })

  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [Health]
   *     operationId: getHealth
   *     summary: Check that the API can reach its database
   *     responses:
   *       200:
   *         description: The API can serve requests
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Health'
   *             example:
   *               status: ok
   *       503:
   *         $ref: '#/components/responses/ServiceUnavailable'
   */
  app.get("/health", async (req, res) => {
      try {
          await store.ping();
      } catch (err) {
          console.error("Health check failed:", err.message);
          return res.status(503).json({ message: "Service unavailable" });
      }

      res.status(200).json({ status: "ok" });
  });

  app.use((req, res) => {
      res.status(404).json({ message: "Not found" });
  });

  // Express treats a handler as an error handler only if it takes four arguments.
  // Express 5 also sends rejected Promises from the async routes here.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
      if (err.type === "entity.parse.failed") {
          return res.status(400).json({ message: "Invalid JSON" });
      }

      // client errors raised by express.json(), e.g. 413 payload too large
      if (err.status >= 400 && err.status < 500) {
          return res.status(err.status).json({ message: err.message });
      }

      console.error(err);
      res.status(500).json({ message: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
