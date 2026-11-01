// thrown by a store when its database cannot be reached; the app answers 503
class DatabaseUnavailableError extends Error {
  constructor(cause) {
    super("Database unavailable", { cause });
    this.name = "DatabaseUnavailableError";
  }
}

module.exports = { DatabaseUnavailableError };
