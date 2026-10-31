# Deployment Guide — Azure Design (Module 6)

Actual deployment is not required by the assignment, so this document is the
design of record for hosting the platform on Azure.

## 1. Target Architecture

```
                    GitHub Actions (CI/CD, OIDC → Azure)
        ┌───────────────────────────┴───────────────────────────┐
        │                                                        │
┌───────▼────────────┐  ┌───────────────────┐  ┌─────────────────▼────┐
│ App Service (web)  │  │ App Service (api) │  │ App Service/Container │
│ Node 20, B1→S1     │  │ Node 20, B2→S2    │  │ (analytics, Python)   │
│ Next.js standalone │  │ + WebSockets ON   │  │ Flex Consumption      │
└───────┬────────────┘  └───────┬───────────┘  └───────────┬──────────┘
        │                       │ VNET-integrated           │
        │                ┌──────▼───────────────────────────▼──────┐
        │                │ Private Endpoints                        │
        │                │  • Azure Database for PostgreSQL FS     │
        │                │  • Azure Key Vault                      │
        │                │  • (storage/ACR if introduced)           │
        │                └───────────────┬─────────────────────────┘
        │                                │
  SQL-less                       Secret-less runtime:
  (all data in API)              apps pull JWT_SECRET/DATABASE_URL from
                                 Key Vault via managed identity
```

## 2. Component Choices

| Concern | Decision | Notes |
|---|---|---|
| Web hosting | **Azure App Service** (Linux, Node 20) | Next.js `standalone` output; always-on; autoscale 1→3 |
| API hosting | **Azure App Service** | WebSockets enabled in platform settings; health probe `/health` |
| Analytics hosting | **App Service / Container Apps** | FastAPI in a slim container; scale independently (CPU-bound pandas) |
| Database | **Azure Database for PostgreSQL Flexible Server** | Zone-redundant HA in prod; private access; PgBouncer in transaction mode |
| AuthN | **Microsoft Entra ID** | See §3 |
| Secrets | **Azure Key Vault** | All runtime secrets; managed identity, zero creds in code |
| Networking | **VNET integration + Private Endpoints** | Public network access *disabled* on DB/KV; API egress via VNET |
| CDN/edge | Optional **Front Door** | WS affinity (cookie/sticky) required when scaling API horizontally |

## 3. Authentication — Microsoft Entra ID (design)

- Both App Services receive **system-assigned managed identities**.
- App registration `RBHU-Operations` for the SPA: authorization-code + PKCE
  flow, redirect URIs `https://<web-app>.azurewebsites.net/auth/callback`.
- Migration path from the shipped mock JWT:
  1. Issue Entra access tokens to the SPA (MSAL.js / `@azure/msal-react`).
  2. API validates tokens via `Microsoft.Identity.Web` or `jose` JWKS
     validation (issuer `login.microsoftonline.com/<tenantId>/v2.0`,
     audience = API app ID URI) instead of HS256.
  3. DB user records keyed on OID claim; roles via **app roles/enterprise app
     groups** mapped to `Admin|Staff`.
- Service-to-service (API ⇄ analytics ⇄ Graph) uses **app-only** tokens via
  managed identity + federated credentials — no client secrets required.
- The same guard interfaces (`requireAuth`) stay; only the verifier changes,
  which keeps the migration surgical.

## 4. Secrets Management (Key Vault)

- Secrets: `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`.
- Managed identity → RBAC role **Key Vault Secrets User**, secret references
  in App Settings (`@Microsoft.KeyVault(SecretUri=…)`) — App Service resolves
  natively, no SDK code path needed locally (local dev uses `.env`).
- Rotation: JWT secret quarterly (dual-key overlap for live sessions);
  OpenAI key without downtime by writing v2 before deleting v1.

## 5. Networking

- **VNET integration** for all three apps (`vnet-integration` subnet only,
  no delegation conflicts).
- **Private endpoints**: `pg-priv` (PostgreSQL FLEX), `kv-priv` (Key Vault),
  DNS via Private DNS Zones (`privatelink.postgres.database.azure.com`).
- PostgreSQL firewall locked to private access; `public_network_access = disabled`.
- Optional (design discussion): WAF on Front Door, NSG on integration subnet
  with `Allow → privatelink` and `Deny → internet` except required FQDNs via
  NAT gateway for OpenAI egress.

## 6. Deployment Strategy

| Stage | What happens |
|---|---|
| Build CI | lint + `tsc` + `next build` + `pytest`-style analytics smoke; artifact upload |
| DB migration | `prisma migrate deploy` job **before** app swap (backward-compatible-only rule) |
| Deploy | staging slot → health checked → auto-swap to production (zero-downtime) |
| Rollback | swap back to previous slot (DB migrations are forward-only; destructive migrations = expand/contract pattern) |

## 7. CI/CD Approach (GitHub Actions)

```yaml
# .github/workflows/deploy.yml (design)
jobs:
  build:        # node20: npm ci, prisma generate, build web+api, docker build analytics
  migrate:      # az postgres + prisma migrate deploy (OIDC, no secrets in repo)
  deploy-web:   # slot "staging" of App Service rbhu-web → swap
  deploy-api:   # slot "staging" of rbhu-api (WEBSITES_ENABLE_APP_SERVICE_STORAGE) → swap
  deploy-analytics: # az containerapp update --image from ACR
```

Auth from pipeline via **OIDC federation** (`azure/login@v2` with
`client-id/tenant-id/subscription-id` secrets only — no long-lived PAT/SPN keys).

## 8. Considerations

| Aspect | Handling |
|---|---|
| Scaling | API/App autoscale on CPU; DB connection pool (PgBouncer); WS sticky via Front Door |
| Backups | PG FLEX automated backups (7–35d PITR), geo-redundant in prod |
| Monitoring | Azure Monitor + App Insights (OpenTelemetry SDK in Express/FastAPI); alerts on `/health` failures, 5xx rate, WS disconnect spikes |
| DR | RPO ≤ 5 min (PITR), RTO ≤ 1 h (redeploy + repoint): IaC in Bicep repo makes env rebuild one command |
| Cost | B1/S1 Dev-Test for demo; prod S1 API (WebSockets), Flex PG B-series burstable |
