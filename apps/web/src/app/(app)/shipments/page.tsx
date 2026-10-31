"use client";

// Shipments screen: status tabs, create modal, inline status update (emits WS
// events → toasts everywhere), details drawer with audit trail.
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Plus, History } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { Paged, Shipment, ShipmentDetail, ShipmentStatus } from "@/lib/types";
import { ShipmentFormModal } from "@/components/shipment-form-modal";
import { useToast } from "@/hooks/use-toast";
import { Button, EmptyState, ErrorBanner, Modal, Select, Spinner, StatusBadge, inputClass } from "@/components/ui";

const TABS: (ShipmentStatus | "All")[] = ["All", "Pending", "InTransit", "Delivered", "Cancelled"];

export default function ShipmentsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toast = useToast();

  const shipments = useQuery({
    queryKey: ["shipments", { tab, page }],
    queryFn: async () =>
      (
        await api.get<Paged<Shipment>>("/shipments", {
          params: {
            page,
            limit: 10,
            ...(tab !== "All" ? { status: tab } : {}),
          },
        })
      ).data,
  });

  const detail = useQuery({
    queryKey: ["shipments", detailId],
    queryFn: async () => (await api.get<ShipmentDetail>(`/shipments/${detailId}`)).data,
    enabled: detailId !== null,
  });

  async function updateStatus(shipment: Shipment, next: ShipmentStatus) {
    if (next === shipment.status) return;
    setActionError(null);
    try {
      await api.patch(`/shipments/${shipment.id}/status`, { status: next });
      toast.toast({ title: shipment.trackingNumber, description: `${shipment.status} → ${next}`, variant: "success" });
      // WS broadcast also invalidates ["shipments"] for every connected client
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipments</h1>
          <p className="text-sm text-slate-500">Status changes broadcast to every connected client (Module 5)</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Shipment
        </Button>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={clsx(
              "rounded-full px-4 py-1.5 text-sm transition",
              tab === t ? "bg-indigo-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200",
            )}
          >
            {t === "All" ? "All" : t === "InTransit" ? "In Transit" : t}
          </button>
        ))}
      </div>

      {shipments.isLoading ? (
        <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-indigo-700" /></div>
      ) : shipments.isError ? (
        <ErrorBanner message={apiErrorMessage(shipments.error)} onRetry={() => void shipments.refetch()} />
      ) : shipments.data && shipments.data.items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Tracking</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Change to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.data.items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <button className="font-medium text-indigo-700 hover:underline" onClick={() => setDetailId(s.id)}>
                        {s.trackingNumber}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <Link href="/customers" className="hover:underline">
                        {s.customer.name}
                      </Link>
                      <span className="block text-xs text-slate-400">{s.customer.company}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {s.origin} <span className="text-slate-300">→</span> {s.destination}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-3">
                      <Select
                        className="w-36"
                        value={s.status}
                        onChange={(e) => void updateStatus(s, e.target.value as ShipmentStatus)}
                        aria-label={`Update status of ${s.trackingNumber}`}
                      >
                        {TABS.filter((t) => t !== "All").map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              {shipments.data.total} shipment{shipments.data.total === 1 ? "" : "s"} · page {shipments.data.page} of{" "}
              {Math.max(shipments.data.pages, 1)}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" disabled={page >= shipments.data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState title="No shipments found" hint="Create a shipment to get started" />
      )}

      {actionError ? <ErrorBanner message={actionError} /> : null}

      {createOpen ? <ShipmentFormModal open onClose={() => setCreateOpen(false)} /> : null}

      {/* Details drawer w/ audit trail */}
      <Modal
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title={detail.data ? `Shipment ${detail.data.trackingNumber}` : "Shipment details"}
      >
        {detail.isLoading || !detail.data ? (
          <div className="flex h-40 items-center justify-center"><Spinner className="h-8 w-8 text-indigo-700" /></div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-slate-600">
              <div>
                <p className="text-xs text-slate-400">Customer</p>
                <p className="font-medium text-slate-800">{detail.data.customer.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Route</p>
                <p className="font-medium text-slate-800">{detail.data.origin} → {detail.data.destination}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Current status</p>
                <StatusBadge status={detail.data.status} />
              </div>
              <div>
                <p className="text-xs text-slate-400">Created</p>
                <p className="font-medium text-slate-800">{new Date(detail.data.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 font-medium text-slate-700">
                <History className="h-4 w-4" /> Status audit trail (ShipmentEvent)
              </div>
              <ol className="relative ml-3 space-y-3 border-l border-slate-200 pl-5">
                {detail.data.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    <p className="font-medium text-slate-800">
                      {e.fromStatus ? `${e.fromStatus} → ` : ""}
                      {e.toStatus}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(e.createdAt).toLocaleString()} · by {e.actor ?? "system"}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
