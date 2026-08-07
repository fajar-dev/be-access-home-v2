import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { container } from "./src/container";
import routes from "./src/routes";
import { errorHandler } from "./src/middleware/error-handler.middleware";

const app = new Hono();

app.use("*", cors());
app.onError(errorHandler);

app.use("/uploads/*", serveStatic({ root: "./" }));

app.get("/", (c) => container.healthController.getHealth(c));
app.route("/api", routes);

export default app;
