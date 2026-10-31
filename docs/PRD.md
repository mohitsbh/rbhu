# PRD — RBHU Logistics & Operations Platform

**Product:** Simplified internal platform for customer management, shipment tracking, sales analytics, AI assistant and real-time notifications.
**Author:** Mohit (FSD candidate assessment, RBHU ETG Pvt. Ltd.)
**Date:** 31 Oct 2026 · **Submission:** Sat 31 Oct 2026, 6:00 PM · **Presentation:** Mon, 3:00 PM

---

## 1. Background & Goal

RBHU ETG manages customer operations, shipment tracking, analytics, and AI-powered internal tools. This assessment asks for a **simplified but production-grade platform** demonstrating those capabilities. The goal is not only working code but evidence of strong **architecture, documentation, security, scalability and production readiness**.

**One-sentence product goal:** an internal web platform where staff log in, manage customers and shipments, upload sales CSVs for instant analytics, ask an AI assistant questions, and receive real-time shipment notifications — deployable on Azure.

## 2. Personas

| Persona | Needs |
|---|---|
| Operations staff (primary user) | CRUD on customers/shipments, status updates, instant visibility of changes |
| Sales analyst | Upload CSV, get revenue-by-region & top-salespeople charts + summary stats, export PNG |
| Internal team | Ask the AI assistant about operations; get reliable, context-aware answers |
| Engineering / reviewers | Clean layered code, migrations, OpenAPI docs, deployment design |

## 3. Scope

### In scope (per assignment modules)

1. **M1 — Customer & Shipment Management API** (Node, Express, TS, Prisma, PostgreSQL, Zod)
2. **M2 — React Frontend** (React + TS; delivered as Next.js)
3. **M3 — Sales Analytics Service** (Python, Pandas, Plotly; FastAPI serving `POST /analyze`, PNG export bonus via Kaleido)
4. **M4 — AI Assistant** (`POST /chat`, context/history, error handling; provider-agnostic OpenAI-compatible)
5. **M5 — Real-Time Notifications** (WebSockets; `shipment_status_changed` broadcast)
6. **M6 — Azure Deployment Design** (documentation: hosting, DB, Entra ID, Key Vault, VNET, CI/CD)
7. **Security requirements** (JWT auth, Zod validation on every write, CORS, env vars, secret hygiene, Prisma migrations, soft delete, audit fields)
8. **Bonus 1** — Microsoft Fabric readiness design doc
9. **Bonus 2** — Voice agent architecture design doc
10. **Bonus 3** — `GET /announcements` proof-of-concept (mocked SharePoint integration)

### Out of scope

- Real production Azure deployment (design documented instead, as the PDF permits)
- Actual Entra ID tenant integration (mock JWT flow; Entra ID designed at doc level)
- Real SharePoint Graph API wiring (mocked with a design explanation)
- Multi-tenancy, billing, email/SMS notifications

## 4. Functional Requirements

### 4.1 Authentication (M2 + security requirements)

- `POST /auth/login` — mock users seeded in DB; returns signed JWT (access) with short expiry.
- Frontend login page redirects to dashboard on success; token stored and attached via interceptor.
- JWT-protected routes: all `/customers`, `/shipments`, `/chat`, `/announcements` (read), WebSocket upgrade.
- Entra ID (OIDC) integration designed in M6 docs; mock flow intentionally follows the same shape (tokens, expiry).

### 4.2 Customer Management (M1)

| Operation | Endpoint | Notes |
|---|---|---|
| Create | `POST /customers` | Zod validated: name (required), email (format, unique among non-deleted), company, status `Active\|Inactive` |
| Update | `PATCH /customers/:id` | Partial; 404 for deleted/unknown |
| List | `GET /customers` | Pagination (`page`, `limit`), free-text `?q=`, status filter; excludes soft-deleted |
| Soft delete | `DELETE /customers/:id` | Sets `deletedAt`; cascades to shipments via status semantics defined below |

### 4.3 Shipment Management (M1)

| Operation | Endpoint | Notes |
|---|---|---|
| Create | `POST /shipments` | Zod validated: `trackingNumber` (unique), `customerId` (must exist, not deleted), origin, destination, status enum |
| Update status | `PATCH /shipments/:id/status` | Status enum: `Pending → InTransit → Delivered → Cancelled`; **emits WebSocket event `shipment_status_changed`** |
| Details | `GET /shipments/:id` | Includes customer summary + status history (audit) |
| List | `GET /shipments` | Status filter, customer filter, pagination |

