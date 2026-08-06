import type { Context } from "hono";
import { errorResponse, successResponse } from "../helper/api-response.helper";
import type { IAuthService } from "../interface/auth.interface";
import type { IEmployeeService } from "../interface/employee.interface";

export class AuthController {
  constructor(
    private readonly authService: IAuthService,
    private readonly employeeService: IEmployeeService,
  ) {}

  async login(c: Context) {
    try {
      const body = await c.req.json();
      const isValid = await this.authService.verifyPassword(body.employeeId, body.password);
      if (!isValid) {
        return c.json(errorResponse("Employee ID or password is not valid"), 401);
      }

      const employee = await this.employeeService.findByEmployeeId(body.employeeId);
      if (!employee) {
        return c.json(errorResponse("Employee not found"), 404);
      }

      const tokens = await this.authService.generateTokens(employee);
      return c.json(
        successResponse("Login successful", { ...tokens, user: employee }),
      );
    } catch (error: any) {
      const status = error.response?.status || 500;
      return c.json(errorResponse("Login failed", error.message), status);
    }
  }

  /** Dev-only bypass: skips password verification, only checks the employee exists. */
  async devLogin(c: Context) {
    try {
      const body = await c.req.json();
      const employee = await this.employeeService.findByEmployeeId(body.employeeId);
      if (!employee) {
        return c.json(errorResponse("Employee not found"), 404);
      }

      const tokens = await this.authService.generateTokens(employee);
      return c.json(
        successResponse("Login successful", { ...tokens, user: employee }),
      );
    } catch (error: any) {
      return c.json(errorResponse("Login failed", error.message), 500);
    }
  }

  async google(c: Context) {
    try {
      const body = await c.req.json();
      const payload = await this.authService.verifyGoogleCode(body.code);
      if (!payload) {
        return c.json(errorResponse("Google verification failed"), 401);
      }

      const employee = await this.employeeService.findByEmail(payload.email);
      if (!employee) {
        return c.json(errorResponse("Employee not found"), 404);
      }

      const tokens = await this.authService.generateTokens(employee);
      return c.json(
        successResponse("Login successful", { ...tokens, user: employee }),
      );
    } catch (error: any) {
      return c.json(errorResponse("Login failed", error.message), 500);
    }
  }

  async refresh(c: Context) {
    try {
      const body = await c.req.json();
      const refreshToken = body.refreshToken;
      if (!refreshToken) {
        return c.json(errorResponse("Refresh token is required"), 400);
      }

      try {
        const payload = await this.authService.verifyRefreshToken(refreshToken);
        const employee = await this.employeeService.findByEmail(payload.email);
        if (!employee) {
          return c.json(errorResponse("User not found"), 401);
        }

        const tokens = await this.authService.generateTokens(employee);
        return c.json(
          successResponse("Token refreshed", { ...tokens, user: employee }),
        );
      } catch {
        return c.json(errorResponse("Invalid refresh token"), 401);
      }
    } catch (error: any) {
      return c.json(errorResponse("Refresh failed", error.message), 500);
    }
  }

  async me(c: Context) {
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
        const payload = await this.authService.verifyAccessToken(token);
        const employee = await this.employeeService.findByEmail(payload.email);
        if (!employee) {
          return c.json(errorResponse("User not found"), 404);
        }
        return c.json(successResponse("User retrieved", employee));
      } catch {
        return c.json(errorResponse("Invalid token"), 401);
      }
    } catch (error: any) {
      return c.json(errorResponse("Failed to get user", error.message), 500);
    }
  }

  async logout(c: Context) {
    // Stateless JWT logout — client is responsible for discarding the token.
    return c.json(successResponse("Logged out successfully"));
  }
}
