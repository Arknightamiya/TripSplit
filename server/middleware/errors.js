import { AppError } from "../utils/errors.js";

export function notFoundHandler(req, _res, next) {
  if (req.path.startsWith("/api")) {
    next(new AppError(404, "Route not found"));
    return;
  }

  next();
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Invalid JSON request body" });
    return;
  }

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Internal server error" : error.message;

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({ error: message });
}