### 4.4 Dashboard (M2)

- **Total customers** (active count),
- **Total shipments** (by status),
- **Shipment status distribution** (aggregate endpoint `GET /shipments/summary`), rendered as a donut chart + KPI cards.

### 4.5 Analytics (M3, separate microservice)

- `POST /analyze` — multipart CSV containing `salesperson, revenue, region` (header-flexible, documented).
- Generates: **Revenue by Region** bar chart, **Top Salespeople** ranked bar chart, **summary statistics** (count, mean, median, min, max, std) — returned as JSON (Plotly figure specs + stats).
- **Bonus:** `?format=png` returns PNG exports rendered with Kaleido (graceful error if kaleido unavailable in env).
- `GET /health` for load-balancer checks.

### 4.6 AI Assistant (M4)

- `POST /chat` — body: `{ sessionId, message }`.
- Maintains **conversation context/history** server-side (`ChatSession`, `ChatMessage` tables); history is included as prompt context, windowed to the last N turns with token-pruning.
- **Provider-agnostic adapter:** any OpenAI-compatible endpoint via env (`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_API_VERSION`) → supports OpenAI, Azure OpenAI, NVIDIA NIM ("nvdea api") or local Ollama.
- **Deterministic mock fallback** (rule-based responses using live DB context — customer/shipment counts, recent statuses) when no key is configured, so demos never fail.
- **Graceful error handling:** timeouts, provider 4xx/5xx mapped to friendly messages; request-level and message-level errors never crash the service; partial history is preserved.
- Evaluation focus honored: prompt engineering (system prompt with platform context), response quality, error handling, API design (session resource, message slice pagination `GET /chat/:sessionId/messages`).

### 4.7 Real-Time Notifications (M5)

- **WebSocket server** on the backend (`/ws`), JWT-checked at upgrade.
- Any shipment status change broadcasts to **all connected clients**:

```json
{ "event": "shipment_status_changed", "shipmentId": "12345", "trackingNumber": "RBHU-00123", "oldStatus": "InTransit", "status": "Delivered", "changedAt": "..." }
```

- Frontend: toast notification + live-refresh of dashboard/shipment lists.
- Scalability notes documented (Redis pub/sub fan-out, sticky sessions, horizontal scale) — implemented as a pluggable event-bus interface (in-memory for the assignment, Redis-ready).

### 4.8 Announcements (Bonus 3)

- `GET /announcements` — mocked intranet announcements with stable shape: `{ id, title, body, publishedAt, author, source: "sharepoint-preview" }`.
- README explains the real integration path: SharePoint Graph API (sites/mo/lists), app-only Entra auth, incremental sync via webhooks, caching layer.

## 5. Data Model (Prisma / PostgreSQL)

```
Customer   id, name, email, company, status(Active|Inactive), createdAt, updatedAt, deletedAt, createdBy, updatedBy
Shipment   id, trackingNumber(unique), customerId→Customer, origin, destination,
           status(Pending|InTransit|Delivered|Cancelled), createdAt, updatedAt, deletedAt, createdBy, updatedBy
ShipmentEvent  id, shipmentId, fromStatus, toStatus, createdAt   // status audit trail
User       id, email, passwordHash(seed users only), name, role(Admin|Staff), createdAt
ChatSession  id, userId, title, createdAt, updatedAt
ChatMessage  id, sessionId→ChatSession, role(user|assistant|system), content, createdAt
```

- **Soft delete:** `deletedAt` timestamp; all reads filter it; unique constraints enforced via partial unique indexes where relevant.
- **Audit fields:** `createdAt`, `updatedAt`, `createdBy`, `updatedBy` (from JWT subject).
- **Migrations:** Prisma Migrate; seed script for demo users/customers/shipments.

## 6. Architecture

