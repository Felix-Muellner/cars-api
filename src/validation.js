const MIN_YEAR = 1886;
const MAX_TEXT_LENGTH = 100;
// the largest value of the Postgres integer id column; larger ids would make
// Postgres reject the query (500) instead of answering 404
const MAX_CAR_ID = 2147483647;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

// counts characters like Postgres varchar does: an emoji is one character, not two UTF-16 units
function isTooLong(value) {
  return [...value.trim()].length > MAX_TEXT_LENGTH;
}

// returns { car, errors }; car holds trimmed values and is only set when errors is empty
function validateCarInput(body) {
  const { make, model, year } = body ?? {};
  const maxYear = new Date().getFullYear() + 1;
  const errors = [];

  if (!isNonEmptyString(make)) {
    errors.push("make must be a non-empty string");
  } else if (isTooLong(make)) {
    errors.push(`make must be at most ${MAX_TEXT_LENGTH} characters`);
  }
  if (!isNonEmptyString(model)) {
    errors.push("model must be a non-empty string");
  } else if (isTooLong(model)) {
    errors.push(`model must be at most ${MAX_TEXT_LENGTH} characters`);
  }
  if (!Number.isInteger(year) || year < MIN_YEAR || year > maxYear) {
    errors.push(`year must be an integer from ${MIN_YEAR} to next year`);
  }

  if (errors.length > 0) {
    return { errors };
  }

  return { car: { make: make.trim(), model: model.trim(), year }, errors };
}

// returns the id as a number, or undefined if raw is not an integer from 1 to MAX_CAR_ID
function parseCarId(raw) {
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > MAX_CAR_ID) {
    return undefined;
  }

  return Number(raw);
}

module.exports = { validateCarInput, parseCarId };
