const swaggerJsdoc = require("swagger-jsdoc");
// the API version is the package version, so the two never drift apart
const { version } = require("../package.json");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Cars API",
      version,
      description:
        "A lightweight RESTful API for managing car inventory data.",
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
    },
    // relative, so "Try it out" calls the host and port the docs were loaded from
    servers: [{ url: "/" }],
    tags: [
      { name: "Cars", description: "Car inventory operations" },
      { name: "Health", description: "Whether the API can serve requests" },
    ],
    // the API has no authentication
    security: [],
  },
  apis: [`${__dirname}/app.js`],
};

module.exports = swaggerJsdoc(options);
