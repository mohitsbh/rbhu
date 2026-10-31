import { z } from "zod";

const baseCustomer = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().email("Valid email required").max(160),
  company: z.string().trim().min(1, "Company is required").max(120),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

export const createCustomerSchema = baseCustomer;
export const updateCustomerSchema = baseCustomer.partial();

export const listCustomersQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuery>;
