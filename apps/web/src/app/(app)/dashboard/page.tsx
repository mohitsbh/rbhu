"use client";

// Dashboard: KPI cards + status distribution + recent shipments (live via WS).
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Users, Package, Truck, Clock } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { Customer, Paged, Shipment, ShipmentSummary } from "@/lib/types";
import { EmptyState, ErrorBanner, Spinner, StatusBadge } from "@/components/ui";

const COLORS = ["#6e70f5", "#22d3ee", "#34d399", "#fbbf24"];

export default function DashboardPage() {
  const summary = useQuery({
    queryKey: ["shipmentsSummary"],
    queryFn: async () => (await api.get<ShipmentSummary>("/shipments/summary")).data,
  });
  const customers = useQuery({
    queryKey: ["customerCount"],
    queryFn: async () => (await api.get<Paged<Customer>>("/customers", { params: { limit: 1 } })).data.total,
  });
  const recent = useQuery({
    queryKey: ["recentShipments"],
    queryFn: async () => (await api.get<Shipment[]>("/shipments/recent")).data,
  });

  const s = summary.data;
  const total = s ? s.Pending + s.InTransit + s.Delivered + s.Cancelled : 0;
  const dist = s
    ? Object.entries(s)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Operations overview · updates in realtime via WebSocket notifications</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Customers", value: customers.data, sub: undefined, icon: Users, tint: "bg-indigo-50 text-indigo-700" },
          { label: "Total Shipments", value: total, sub: "excl. soft-deleted", icon: Package, tint: "bg-amber-50 text-amber-700" },
          { label: "In Transit", value: s?.InTransit ?? undefined, sub: "right now", icon: Truck, tint: "bg-sky-50 text-sky-700" },
        ].map(({ label, value, sub, icon: Icon, tint }) => (
          <div key={label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`rounded-lg p-3 ${tint}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{label}</p>
              {value === undefined ? (
                <Spinner className="mt-1 h-5 w-5" />
              ) : (
                <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
              )}
              {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">Shipment status distribution</h2>
          <p className="mb-4 text-xs text-slate-400">GET /shipments/summary</p>
          {summary.isLoading ? (
            <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-indigo-700" /></div>
          ) : summary.isError ? (
            <ErrorBanner message={apiErrorMessage(summary.error)} onRetry={() => void summary.refetch()} />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dist} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {dist.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Recent shipments</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">LIVE</span>
          </div>
          {recent.isLoading ? (
            <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-indigo-700" /></div>
          ) : recent.isError ? (
            <ErrorBanner message={apiErrorMessage(recent.error)} onRetry={() => void recent.refetch()} />
          ) : recent.data && recent.data.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {recent.data.map((sh) => (
                <li key={sh.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{sh.trackingNumber}</p>
                    <p className="truncate text-xs text-slate-400">{sh.origin} → {sh.destination}</p>
                  </div>
                  <StatusBadge status={sh.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No shipments yet" hint="Create one from the Shipments screen" />
          )}
        </section>
      </div>
    </div>
  );
}
