import { badRequest } from "../utils/errors.js";

export function requireFields(body, fields) {
  const source = body || {};

  for (const field of fields) {
    if (
      source[field] === undefined ||
      source[field] === null ||
      source[field] === ""
    ) {
      throw badRequest(`Missing required field: ${field}`);
    }
  }
}

export function requirePositiveNumber(value, fieldName) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw badRequest(`${fieldName} must be a positive number`);
  }

  return number;
}
