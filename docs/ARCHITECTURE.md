# Architecture — RBHU Operations Platform

## 1. System Overview

```
┌─────────────────────┐        ┌──────────────────────────┐
│  apps/web (Next.js) │ REST   │  apps/api (Express+TS)   │
│  React 19 / TS      │ ◀────▶ │  JWT · Zod · Swagger     │
│  TanStack Query     │   WS   │  Service/Repository      │
└─────────┬───────────┘ ◀─────┼──────┬─────────┬─────────┘
          │ multipart CSV     │      │ Prisma  │ eventBus
          ▼                   ▼      ▼         ▼
┌─────────────────────┐  ┌────────────────┐  ┌──────────────────┐
│ apps/analytics      │  │ PostgreSQL 16  │  │ Socket.IO fanout │
│ FastAPI·pandas      │  │ Prisma Migrate │  │ to all clients   │
│ plotly(+kaleido)    │  └────────────────┘  └──────────────────┘
└─────────┬───────────┘
          │ provider-agnostic OpenAI-compatible adapter
          ▼  (OpenAI / Azure OpenAI / NVIDIA NIM / mock fallback)
```

Three deployable units, one monorepo (npm workspaces). The API is the single
gateway for data; the analytics service is independently scalable and stateless.

## 2. Project Structure

```
apps/
  api/                # Express + TypeScript + Prisma + Zod (Module 1)
    src/
      env.ts          # zod-validated environment config (fail fast at boot)
      app.ts          # middleware assembly (helmet, cors, morgan, routes)
      index.ts        # http server + websocket init + graceful shutdown
      lib/            # prisma client singleton, pino logger
      middleware/     # auth (JWT), validate (Zod), errors (typed domain errors)
      modules/
        auth/         # schemas • service • routes
        customers/    # schemas • repository • service • routes
        shipments/    # schemas • repository • service • routes • event-bus
        chat/         # schemas • service (LLM adapter) • routes
        announcements/ # mocked SharePoint feed (Bonus 3)
      ws/server.ts    # Socket.IO: JWT handshake auth + event fanout
      openapi.ts      # OpenAPI contract served at /docs
    prisma/           # schema.prisma • migrations • seed.ts
  web/                # Next.js 15 (React+TS) app router (Module 2)
    src/app/(app)/    # dashboard, customers, shipments, analytics, assistant, announcements
    src/components/   # ui primitives + form modals
    src/lib/          # axios client, zod schemas, auth context, WS notifications
  analytics/          # FastAPI microservice (Module 3): main.py, sample.csv
docs/                 # PRD, UI plan, this file, deployment, bonus designs
scripts/              # portable PostgreSQL init/start/stop (Windows)
```

### Layering rules (evaluation focus: service/repository pattern)

- `repository` — Prisma access only, selected columns (never raw model leak),
  transactions for multi-step invariants.
- `service` — business rules, uniqueness checks, domain exceptions
  (`NotFound/Conflict/Unauthorized`), emits domain events.
- `routes` — HTTP shape only: parse params, delegate, map to status codes.
- `middleware` — cross-cutting: JWT guard, Zod validation, global error
  rendering (consistent `{ error, code, statusCode, details? }`).

## 3. Database Schema

```
Customer(id, name, email, company, status ENUM, createdAt, updatedAt,
         deletedAt, createdBy, updatedBy)
  ↳ partial unique (email, company, deletedAt) — duplicates among live rows only
Shipment(id, trackingNumber UNIQUE, customerId → Customer, origin,
         destination, status ENUM, createdAt, updatedAt, deletedAt,
         createdBy, updatedBy)
ShipmentEvent(id, shipmentId → Shipment, fromStatus, toStatus, createdAt, actor)
User(id, email UNIQUE, passwordHash, name, role ENUM, createdAt)
ChatSession(id, userId → User, title, createdAt, updatedAt)
ChatMessage(id, sessionId → ChatSession, role, content, createdAt)
```

- **Soft delete** — `deletedAt` timestamp; all reads filter it; deletes never
  lose history (audit + analytics remain valid).
- **Audit fields** — `createdBy/updatedBy` take the JWT principal's email.
- **Status audit** — every status transition (incl. creation) writes a
  `ShipmentEvent` in the same transaction as the mutation.
- **Migrations** — `prisma migrate` (SQL reviewed in `apps/api/prisma/migrations`).

## 4. Realtime Flow (Module 5)

```
PATCH /shipments/:id/status
  → shipmentService.updateStatus()
     → prisma.$transaction( update + ShipmentEvent )
     → eventBus.publish(shipment_status_changed)
        → ws/server.ts subscriber → io.emit(...)
           → every connected client's toast + React Query cache invalidation
```

The event bus is interface-compatible with Redis pub/sub; swapping the
in-memory implementation for `ioredis` is the only change needed to scale the
API horizontally (Socket.IO then adds the Redis adapter; App Service/Web
PubSub are the managed alternatives — see DEPLOYMENT.md).

## 5. AI Assistant Flow (Module 4)

1. `POST /chat { message, sessionId? }`
2. new or owned session resolved → user message persisted
3. last 12 messages loaded as context
4. generation:
   - **live** — one adapter covers OpenAI (`base_url` default), Azure OpenAI
     (`…/openai/deployments/…` + `api-version`), NVIDIA NIM, Ollama — all
     OpenAI-compatible; 20s timeout, non-200 mapped to friendly error string.
   - **mock** *(no key configured)* — deterministic answers grounded in live
     DB counts (customers, shipment summaries, recent trackings).
5. reply persisted; provider label (`live|mock|error`) returned to the UI.

Prompt engineering: role-fixed system prompt, grounding instructions
("never invent numbers; answer only from CURRENT PLATFORM STATE"), scope
statement (read-only assistant), word-budget for concise replies.

## 6. Security Posture

| Control | Implementation |
|---|---|
| Auth | JWT bearer (HS256, 60m, issuer checked); WS handshake auth |
| AuthZ | `requireAuth` on all business routers; `requireRole` available |
| Validation | Zod on every mutating endpoint + env config + query params |
| CORS | allow-list from `CORS_ORIGINS`; unknown origins denied, not crashed |
| Headers | helmet (CSP-friendly defaults, x-powered-by disabled) |
| Logging | pino, structured; `authorization`, `password*` redacted |
| Config | env validated at boot; `.env` git-ignored; `.env.example` documented |
| Errors | no stack traces or Prisma internals leaked to clients |
| DB | Prisma migrations; partial unique indexes; soft delete |

## 7. Scalability Approach

- **Stateless API** (all state in Postgres/sockets) → App Service scale-out.
- **WS fanout** — in-memory bus now, Redis pub/sub + Socket.IO adapter for
  multi-instance; or Azure Web PubSub as a managed escape hatch.
- **DB** — connection pooling (PgBouncer on Azure), indexed hot paths
  (status, customerId, deletedAt partial), pagination everywhere.
- **Analytics** — CPU-bound pandas work is isolated in its own process; scale
  container independently of the API; can move queue-based for huge CSVs.
- **AI adapter** — provider outage degrades to mock/context answers, never
  unavailability.
