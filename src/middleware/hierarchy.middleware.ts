import type { Context, Next } from "hono";
import { container } from "../container";
import { errorResponse } from "../helper/api-response.helper";

/** Restricts a `:id` route param to employees within the caller's reporting chain. */
export async function hierarchyMiddleware(c: Context, next: Next) {
  try {
    const user = c.get("user");
    const targetEmployeeId = c.req.param("id");

    if (!user?.sub) {
      return c.json(errorResponse("Unauthorized: User identity missing"), 401);
    }

    // Include inactive employees for this authorization check.
    const hierarchy = await container.employeeService.getHierarchy(
      user.sub,
      undefined,
      true,
      false,
    );

    const isAuthorized = hierarchy.some((emp) => emp.employee_id === targetEmployeeId);
    if (!isAuthorized) {
      return c.json(errorResponse("Forbidden: You do not have access to this resource"), 403);
    }

    await next();
  } catch (error: any) {
    return c.json(errorResponse("Hierarchy check failed", error.message), 500);
  }
}
