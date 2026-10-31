"use client";

// Sales Analytics screen (Module 3): CSV upload → charts + summary + PNG bonus.
// Charts returned by the service as Plotly figure specs; both displays reuse
// the figure's x/y arrays with Recharts (no plotly.js dependency in the web app).
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileSpreadsheet, Upload } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { ANALYTICS_URL } from "@/lib/config";
import type { AnalyzeResult, PlotlyFigure } from "@/lib/types";
import { Button, ErrorBanner, Spinner, inputClass } from "@/components/ui";
import { useToast } from "@/hooks/use-toast";

function figureToRows(fig: PlotlyFigure): { x: string; y: number }[] {
  const bar = (fig.data as Array<{ x?: unknown[]; y?: unknown[] }>).find((d) => Array.isArray(d.x) && Array.isArray(d.y));
  if (!bar) return [];
  return bar.x!.map((x, i) => ({ x: String(x), y: Number(bar.y![i]) }));
}

export default function AnalyticsPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useMutation({
    mutationFn: async ({ file, format }: { file: File; format: "json" | "png" }) => {
      const body = new FormData();
      body.append("file", file);
      return (
        await fetch(`${ANALYTICS_URL}/analyze${format === "png" ? "?format=png" : ""}`, {
          method: "POST",
          body,
        })
      ).json() as Promise<AnalyzeResult | { detail: string }>;
    },
    onSuccess: (data, vars) => {
      if ("detail" in data) {
        setError(typeof data.detail === "string" ? data.detail : "Analysis failed");
        return;
      }
      setResult(data);
      setError(null);
      if (vars.format === "png" && data.png?.revenueByRegion) {
        toast.toast({ title: "PNG export ready", description: "Charts rendered server-side with Kaleido", variant: "success" });
      }
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const onPick = (files: FileList | null) => {
    if (!files?.[0]) return;
    analyze.mutate({ file: files[0], format: "json" });
  };

  const exportPng = () => {
    if (!lastFile || !result) return;
    analyze.mutate({ file: lastFile, format: "png" });
  };

  const [lastFile, setLastFile] = useState<File | null>(null);
  const s = result?.summary;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Analytics</h1>
          <p className="text-sm text-slate-500">POST /analyze · separate Python microservice (pandas + Plotly)</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files);
              if (e.target.files?.[0]) setLastFile(e.target.files[0]);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} loading={analyze.isPending}>
            <Upload className="h-4 w-4" /> Upload CSV
          </Button>
          {result ? (
            <Button variant="secondary" onClick={exportPng} disabled={!result.pngExportAvailable}>
              Export PNG {result.pngExportAvailable ? "" : "(kaleido unavailable)"}
            </Button>
          ) : null}
        </div>
      </header>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
        <p className="flex items-center gap-2 font-medium text-slate-700">
          <FileSpreadsheet className="h-4 w-4" /> Expected headers: <code className="rounded bg-slate-100 px-1">salesperson,revenue,region</code>
        </p>
        <p className="mt-1 text-xs">
          Tip: a ready-made <code className="rounded bg-slate-100 px-1">sample.csv</code> ships inside
          <code className="rounded bg-slate-100 px-1">apps/analytics/</code>. Business columns with different names
          (e.g. <em>amount</em>, <em>zone</em>) are auto-mapped.
        </p>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {analyze.isPending ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner className="h-8 w-8 text-indigo-700" />
        </div>
      ) : null}

      {result ? (
        <>
          {s ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
              {[
                ["Rows", s.count],
                ["Salespeople", s.salespeople],
                ["Regions", s.regions],
                ["Total", Math.round(s.total)],
                ["Mean", Math.round(s.mean)],
                ["Median", Math.round(s.median)],
                ["Min", Math.round(s.min)],
                ["Max", Math.round(s.max)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-0.5 truncate text-lg font-bold text-slate-900">
                    {typeof value === "number" ? value.toLocaleString() : value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {result.png?.revenueByRegion ? (
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <img src={`data:image/png;base64,${result.png.revenueByRegion}`} alt="Revenue by region PNG export" className="w-full rounded-xl border border-slate-200 bg-white" />
              <img src={`data:image/png;base64,${result.png.topSalespeople}`} alt="Top salespeople PNG export" className="w-full rounded-xl border border-slate-200 bg-white" />
            </section>
          ) : null}

          {(["revenueByRegion", "topSalespeople"] as const).map((key) => {
            const fig = result.charts[key];
            const rows = figureToRows(fig);
            return (
              <section key={key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 font-semibold text-slate-900">{key === "revenueByRegion" ? "Revenue by Region" : "Top Salespeople"}</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="x" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => v.toLocaleString()} />
                      <Tooltip formatter={(v: number) => v.toLocaleString()} />
                      <Bar dataKey="y" name="Revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            );
          })}
          <p className="text-xs text-slate-400">
            Analyzed {result.rowsAnalyzed} rows · std {result.summary.std.toFixed(2)} · charts are Plotly figure specs served by the analytics service.
          </p>
        </>
      ) : null}
    </div>
  );
}
