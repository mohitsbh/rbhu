"use client";

// Announcements screen (Bonus 3): mocked SharePoint intranet feed.
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { Announcement } from "@/lib/types";
import { ErrorBanner, Spinner, EmptyState } from "@/components/ui";

export default function AnnouncementsPage() {
  const q = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await api.get<{ items: Announcement[] }>("/announcements")).data.items,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        <p className="text-sm text-slate-500">
          Intranet feed via GET /announcements — currently a mocked SharePoint preview (integration design in
          docs/BONUS-SHAREPOINT.md)
        </p>
      </header>

      {q.isLoading ? (
        <div className="flex h-40 items-center justify-center"><Spinner className="h-8 w-8 text-indigo-700" /></div>
      ) : q.isError ? (
        <ErrorBanner message={apiErrorMessage(q.error)} onRetry={() => void q.refetch()} />
      ) : q.data && q.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {q.data.map((a) => (
            <article key={a.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Megaphone className="h-4 w-4" />
                  <h2 className="font-semibold text-slate-900">{a.title}</h2>
                </div>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-600">
                  {a.source}
                </span>
              </div>
              <p className="text-sm text-slate-600">{a.body}</p>
              <p className="mt-3 text-xs text-slate-400">
                {a.author} · {new Date(a.publishedAt).toLocaleDateString()}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No announcements" />
      )}
    </div>
  );
}
