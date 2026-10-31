// Postgres store: same interface as carsStore.js. Values are always passed
// as parameters ($1, $2, ...), never put into the SQL text.
const { DatabaseUnavailableError } = require("./errors");

const COLUMNS = "id, make, model, year";

// network errors that mean "cannot reach the database server"
const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

// Postgres SQLSTATE codes for an outage: class 08 (connection exception),
// 57P01-57P03 (server shutting down, crashed or still starting)
function isOutage(err) {
  // connecting to "localhost" can fail with an AggregateError of several errors
  if (err instanceof AggregateError) {
    return err.errors.some(isOutage);
  }

  const code = typeof err.code === "string" ? err.code : "";
  return (
    NETWORK_ERROR_CODES.has(code) ||
    code.startsWith("08") ||
    ["57P01", "57P02", "57P03"].includes(code) ||
    // pg-pool and pg without a code: no free connection within the timeout,
    // or the connection broke while waiting for an answer
    /timeout exceeded when trying to connect|Connection terminated/.test(err.message)
  );
}

function createPgCarsStore(pool) {
  async function query(text, values) {
    try {
      return await pool.query(text, values);
    } catch (err) {
      throw isOutage(err) ? new DatabaseUnavailableError(err) : err;
    }
  }

  return {
    async ping() {
      await query("SELECT 1");
    },

    async list() {
      const { rows } = await query(`SELECT ${COLUMNS} FROM cars ORDER BY id`);
      return rows;
    },

    async get(id) {
      const { rows } = await query(`SELECT ${COLUMNS} FROM cars WHERE id = $1`, [id]);
      return rows[0];
    },

    async create({ make, model, year }) {
      const { rows } = await query(
        `INSERT INTO cars (make, model, year) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
        [make, model, year]
      );
      return rows[0];
    },

    async update(id, { make, model, year }) {
      const { rows } = await query(
        `UPDATE cars SET make = $2, model = $3, year = $4 WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, make, model, year]
      );
      return rows[0];
    },

    async remove(id) {
      const { rowCount } = await query("DELETE FROM cars WHERE id = $1", [id]);
      return rowCount === 1;
    },
  };
}

module.exports = { createPgCarsStore };
