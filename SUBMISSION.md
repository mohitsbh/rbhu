# Submission — RBHU Full Stack Engineer Assessment

**Candidate:** Mohit
**Repository:** RBHU Operations Platform (monorepo, npm workspaces)
**Stack:** Node.js · Express · TypeScript · Prisma · PostgreSQL · Zod · React (Next.js) · TypeScript · Python (FastAPI) · pandas · Plotly · Socket.IO

> Deviations from the letter of the brief (with rationale) are listed in
> [`docs/PRD.md`](docs/PRD.md) §8. Summary: Next.js is used as the React + TS
> framework, and FastAPI replaces Flask for the analytics service (pandas/Plotly
> requirements unchanged). Prisma, Express, Zod, PostgreSQL, JWT, Redis-free
> Socket.IO fanout all follow the brief as written.

---

## Module → implementation map

| # | Requirement (PDF) | Where | Evidence |
|---|---|---|---|
| **M1** | Customer CRUD + soft delete | `apps/api/src/modules/customers/` | `POST /customers`, `GET /customers`, `GET /customers/:id`, `PATCH /customers/:id`, `DELETE /customers/:id` (soft) |
| M1 | Shipment create / status update / details | `apps/api/src/modules/shipments/` | `POST /shipments`, `PATCH /shipments/:id/status`, `GET /shipments/:id`, plus `/summary`, `/recent`, list w/ filters + pagination |
| M1 | Schemas per brief | `apps/api/prisma/schema.prisma` | Customer `name,email,company,status`; Shipment `trackingNumber,customerId,origin,destination,status` |
| M1 | Clean structure, Service/Repository | `apps/api/src/modules/*/{routes,service,repository,schemas}.ts` | Every module split into route → service → repository |
| M1 | Exception handling, logging | `apps/api/src/middleware/errors.ts`, `src/lib/logger.ts` | Typed `AppError`s → consistent JSON; pino structured logs + morgan access log |
| M1 | Env config, Swagger, migrations | `apps/api/src/env.ts`, `/docs`, `prisma/migrations/` | Validated env at boot; Swagger UI at `:4000/docs`; committed SQL migrations |
| **M2** | Login (mock auth) | `apps/web/src/app/login/` | JWT login against API; demo accounts in README |
| M2 | Dashboard: totals + status distribution | `apps/web/src/app/(app)/dashboard/` | KPI cards + Recharts pie of shipment statuses + recent shipments (live via WS) |
| M2 | Customer list / add / edit | `apps/web/src/app/(app)/customers/` | TanStack Query + react-hook-form + Zod; error boundaries + retry |
| M2 | Shipment list / create / update status | `apps/web/src/app/(app)/shipments/` | Filters, pagination, status dialog; WS-driven refresh |
| M2 | Responsive, reusable, validation, errors | `apps/web/src/components/ui.tsx` | Shared UI kit, skeletons, toasts, error banners |
| **M3** | `POST /analyze` (CSV in) | `apps/analytics/main.py` | Multipart CSV; returns revenue-by-region + top-salespeople Plotly charts + summary stats |
| M3 | Bonus: Kaleido PNG export | `apps/analytics/main.py` | `pngExport: true` in `/health`; chart PNGs in response |
| **M4** | `POST /chat` + history + graceful errors | `apps/api/src/modules/chat/` | Sessions + messages persisted in Postgres; history windowed; provider failure returns friendly reply and preserves history |
| M4 | Prompt engineering + response quality | `apps/api/src/modules/chat/service.ts` | Fixed persona system prompt, authoritative DB-grounded state block, anti-hallucination rule, reasoning-token budget (`max_tokens=1000`, `enable_thinking:false`) |
| M4 | Provider | `apps/api/.env` | OpenAI-compatible adapter — currently NVIDIA NIM (`provider: live` verified); mock fallback when no key |
| **M5** | WebSocket `shipment_status_changed` to all clients | `apps/api/src/ws/server.ts`, `src/modules/shipments/event-bus.ts` | Socket.IO broadcast on status change; smoke test `scripts/ws-smoke-test.mjs` (2 clients received event); scalability notes in ARCHITECTURE §4 |
| **M6** | Architecture diagram, deployment strategy, security, CI/CD | `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md` | ASCII diagrams, App Service / Azure PG / Entra ID / Key Vault / VNET + private endpoints, GitHub Actions OIDC pipeline design |
| **Sec** | JWT / Zod / CORS / env / secrets / soft delete / audit | API middlewares + schema | `requireAuth`, `validate(zodSchema)` on all writes, CORS allow-list, `.env` git-ignored, `deletedAt` + `createdAt/updatedAt/createdBy/updatedBy` |
| **B1** | Fabric readiness design | `docs/BONUS-FABRIC.md` | Sync architecture, data flow, reporting options |
| **B2** | Voice agent design | `docs/BONUS-VOICE.md` | ACS + Azure Voice Live pipeline, shipment query integration |
| **B3** | `GET /announcements` PoC + SharePoint integration | `apps/api/src/modules/announcements/`, `docs/BONUS-SHAREPOINT.md` | Mocked intranet announcements; Graph API integration path documented |

## Documentation deliverables

- [x] README (root) — overview, layout, setup, demo accounts, API surface, walkthrough
- [x] Setup instructions — README "Local setup" (portable PostgreSQL path included)
- [x] Environment variable guide — README "Environment variables" + `apps/api/.env.example`, `apps/analytics/.env.example`
- [x] Architecture diagram — `docs/ARCHITECTURE.md` §1 (system) and §4 (realtime flow)
- [x] Database schema — `docs/ARCHITECTURE.md` §3 + `apps/api/prisma/schema.prisma` + migrations
- [x] API documentation — Swagger UI `http://localhost:4000/docs` (OpenAPI at `/openapi.json`), analytics OpenAPI at `:8001/docs`
- [x] Deployment guide — `docs/DEPLOYMENT.md`
- [x] 10–15 minute walkthrough outline — README "10-15 minute walkthrough"

## Demo accounts (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@rbhu.in` | `Admin@12345` |
| Staff | `staff@rbhu.in` | `Staff@12345` |

## One-command verification

```powershell
# API health (db status included)
curl http://localhost:4000/health

# Analytics (PNG export capability)
curl http://localhost:8001/health

# Realtime fanout (two clients, one status change)
node scripts/ws-smoke-test.mjs
```

## Known limitations (honest scope)

- Mock JWT auth (per brief "mock equivalent"); Entra ID integration is documented, not deployed.
- Analytics uploads are processed in-memory; no persistence layer (brief does not require one).
- Real-time fanout is single-instance Socket.IO; horizontal scaling via Redis adapter is described in ARCHITECTURE §4 but not provisioned.
- Actual Azure deployment not performed (optional per brief); design docs are complete.
