import type { Context, Next } from "hono";
import { container } from "../container";
import { UnauthorizedException } from "../exception/http.exception";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    throw new UnauthorizedException("Authorization header missing");
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new UnauthorizedException("Token missing");
  }

  const payload = await container.authService.verifyAccessToken(token);
  c.set("user", payload);
  await next();
}
