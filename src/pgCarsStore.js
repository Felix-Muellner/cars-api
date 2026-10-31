// Postgres store: same interface as carsStore.js. Values are always passed
// as parameters ($1, $2, ...), never put into the SQL text.
const COLUMNS = "id, make, model, year";

function createPgCarsStore(pool) {
  return {
    async ping() {
      await pool.query("SELECT 1");
    },

    async list() {
      const { rows } = await pool.query(`SELECT ${COLUMNS} FROM cars ORDER BY id`);
      return rows;
    },

    async get(id) {
      const { rows } = await pool.query(`SELECT ${COLUMNS} FROM cars WHERE id = $1`, [id]);
      return rows[0];
    },

    async create({ make, model, year }) {
      const { rows } = await pool.query(
        `INSERT INTO cars (make, model, year) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
        [make, model, year]
      );
      return rows[0];
    },

    async update(id, { make, model, year }) {
      const { rows } = await pool.query(
        `UPDATE cars SET make = $2, model = $3, year = $4 WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, make, model, year]
      );
      return rows[0];
    },

    async remove(id) {
      const { rowCount } = await pool.query("DELETE FROM cars WHERE id = $1", [id]);
      return rowCount === 1;
    },
  };
}

module.exports = { createPgCarsStore };
