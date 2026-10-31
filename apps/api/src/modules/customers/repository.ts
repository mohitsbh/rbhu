// Data-access layer (Repository pattern): the only place Prisma is touched
// for customers. Soft deletes only – deleted records are filtered on read.
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "@prisma/client";
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  UpdateCustomerInput,
} from "./schemas.js";

const publicSelect = {
  id: true,
  name: true,
  email: true,
  company: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  _count: { select: { shipments: { where: { deletedAt: null } } } },
} satisfies Prisma.CustomerSelect;

export type CustomerDTO = Prisma.CustomerGetPayload<{ select: typeof publicSelect }>;

export const customerRepository = {
  async list(q: ListCustomersQuery) {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: "insensitive" } },
              { company: { contains: q.q, mode: "insensitive" } },
              { email: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        select: publicSelect,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.customer.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) };
  },

  findById(id: string) {
    return prisma.customer.findFirst({
      where: { id, deletedAt: null },
      select: publicSelect,
    });
  },

  /** Active customers only – used for the shipment customer picker. */
  options() {
    return prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, company: true },
      orderBy: { name: "asc" },
    });
  },

  emailExists(email: string, company: string, excludeId?: string) {
    return prisma.customer.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        company: { equals: company, mode: "insensitive" },
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  },

  create(data: CreateCustomerInput & { createdBy: string }) {
    return prisma.customer.create({ data, select: publicSelect });
  },

  update(id: string, data: UpdateCustomerInput & { updatedBy: string }) {
    return prisma.customer.update({
      where: { id },
      data,
      select: publicSelect,
    });
  },

  /** Soft delete: stamp deletedAt, keep the row for audit. */
  softDelete(id: string, actor: string) {
    return prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), status: "Inactive", updatedBy: actor },
      select: { id: true },
    });
  },

  activeCount() {
    return prisma.customer.count({ where: { deletedAt: null, status: "Active" } });
  },
};
