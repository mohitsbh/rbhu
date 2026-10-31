// Shipment data access (Repository layer).
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "@prisma/client";
import type { CreateShipmentInput, ListShipmentsQuery } from "./schemas.js";

const publicSelect = {
  id: true,
  trackingNumber: true,
  origin: true,
  destination: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  customerId: true,
  createdBy: true,
  updatedBy: true,
  customer: { select: { id: true, name: true, company: true } },
} satisfies Prisma.ShipmentSelect;

export type ShipmentDTO = Prisma.ShipmentGetPayload<{ select: typeof publicSelect }>;

export const shipmentRepository = {
  async list(q: ListShipmentsQuery) {
    const where: Prisma.ShipmentWhereInput = {
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.q
        ? {
            OR: [
              { trackingNumber: { contains: q.q, mode: "insensitive" } },
              { origin: { contains: q.q, mode: "insensitive" } },
              { destination: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.shipment.findMany({
        where,
        select: publicSelect,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.shipment.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) };
  },

  findWithEvents(id: string) {
    return prisma.shipment.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, company: true, email: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
  },

  findRaw(id: string) {
    return prisma.shipment.findFirst({ where: { id, deletedAt: null } });
  },

  trackingExists(tracking: string, excludeId?: string) {
    return prisma.shipment.findFirst({
      where: { trackingNumber: tracking, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
  },

  create(data: CreateShipmentInput & { createdBy: string }) {
    // Omit status (default Pending on create) – creation is always initial
    const { status, ...rest } = data;
    void status;
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: rest,
        select: publicSelect,
      });
      await tx.shipmentEvent.create({
        data: { shipmentId: shipment.id, fromStatus: null, toStatus: "Pending", actor: data.createdBy },
      });
      return shipment;
    });
  },

  /** Status transition + audit event + updated row in one transaction. */
  updateStatus(
    id: string,
    to: "Pending" | "InTransit" | "Delivered" | "Cancelled",
    actor: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.shipment.findFirst({
        where: { id, deletedAt: null },
        select: { status: true },
      });
      if (!current) return null;
      const updated = await tx.shipment.update({
        where: { id },
        data: { status: to, updatedBy: actor },
        select: publicSelect,
      });
      await tx.shipmentEvent.create({
        data: { shipmentId: id, fromStatus: current.status, toStatus: to, actor },
      });
      return { ...updated, previousStatus: current.status };
    });
  },

  recent(limit = 5) {
    return prisma.shipment.findMany({
      where: { deletedAt: null },
      select: publicSelect,
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  },

  statusSummary() {
    return prisma.shipment.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { status: true },
    });
  },

  customerIdExists(id: string) {
    return prisma.customer.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
  },
};
