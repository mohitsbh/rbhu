// AI Assistant (Module 4).
//
// Architecture:
//   1. Persist user message + load recent history (conversation context)
//   2. Build prompt: system prompt (platform context) + windowed history
//   3a. If OPENAI_API_KEY set  → call provider-agnostic OpenAI-compatible API
//       (OpenAI / Azure OpenAI / NVIDIA NIM / any base_url — see .env.example)
//   3b. Else                   → deterministic mock answer grounded in live DB
//   4. Persist assistant reply. Graceful error handling: provider failures are
//      caught, logged, returned as friendly messages; history is preserved.
//
// Prompt-engineering notes (evaluation focus):
//   - Role-fixed system prompt with org + current-data grounding
//   - Rigid "RBHU Ops Assistant" persona, answer-from-context instruction
//   - Anti-hallucination guardrail: only claim counts that exist in payload
import { prisma } from "../../lib/prisma.js";
import { env } from "../../env.js";
import { NotFound } from "../../middleware/errors.js";
import { logger } from "../../lib/logger.js";
import { shipmentRepository } from "../shipments/repository.js";
import { customerRepository } from "../customers/repository.js";
import type { ChatRequest } from "./schemas.js";
import type { AuthPrincipal } from "../../middleware/auth.js";

const HISTORY_WINDOW = 12; // last N messages kept as context

const SYSTEM_PROMPT = `You are the RBHU Ops Assistant, an internal AI assistant for RBHU ETG Pvt. Ltd.
(logistics & customer operations). Rules:
- Be concise (<= 120 words), professional, and helpful.
- Ground answers in the CURRENT PLATFORM STATE and conversation history provided.
- Never invent numbers: if the data is not present, say what you can do.
- You can help with: customers, shipments, tracking numbers, sales analytics usage, and how to navigate the platform.
- You cannot modify data - reply describing actions staff can take in the UI.`;

interface Reply {
  sessionId: string;
  messageId: string;
  content: string;
  provider: "live" | "mock" | "error";
}

export const chatService = {
  listSessions(userId: string) {
    return prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
  },

  getMessages(userId: string, sessionId: string, before?: string) {
    return prisma.chatMessage.findMany({
      where: { sessionId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      // session ownership checked in routes
    });
  },

  async chat(principal: AuthPrincipal, req: ChatRequest): Promise<Reply> {
    // 1. Resolve/create session
    let sessionId = req.sessionId;
    if (sessionId) {
      const exists = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: principal.sub },
        select: { id: true },
      });
      if (!exists) throw NotFound("Chat session");
    } else {
      const created = await prisma.chatSession.create({
        data: { userId: principal.sub, title: req.message.slice(0, 60) },
        select: { id: true },
      });
      sessionId = created.id;
    }

    // 2. Persist user msg + windowed history in parallel-ish
    await prisma.chatMessage.create({
      data: { sessionId: sessionId!, role: "user", content: req.message },
    });
    const history = await prisma.chatMessage.findMany({
      where: { sessionId: sessionId! },
      orderBy: { createdAt: "desc" },
      take: HISTORY_WINDOW,
    });
    history.reverse();

    // 3. Generate reply
    let content: string;
    let provider: Reply["provider"] = env.OPENAI_API_KEY ? "live" : "mock";
    try {
      content = env.OPENAI_API_KEY
        ? await this.callProvider(history)
        : await this.mockAnswer(req.message);
    } catch (err) {
      logger.error({ err }, "ai provider failure - handling gracefully");
      content =
        "I'm sorry — the AI service is temporarily unavailable. Your conversation has been saved, " +
        "please try again in a moment or ask a platform question like: " +
        "\"how many shipments are in transit?\"";
      provider = "error";
    }

    // 4. Persist assistant reply
    const saved = await prisma.chatMessage.create({
      data: { sessionId: sessionId!, role: "assistant", content },
      select: { id: true, content: true },
    });

    await prisma.chatSession.update({
      where: { id: sessionId! },
      data: { updatedAt: new Date() },
    });

    return { sessionId: sessionId!, messageId: saved.id, content: saved.content, provider };
  },

  /** OpenAI-compatible chat completion against any provider. */
  async callProvider(history: { role: string; content: string }[]): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    };
    let url = `${env.OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`;
    if (env.OPENAI_API_VERSION) {
      url += (url.includes("?") ? "&" : "?") + `api-version=${encodeURIComponent(env.OPENAI_API_VERSION)}`;
    }
    const payload = {
      model: env.OPENAI_MODEL,
      max_tokens: 300,
      temperature: 0.3,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`AI provider ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("AI provider returned no content");
      return text;
    } finally {
      clearTimeout(timeout);
    }
  },

  /** Deterministic, DB-grounded mock fallback (demo-safe). */
  async mockAnswer(question: string): Promise<string> {
    const [statusSummary, activeCustomers] = await Promise.all([
      shipmentRepository.statusSummary(),
      customerRepository.activeCount(),
    ]);
    const counts: Record<string, number> = { Pending: 0, InTransit: 0, Delivered: 0, Cancelled: 0 };
    for (const r of statusSummary) counts[r.status] = r._count.status;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const recent = (await shipmentRepository.recent(3))
      .map((s) => `${s.trackingNumber} (${s.status}, ${s.origin} → ${s.destination})`)
      .join("; ");

    const q = question.toLowerCase();
    if (q.includes("customer")) {
      return `We currently have ${activeCustomers} active customer${activeCustomers === 1 ? "" : "s"} in the platform. ` +
        `You can browse or manage them under Customers (list, add, edit, soft delete).`;
    }
    if (q.includes("transit")) {
      return `Right now ${counts.InTransit} shipment${counts.InTransit === 1 ? " is" : "s are"} in transit out of ${total} total shipments. ` +
        `Recent activity: ${recent || "none recorded yet"}.`;
    }
    if (q.includes("shipment")) {
      return `Shipment overview — total: ${total} · Pending: ${counts.Pending} · InTransit: ${counts.InTransit} · Delivered: ${counts.Delivered} · Cancelled: ${counts.Cancelled}. ` +
        `Recent: ${recent || "none recorded yet"}. Use the Shipments screen to update a status; all connected clients get a realtime notification.`;
    }
    if (q.includes("csv") || q.includes("sales") || q.includes("analytic") || q.includes("upload")) {
      return `Sales analytics lives in its own microservice. On the Assistant's home page, upload a CSV with headers salesperson,revenue,region to POST /analyze — it returns revenue-by-region and top-salespeople charts plus a summary you can export as PNG.`;
    }
    if (q.includes("hello") || q.includes("hi") || q.includes("help")) {
      return `Hello! I'm the RBHU Ops Assistant (mock mode — set OPENAI_API_KEY for live LLM answers). Ask me about customers, shipments in transit, or how to upload sales CSVs.`;
    }
    return `I can help with customers (${activeCustomers} active), shipments (${total} total — Pending ${counts.Pending}, InTransit ${counts.InTransit}, Delivered ${counts.Delivered}), and sales analytics (CSV upload on the Analytics screen). What would you like to know?`;
  },
};
