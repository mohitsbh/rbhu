// Minimal in-process event bus with a Redis-ready interface.
// Change `publish/subscribe` to Redis pub/sub for horizontal scale;
// nothing else in the codebase changes (documented in M6 docs).
import { logger } from "../../lib/logger.js";

export interface ShipmentStatusChangedEvent {
  event: "shipment_status_changed";
  shipmentId: string;
  trackingNumber: string;
  oldStatus: string | null;
  status: string;
  changedAt: string;
  actor: string;
}

type Handler = (e: ShipmentStatusChangedEvent) => void;

const handlers = new Set<Handler>();

export const eventBus = {
  subscribe(h: Handler): () => void {
    handlers.add(h);
    return () => handlers.delete(h);
  },
  publish(e: ShipmentStatusChangedEvent) {
    logger.debug({ e }, "event:publish");
    for (const h of handlers) {
      try {
        h(e);
      } catch (err) {
        logger.error({ err: err, e }, "event handler failed");
      }
    }
  },
};
