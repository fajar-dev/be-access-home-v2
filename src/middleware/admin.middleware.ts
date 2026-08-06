import type { Context, Next } from "hono";
import { container } from "../container";
import { errorResponse } from "../helper/api-response.helper";

export async function adminMiddleware(c: Context, next: Next) {
  try {
    const user = c.get("user");
    if (!user?.sub) {
      return c.json(errorResponse("Unauthorized: User identity missing"), 401);
    }

    const employee = await container.employeeService.findByEmployeeId(user.sub);
    if (!employee) {
      return c.json(errorResponse("Unauthorized: Employee not found"), 401);
    }

    if (!employee.is_admin) {
      return c.json(errorResponse("Forbidden: Admin access required"), 403);
    }

    await next();
  } catch (error: any) {
    return c.json(errorResponse("Admin check failed", error.message), 500);
  }
}
