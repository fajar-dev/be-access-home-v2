import type { Context } from "hono";
import { errorResponse, successResponse } from "../helper/api-response.helper";
import type { IEmployeeService } from "../interface/employee.interface";

export class EmployeeController {
  constructor(private readonly employeeService: IEmployeeService) {}

  async getByEmployeeId(c: Context) {
    try {
      const employeeId = c.req.param("id")!;
      const employee = await this.employeeService.findByEmployeeId(employeeId);
      if (!employee) {
        return c.json(errorResponse("Employee not found"), 404);
      }
      return c.json(successResponse("Employee retrieved successfully", employee));
    } catch (error: any) {
      return c.json(errorResponse("Failed to retrieve employee", error.message));
    }
  }

  async getHierarchy(c: Context) {
    try {
      const employeeId = c.req.param("id")!;
      const search = c.req.query("q");
      const hierarchy = await this.employeeService.getHierarchy(employeeId, search);
      return c.json(successResponse("Employee hierarchy retrieved successfully", hierarchy));
    } catch (error: any) {
      return c.json(errorResponse("Failed to retrieve employee hierarchy", error.message));
    }
  }
}