```
┌──────────────┐   REST/REST+SSE    ┌────────────────────┐    Prisma    ┌──────────────┐
│  Next.js Web │ ─────────────────▶ │  Express API (TS)  │ ───────────▶ │  PostgreSQL  │
│  (React/TS)  │ ◀ WebSocket ────── │ + WS + JWT + Zod   │              │  (Azure PG)  │
└──────┬───────┘                    └─────────┬──────────┘              └──────────────┘
       │ multipart CSV                        │
       └──────────────────────▶  ┌────────────┴───────────┐   provider-agnostic
                                 │ Analytics (FastAPI)    │   OpenAI-compatible
                                 │ Pandas + Plotly/Kaleido│◀── AI: chat adapter
                                 └────────────────────────┘
```

- Three independently deployable apps in one monorepo (`apps/web`, `apps/api`, `apps/analytics`) + `docs/`.
- The API acts as gateway: single login surface; analytics consumed as its own service.
- Event-bus abstraction for WS fan-out (in-memory now, Redis for scale).

## 7. Non-Functional & Security Requirements

| Concern | Decision |
|---|---|
| AuthZ | JWT bearer, 60-min expiry, secret via env; route-level guard middleware |
| Validation | Zod schemas shared shape on every mutating endpoint; 422 on failure |
| Error handling | Global error middleware → consistent `{ error, code, statusCode }`; typed domain errors; no stack leaks |
| Logging | Structured (pino-style) with request-id; TS service `logger` module |
| Config | `zod`-validated env loader; `.env.example` documents every variable |
| CORS | Allow-listed origins via env |
| Secrets | Never in git; Key Vault designed in M6; local `.env` git-ignored |
| DB | Prisma migrations, seed, soft-delete + audit as above |
| Docs | Swagger/OpenAPI at `/docs` (API), README per app |

## 8. Tech Stack & Deviation Register

The PDF prescribes Express, React, Flask. Chosen stack is functionally equivalent with a few time-saving modernizations, recorded transparently:

| PDF says | Delivered | Rationale |
|---|---|---|
| Express.js + TS | ✔ Express + TS | As specified |
| PostgreSQL + Prisma + Zod | ✔ as specified | — |
| React + TS | Next.js (React + TS) | Industry-standard React framework; satisfies "React frontend" |
| Python + Flask + Pandas + Plotly | FastAPI + Pandas + Plotly (+ Flask-compatible WSGI fallback documented) | Async multipart + auto OpenAPI docs; same pandas/plotly core |
| Azure OpenAI / Azure AI Foundry / OpenAI API | OpenAI-compatible adapter (covers all three + NVIDIA/others) | One abstraction spans every allowed service |
| Entra ID (or mock equivalent) | Mocked JWT (explicitly allowed), Entra designed in docs | Azure tenant not assumed |

## 9. Mock Strategy (demo reliability)

- Auth: seeded users (`admin@rbhu.in / Admin@12345`, `staff@rbhu.in / Staff@12345`).
- AI: if no `OPENAI_API_KEY`, deterministic context-aware mock answers using DB state.
- Analytics: ships with a sample CSV.
- Postgres: docker-compose for local; SQLite-compatible fallback is **not** used (Prisma + PG only, as specified).

## 10. Milestones

1. Docs (PRD, UI plan, architecture, deployment, bonuses) ✔
2. API (M1 + auth + WS + chat + announcements) with migrations/seed/OpenAPI ✔
3. Web (M2 all screens + WS toasts + assistant page)
4. Analytics service (M3) + sample CSV + PNG bonus
5. Integration pass, API docs, README, demo script, record walkthrough outline

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Postgres unavailable locally | docker-compose one-liner; migration script documents it |
| AI provider outage during review | Mock fallback always available |
| Kaleido/Chromium missing on reviewer machine | PNG export optional; JSON always works |
| Stack deviations questioned | Deviation register (§8) + README notes |

## 12. Demo Script (10–15 min)

1. **Arch overview** (diagram, deviation register) — 2 min
2. **Login (mock JWT)** → dashboard KPIs — 2 min
3. **Customers CRUD** (validation demo, soft delete evidence in DB) — 3 min
4. **Shipments:** create + status update → **WS toast pops on second browser** — 3 min
5. **Analytics:** upload sample CSV → charts + stats → PNG export — 2 min
6. **Assistant:** ask "how many shipments are in transit?" (mock or real key) — 2 min
7. **Azure + Fabric/Voice/SharePoint docs** — 3 min
