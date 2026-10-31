const { createApp } = require("./app");
const { createPool, checkDatabase } = require("./database");
const { createPgCarsStore } = require("./pgCarsStore");
const { readConfig } = require("./config");

async function start() {
  let config;
  try {
    config = readConfig(process.env);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set (see .env.example)");
    process.exit(1);
  }

  const pool = createPool(databaseUrl);
  try {
    await checkDatabase(pool, databaseUrl);
  } catch (err) {
    console.error(err.message);
    await pool.end();
    process.exit(1);
  }

  const app = createApp({ store: createPgCarsStore(pool) });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Server listening on http://${config.host}:${config.port}...`);
  });

  // finish open requests, then close the database connections
  const shutdown = () => {
    server.close(() => pool.end());
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

start();
