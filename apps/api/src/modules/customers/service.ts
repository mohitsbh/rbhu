// Business rules & exceptions (Service layer).
import { Conflict, NotFound } from "../../middleware/errors.js";
import { customerRepository, type CustomerDTO } from "./repository.js";
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  UpdateCustomerInput,
} from "./schemas.js";
import { shipmentRepository } from "../shipments/repository.js";
import { env } from "../../env.js";

export const customerService = {
  list(q: ListCustomersQuery) {
    return customerRepository.list(q);
  },

  async options() {
    return customerRepository.options();
  },

  async getById(id: string): Promise<CustomerDTO> {
    const customer = await customerRepository.findById(id);
    if (!customer) throw NotFound("Customer");
    return customer;
  },

  async create(input: CreateCustomerInput, actor: string): Promise<CustomerDTO> {
    const dup = await customerRepository.emailExists(input.email, input.company);
    if (dup) throw Conflict("A customer with this email already exists for this company");
    return customerRepository.create({ ...input, createdBy: actor });
  },

  async update(id: string, input: UpdateCustomerInput, actor: string): Promise<CustomerDTO> {
    const existing = await this.getById(id); // 404 if missing/soft-deleted
    if (input.email || input.company) {
      const dup = await customerRepository.emailExists(
        input.email ?? existing.email,
        input.company ?? existing.company,
        id,
      );
      if (dup) throw Conflict("A customer with this email already exists for this company");
    }
    return customerRepository.update(id, { ...input, updatedBy: actor });
  },

  /** Soft delete per assignment. Shipments are kept but hidden from new flows via their own soft delete when customer is removed. */
  async softDelete(id: string, actor: string) {
    await this.getById(id); // 404 if missing/soft-deleted
    await customerRepository.softDelete(id, actor);
    // Cascade semantics: soft-delete the inactive/dead shipments history? We keep shipments for audit
    // but they no longer resolve to an active customer for new CRUD.
    return { id, deleted: true as const };
  },

  /** Context payload for the AI mock fallback. */
  async aiContext() {
    const [activeCount] = await Promise.all([customerRepository.activeCount()]);
    const byStatus = await shipmentRepository.statusSummary();
    return { activeCustomers: activeCount, shipments: byStatus, org: "RBHU ETG", aiMode: env.OPENAI_API_KEY ? "live" : "mock" };
  },
};
