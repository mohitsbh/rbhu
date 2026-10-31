import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { initWebSocket } from "./ws/server.js";

const app = createApp();
const server = createServer(app);

// WebSockets share the HTTP server (Module 5)
initWebSocket(server);

server.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT} (env=${env.NODE_ENV})`);
  logger.info(`Swagger docs: http://localhost:${env.PORT}/docs`);
});

const shutdown = (sig: string) => {
  logger.info({ sig }, "shutting down…");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
