// Business rules for shipments (Service layer).
import { Conflict, NotFound } from "../../middleware/errors.js";
import {
  shipmentRepository,
  type ShipmentDTO,
} from "./repository.js";
import { customerRepository } from "../customers/repository.js";
import { eventBus } from "./event-bus.js";
import type { CreateShipmentInput, ListShipmentsQuery, ShipmentStatus } from "./schemas.js";

export const shipmentService = {
  list(q: ListShipmentsQuery) {
    return shipmentRepository.list(q);
  },

  async recent() {
    return shipmentRepository.recent();
  },

  async statusSummary() {
    const rows = await shipmentRepository.statusSummary();
    const out: Record<ShipmentStatus, number> = { Pending: 0, InTransit: 0, Delivered: 0, Cancelled: 0 };
    for (const r of rows) out[r.status] = r._count.status;
    return out;
  },

  /** Details incl. customer + status audit trail. */
  async getById(id: string) {
    const shipment = await shipmentRepository.findWithEvents(id);
    if (!shipment) throw NotFound("Shipment");
    return shipment;
  },

  async create(input: CreateShipmentInput, actor: string): Promise<ShipmentDTO & { previousStatus?: string }> {
    if (!(await shipmentRepository.customerIdExists(input.customerId))) {
      throw NotFound("Customer");
    }
    if (await shipmentRepository.trackingExists(input.trackingNumber)) {
      throw Conflict("A shipment with this tracking number already exists");
    }
    return shipmentRepository.create({ ...input, createdBy: actor });
  },

  /** Status update + realtime broadcast (Module 5). */
  async updateStatus(id: string, status: ShipmentStatus, actor: string) {
    const result = await shipmentRepository.updateStatus(id, status, actor);
    if (!result) throw NotFound("Shipment");
    const { previousStatus, ...dto } = result;
    eventBus.publish({
      event: "shipment_status_changed",
      shipmentId: dto.id,
      trackingNumber: dto.trackingNumber,
      oldStatus: previousStatus,
      status: dto.status,
      changedAt: dto.updatedAt.toISOString(),
      actor,
    });
    return { ...dto, previousStatus };
  },
};
