"use client";

// Customers screen: search, status filter, pagination, CRUD + soft delete.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { Customer, Paged } from "@/lib/types";
import { CustomersLoading, CustomerFormModal, useCustomerDelete } from "@/components/customer-form-modal";
import { Button, EmptyState, ErrorBanner, Modal, Select, StatusBadge, inputClass } from "@/components/ui";

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const softDelete = useCustomerDelete();

  const customers = useQuery({
    queryKey: ["customers", { q, status, page }],
    queryFn: async () =>
      (
        await api.get<Paged<Customer>>("/customers", {
          params: { page, limit: 10, ...(q ? { q } : {}), ...(status ? { status } : {}) },
        })
      ).data,
  });

  const closeAndRefetch = () => {
    setModalOpen(false);
    setEditing(null);
    void customers.refetch();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">Manage customer operations</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search name, company, email…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
        <Select
          className="w-40"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </Select>
      </div>

      {customers.isLoading ? (
        <CustomersLoading />
      ) : customers.isError ? (
        <ErrorBanner message={apiErrorMessage(customers.error)} onRetry={() => void customers.refetch()} />
      ) : customers.data && customers.data.items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Shipments</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-5 py-3 text-slate-600">{c.company}</td>
                    <td className="px-5 py-3 text-slate-600">{c.email}</td>
                    <td className="px-5 py-3 text-slate-600">{c._count?.shipments ?? 0}</td>
                    <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-700"
                          aria-label={`Edit ${c.name}`}
                          onClick={() => {
                            setEditing(c);
                            setModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Delete ${c.name}`}
                          onClick={() => setDeleting(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              {customers.data.total} customer{customers.data.total === 1 ? "" : "s"} · page {customers.data.page} of{" "}
              {Math.max(customers.data.pages, 1)}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" disabled={page >= customers.data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState title="No customers found" hint="Adjust the filters or add your first customer" />
      )}

      {modalOpen ? <CustomerFormModal open customer={editing} onClose={closeAndRefetch} /> : null}

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Soft delete customer">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{deleting?.name}</span> ({deleting?.company}) will be marked
          deleted (<code>deletedAt</code> stamped) and hidden from all lists. The row is kept for audit. This action
          cannot be undone from the UI.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={softDelete.isPending}
            onClick={() => {
              if (deleting) {
                softDelete.mutate(deleting.id);
                setDeleting(null);
              }
            }}
          >
            Delete customer
          </Button>
        </div>
      </Modal>

      <div className="sr-only">
        <Users /> customers module
      </div>
    </div>
  );
}
