// Zod client-side schemas mirroring the API contract (validation parity).
import { z } from "zod";

export const loginForm = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Minimum 8 characters"),
});

export const customerForm = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().email("Enter a valid email"),
  company: z.string().min(1, "Company is required").max(120),
  status: z.enum(["Active", "Inactive"]),
});

export const customerFormEdit = customerForm.partial();

export const shipmentForm = z.object({
  trackingNumber: z.string().regex(/^RBHU-[A-Za-z0-9-]{3,12}$/, "Format: RBHU-12345"),
  customerId: z.string().min(1, "Select a customer"),
  origin: z.string().min(2, "Origin is required").max(120),
  destination: z.string().min(2, "Destination is required").max(120),
});
