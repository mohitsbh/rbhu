// WebSocket server (Module 5) – Socket.IO over the same HTTP server.
//
// Authentication: JWT verified in the connection handshake (query param
// `token`), same principal lifecycle as REST. Any client that is connected
// receives `shipment_status_changed` events published on the internal
// event bus.
//
// Scalability (documented in docs/ARCHITECTURE.md):
//  - single node: in-memory pub/sub as implemented here
//  - horizontal scale: run eventBus over Redis pub/sub (swap in event-bus.ts)
//    and enable the Socket.IO Redis adapter; App Service sticky sessions or
//    Front Door websocket affinity.
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { corsOrigins, env } from "../env.js";
import { verifyToken } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import { eventBus, type ShipmentStatusChangedEvent } from "../modules/shipments/event-bus.js";

let io: Server | null = null;

export function initWebSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: corsOrigins, methods: ["GET", "POST"], credentials: true },
  });

  // Auth on handshake: reject without a valid signed token
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;
    const p = typeof token === "string" ? verifyToken(token) : null;
    if (!p) return next(new Error("unauthorized"));
    socket.data.principal = p;
    return next();
  });

  io.on("connection", (socket) => {
    const principal = socket.data.principal as { email: string } | undefined;
    logger.info({ socket: socket.id, email: principal?.email }, "ws:connected");
    socket.emit("connected", { ok: true, at: new Date().toISOString() });

    socket.on("ping_room", (cb: (t: number) => void) => cb?.(Date.now()));
    socket.on("disconnect", (reason) => logger.info({ socket: socket.id, reason }, "ws:disconnected"));
  });

  // Fan-out platform events to all connected clients (rooms also possible)
  eventBus.subscribe((e) => {
    io?.emit(e.event, e);
    logger.info({ shipmentId: e.shipmentId, status: e.status }, "ws:broadcast");
  });

  if (env.NODE_ENV !== "production") {
    logger.info("ws: websocket server ready");
  }
  return io;
}

export function getIO() {
  if (!io) throw new Error("WebSocket not initialized");
  return io;
}
