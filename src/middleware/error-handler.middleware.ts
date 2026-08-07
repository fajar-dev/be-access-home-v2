import type { ErrorHandler } from "hono";
import { HttpException } from "../exception/http.exception";
import { errorResponse } from "../helper/api-response.helper";

/** Registered via app.onError — catches anything thrown by a route or middleware. */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HttpException) {
    return c.json(errorResponse(err.message, err.details), err.statusCode);
  }

  console.error(err);
  return c.json(errorResponse("Internal server error", err.message), 500);
};
