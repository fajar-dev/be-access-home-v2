export const authConfig = {
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  jwtSecret: process.env.JWT_SECRET,
  // External endpoint that verifies an employee's username/password.
  authApiUrl: process.env.AUTH_API_URL,
};
