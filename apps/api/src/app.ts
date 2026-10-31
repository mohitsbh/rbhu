// Express app assembly: security headers, CORS allow-list, request logging,
// route shops, Swagger docs, health, 404 + global error handling.
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { env, corsOrigins } from "./env.js";
import { logger } from "./lib/logger.js";
import { requireAuth } from "./middleware/auth.js";
import { notFoundHandler, errorHandler } from "./middleware/errors.js";
import { authRouter } from "./modules/auth/routes.js";
import { customerRouter } from "./modules/customers/routes.js";
import { shipmentRouter } from "./modules/shipments/routes.js";
import { chatRouter } from "./modules/chat/routes.js";
import { announcementsRouter } from "./modules/announcements/routes.js";
import { serveOpenApi, openApiDocument } from "./openapi.js";
import { prisma } from "./lib/prisma.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false); // silk-deny: no error, no CORS headers
      },
      credentials: true,
    }),
  );
  app.use(
    morgan(
      ":method :url :status :res[content-length] - :response-time ms",
      { stream: { write: (msg) => logger.info(msg.trim()) } },
    ),
  );

  // Health (no auth; used by App Service/ALB)
  app.get("/health", async (_req, res) => {
    let db = "up";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }
    res.json({ ok: true, service: "rbhu-api", db, ts: new Date().toISOString() });
  });

  // OpenAPI docs
  app.get("/openapi.json", serveOpenApi);
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, { customSiteTitle: "RBHU Platform API Docs" }),
  );

  // Business routes (protected)
  app.use("/auth", authRouter); // login itself is public; /me checks inside
  app.use(requireAuth); // everything below requires JWT
  app.use("/customers", customerRouter);
  app.use("/shipments", shipmentRouter);
  app.use("/chat", chatRouter); // routes: POST /, GET /sessions, GET /sessions/:sessionId/messages
  app.use(announcementsRouter); // GET /announcements (Bonus 3)

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
