# RBHU Operations Platform

Full-stack assessment platform for RBHU ETG Pvt. Ltd. — customer management,
shipment tracking with realtime notifications, sales analytics microservice,
AI assistant, and Azure deployment design.

> **Assignment:** Technical Assessment (FSD) Modules 1–6 + all three bonus
> documents. See `docs/PRD.md` for the product requirements (incl. a
> transparent deviation register vs. the prescribed stack).

## Repository layout

| App | Path | Purpose |
|---|---|---|
| Backend API | `apps/api` | Express + TS + Prisma + PostgreSQL + Zod · REST (`/docs` Swagger) + WebSockets |
| Web frontend | `apps/web` | Next.js 15 (React + TS) — login, dashboard, customers, shipments, analytics, AI chat, announcements |
| Analytics | `apps/analytics` | Python FastAPI + pandas + Plotly (`POST /analyze`, PNG bonus) |
| Docs | `docs/` | PRD, UI plan, architecture, Azure deployment, Fabric/Voice/SharePoint bonus designs |

## Environment variables

Copy each `.env.example` → `.env` in the respective app. Full guide:

| Variable | App | Default | Notes |
|---|---|---|---|
| `PORT` | api | `4000` | HTTP + WS port |
| `DATABASE_URL` | api | `postgresql://rbhu:RbhuDemo%40123@localhost:5433/rbhu_platform?schema=public` | Prisma; `%40` = `@` |
| `JWT_SECRET` | api | – | ≥ 16 chars, required |
| `JWT_EXPIRES_IN` | api | `60m` | token lifetime |
| `CORS_ORIGINS` | api | `http://localhost:3000` | comma-separated allow-list |
| `LOG_LEVEL` | api | `info` | pino levels |
| `OPENAI_BASE_URL` | api | `https://api.openai.com/v1` | any OpenAI-compatible endpoint (OpenAI / Azure OpenAI / NVIDIA NIM / Ollama). For Azure, point at `https://<res>.openai.azure.com/openai/deployments/<deployment>` and set `OPENAI_API_VERSION` |
| `OPENAI_API_KEY` | api | *(empty)* | empty ⇒ deterministic mock answers (demo-safe) |
| `OPENAI_MODEL` | api | `gpt-4o-mini` | provider model name |
| `NEXT_PUBLIC_API_URL` | web | `http://localhost:4000` | browsers talk directly to the API |
| `NEXT_PUBLIC_ANALYTICS_URL` | web | `http://localhost:8001` | browsers upload CSVs directly |

Secrets handling: `.env` is git-ignored; production reads secrets from Azure
Key Vault via managed identity (see `docs/DEPLOYMENT.md`).

## Local setup (Windows)

```powershell
# 0) Prereqs: Node 20+, Python 3.10+
# 1) Install workspaces
npm install

# 2) Local PostgreSQL — pick ONE:
npm run db:init && npm run db:start        # portable scripts (binaries committed under .pg/)
docker compose up -d db                    # or Docker
#    (winget/EDB install also works — point DATABASE_URL at it, port 5433)

# 3) Migrate + seed demo data
npm run migrate   # once, after first prisma generate
npm run seed

# 4a) API        (http://localhost:4000 — Swagger at /docs)
npm run dev:api
# 4b) Web        (http://localhost:3000)
npm run dev:web
# 4c) Analytics  (http://localhost:8001 — OpenAPI at /docs)
cd apps/analytics; python -m venv .venv; .venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn main:app --port 8001 --reload
```

## Demo accounts (mock auth, seeded)

| User | Password | Role |
|---|---|---|
| `admin@rbhu.in` | `Admin@12345` | Admin |
| `staff@rbhu.in` | `Staff@12345` | Staff |

## API surface (Swagger: http://localhost:4000/docs)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Customers | `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id` (soft delete), `GET /customers/options` |
| Shipments | `GET/POST /shipments`, `GET/POST-… /shipments/:id`, `PATCH /shipments/:id/status`, `GET /shipments/summary`, `GET /shipments/recent` |
| Realtime | WebSocket `shipment_status_changed` broadcast on every status change |
| Chat | `POST /chat`, `GET /chat/sessions`, `GET /chat/sessions/:id/messages` |
| Analytics | `POST /analyze` (`?format=png` bonus), `GET /health` |
| Announcements | `GET /announcements` (Bonus 3) |

## Security

JWT auth · Zod validation on every write (422 with field errors) · CORS
allow-list · helmet · env validation at boot · structured logging with
redaction · Prisma migrations · soft delete (`deletedAt`) · audit fields
(`createdBy/updatedBy`) · no secret commits (`.env.example` only).

## Documentation

- [`docs/PRD.md`](docs/PRD.md) — product requirements, data model, deviations
- [`docs/UI-PLAN.md`](docs/UI-PLAN.md) — frontend plan & acceptance criteria
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, DB schema, scalability
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — **Module 6** Azure design
- [`docs/BONUS-FABRIC.md`](docs/BONUS-FABRIC.md) — Bonus 1 Fabric readiness
- [`docs/BONUS-VOICE.md`](docs/BONUS-VOICE.md) — Bonus 2 voice agent (ACS + Voice Live API)
- [`docs/BONUS-SHAREPOINT.md`](docs/BONUS-SHAREPOINT.md) — Bonus 3 SharePoint integration

## 10–15 minute walkthrough

1. Architecture & stack rationale (2 min)
2. Login → dashboard KPIs + distribution (2 min)
3. Customers: validation demo + soft delete, show DB row still present (3 min)
4. Shipments: create → status change → **WebSocket toast in second browser** → audit trail (3 min)
5. Analytics: upload `sample.csv` → charts/stats → PNG export (2 min)
6. Assistant: ask "how many shipments are in transit?" (mock, or real key) (2 min)
7. Azure/Fabric/Voice/SharePoint docs (3 min)
