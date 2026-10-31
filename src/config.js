// HOST and PORT from the environment; empty values count as not set
function readConfig(env) {
  const host = env.HOST || "127.0.0.1";
  const rawPort = env.PORT || "3000";

  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a whole number from 1 to 65535, got "${rawPort}"`);
  }

  return { host, port };
}

module.exports = { readConfig };
