import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: "Duplicate value: that record already exists" });
  }
  console.error(err);
  res.status(500).json({
    error: "Internal server error",
    ...(env.isProd ? {} : { detail: err?.message }),
  });
}