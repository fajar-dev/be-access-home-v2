import { Hono } from "hono";
import { cors } from "hono/cors";
import { container } from "./src/container";
import routes from "./src/routes";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => container.healthController.getHealth(c));
app.route("/api", routes);

export default app;
