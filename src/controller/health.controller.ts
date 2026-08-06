import type { Context } from "hono";

export class HealthController {
  getHealth(c: Context) {
    return c.json({ status: "ok" });
  }
}
