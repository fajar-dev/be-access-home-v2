import { Hono } from "hono";
import { cors } from "hono/cors";
import { container } from "./src/container";
import routes from "./src/routes";
import { errorHandler } from "./src/middleware/error-handler.middleware";

const app = new Hono();

app.use("*", cors());
app.onError(errorHandler);

app.get("/", (c) => container.healthController.getHealth(c));
app.route("/api", routes);

export default app;
