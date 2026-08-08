import type { Context, Next } from "hono";
import { container } from "../container";
import { ForbiddenException, UnauthorizedException } from "../exception/http.exception";

export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get("user");
  if (!user?.sub) {
    throw new UnauthorizedException("User identity missing");
  }

  const employee = await container.employeeService.findByEmployeeId(user.sub);
  if (!employee) {
    throw new UnauthorizedException("Employee not found");
  }

  if (!employee.is_admin) {
    throw new ForbiddenException("Admin access required");
  }

  await next();
}
