const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Cars API",
      version: "1.0.0",
      description:
        "A lightweight RESTful API for managing car inventory data.",
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
    },
    // relative, so "Try it out" calls the host and port the docs were loaded from
    servers: [{ url: "/" }],
    tags: [{ name: "Cars", description: "Car inventory operations" }],
    // the API has no authentication
    security: [],
  },
  apis: [`${__dirname}/app.js`],
};

module.exports = swaggerJsdoc(options);
