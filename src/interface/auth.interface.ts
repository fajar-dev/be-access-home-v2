import type { EmployeeDetail } from "./employee.interface";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AccessTokenPayload = {
  sub: string;
  svp: number | null;
  email: string;
  role: string;
  exp: number;
};

export type RefreshTokenPayload = {
  sub: string;
  email: string;
  exp: number;
};

export interface IAuthService {
  /** Exchanges a Google OAuth authorization code for the signed-in user's verified email. */
  verifyGoogleCode(code: string): Promise<{ email: string } | null>;
  /** Checks employeeId/password against the external auth API. */
  verifyPassword(employeeId: string, password: string): Promise<boolean>;
  generateTokens(employee: EmployeeDetail): Promise<AuthTokens>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
}
