import { Hono } from "hono";
import { container } from "../container";

const router = new Hono();

router.get("/", (c) => container.healthController.getHealth(c));

export default router;
