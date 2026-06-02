export class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message, details = null) {
  return new AppError(400, message, details);
}

export function unauthorized(message = "Missing or invalid token") {
  return new AppError(401, message);
}

export function forbidden(message = "You are not allowed to perform this action") {
  return new AppError(403, message);
}

export function notFound(message) {
  return new AppError(404, message);
}

export function conflict(message) {
  return new AppError(409, message);
}
