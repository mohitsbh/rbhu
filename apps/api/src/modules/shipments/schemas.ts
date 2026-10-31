import { z } from "zod";

export const SHIPMENT_STATUSES = ["Pending", "InTransit", "Delivered", "Cancelled"] as const;

const baseShipment = z.object({
  trackingNumber: z
    .string()
    .trim()
    .regex(/^RBHU-[A-Z0-9-]{3,12}$/i, "Tracking number must look like RBHU-12345"),
  customerId: z.string().min(1, "Customer is required"),
  origin: z.string().trim().min(2, "Origin is required").max(120),
  destination: z.string().trim().min(2, "Destination is required").max(120),
  status: z.enum(SHIPMENT_STATUSES).default("Pending"),
});

export const createShipmentSchema = baseShipment;

export const shipmentStatusUpdateSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES),
});

export const listShipmentsQuery = z.object({
  status: z.enum(SHIPMENT_STATUSES).optional(),
  customerId: z.string().min(1).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type ListShipmentsQuery = z.infer<typeof listShipmentsQuery>;
