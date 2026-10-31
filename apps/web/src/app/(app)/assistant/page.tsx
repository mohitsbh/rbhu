"use client";

// AI Assistant screen (Module 4): sessions sidebar + message thread +
// graceful error card with retry.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send } from "lucide-react";
import { api, apiErrorMessage, TOKEN_KEY } from "@/lib/api";
import type { ChatMessageEntry, ChatReply, ChatSession } from "@/lib/types";
import { Button, ErrorBanner, Spinner, inputClass } from "@/components/ui";
import { clsx } from "clsx";

export default function AssistantPage() {
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  const sessions = useQuery({
    queryKey: ["chatSessions"],
    queryFn: async () => (await api.get<ChatSession[]>("/chat/sessions")).data,
  });

  const messages = useQuery({
    queryKey: ["chatMessages", sessionId],
    queryFn: async () => (await api.get<ChatMessageEntry[]>(`/chat/sessions/${sessionId}/messages`)).data,
    enabled: sessionId !== null,
  });

  const chat = useMutation({
    mutationFn: async (message: string) =>
      (await api.post<ChatReply>("/chat", { message, ...(sessionId ? { sessionId } : {}) })).data,
    onSuccess: (reply) => {
      if (!sessionId) setSessionId(reply.sessionId);
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["chatMessages"] });
      void qc.invalidateQueries({ queryKey: ["chatSessions"] });
    },
  });

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.data?.length, chat.isPending]);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-6">
      {/* Sessions sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col md:flex">
        <Button
          className="mb-3 w-full justify-start"
          onClick={() => {
            setSessionId(null);
            setDraft("");
          }}
        >
          <Plus className="h-4 w-4" /> New chat
        </Button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {(sessions.data ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => setSessionId(s.id)}
              className={clsx(
                "w-full truncate rounded-lg px-3 py-2 text-left text-sm",
                sessionId === s.id ? "bg-indigo-50 font-medium text-indigo-800" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h1 className="font-semibold text-slate-900">RBHU Ops Assistant</h1>
            <p className="text-xs text-slate-400">
              {chat.data?.provider === "mock" || (!chat.data && !process.env.NEXT_PUBLIC_API_URL)
                ? "mock provider (set OPENAI_API_KEY for live LLM)"
                : chat.data?.provider === "error"
                  ? "provider error handled gracefully"
                  : "OpenAI-compatible adapter"}
            </p>
          </div>
          {chat.data ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase text-slate-500">
              provider: {chat.data.provider}
            </span>
          ) : null}
        </div>

        <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {!sessionId || ((messages.data ?? []).length === 0 && !chat.isPending) ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="font-medium text-slate-600">Ask about customers, shipments or analytics</p>
              <p className="max-w-sm text-xs text-slate-400">
                e.g. &quot;How many shipments are in transit?&quot; · &quot;How do I upload a sales CSV?&quot;
              </p>
            </div>
          ) : null}
          {(messages.data ?? []).map((m) => (
            <div key={m.id} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={clsx(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                  m.role === "user"
                    ? "rounded-br-md bg-indigo-900 text-white"
                    : "rounded-bl-md bg-slate-100 text-slate-800",
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className={clsx("mt-1 text-[10px]", m.role === "user" ? "text-indigo-200" : "text-slate-400")}>
                  {new Date(m.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {chat.isPending ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Spinner className="h-4 w-4" /> assistant is thinking…
            </div>
          ) : null}
          {chat.isError ? (
            <div className="max-w-md">
              <ErrorBanner message={apiErrorMessage(chat.error)} onRetry={() => chat.mutate(chat.variables ?? "")} />
            </div>
          ) : null}
        </div>

        <form
          className="flex items-center gap-2 border-t border-slate-100 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) chat.mutate(draft.trim());
          }}
        >
          <input
            className={inputClass}
            placeholder="Message the assistant…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={chat.isPending}
            aria-label="Message"
          />
          <Button type="submit" loading={chat.isPending} disabled={!draft.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </section>
    </div>
  );
}
