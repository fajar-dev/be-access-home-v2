import { Hono } from "hono";
import { getHealth } from "../controller/health.controller";

const router = new Hono();

router.get("/", getHealth);

export default router;
