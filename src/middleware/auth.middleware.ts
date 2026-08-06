import type { Context, Next } from "hono";
import { container } from "../container";
import { errorResponse } from "../helper/api-response.helper";

export async function authMiddleware(c: Context, next: Next) {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json(errorResponse("Authorization header missing"), 401);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return c.json(errorResponse("Token missing"), 401);
    }

    try {
      const payload = await container.authService.verifyAccessToken(token);
      c.set("user", payload);
      await next();
    } catch {
      return c.json(errorResponse("Invalid or expired token"), 401);
    }
  } catch (error: any) {
    return c.json(errorResponse("Authentication failed", error.message), 500);
  }
}
