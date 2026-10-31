# UI Plan — RBHU Operations Platform (Next.js + TypeScript + Tailwind)

Companion to `docs/PRD.md`. This is the build contract for the frontend before code is written.

## 1. Stack & Foundations

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | React + TS as required by PDF |
| Styling | Tailwind CSS | Utility-first, fast, professional |
| State/server data | TanStack Query (React Query) | Cache, refetch, mutations; "state management" requirement |
| Auth state | Context + localStorage-backed token | Axios interceptor injects JWT |
| Forms & validation | react-hook-form + Zod | Same schema shapes as API; inline field errors |
| Charts | Recharts (dashboard donut) | Plotly charts come pre-rendered as specs from Analytics service; web renders them via react-plotly if trivial, else static summary table + Recharts |
| Realtime | `socket.io-client` / native WS to API `/ws` | Toast on `shipment_status_changed` |

Design tokens: RBHU professional theme — deep indigo (`#1e1b4b`) accents, slate neutrals, white cards, 8px spacing grid, rounded-xl cards, subtle shadows. Fully responsive (mobile-first for lists; tables collapse to stacked cards under `md`).

## 2. Route Map

| Route | Screen | Auth? |
|---|---|---|
| `/login` | Login | No (redirects if token valid) |
| `/dashboard` | KPIs + status distribution | Yes |
| `/customers` | Customer list + create/edit modal | Yes |
| `/shipments` | Shipment list + create modal + inline status update | Yes |
| `/assistant` | AI chat | Yes |
| `/announcements` | Intranet announcements (Bonus 3 surfacing) | Yes |

Shared shell (`/(app)` layout): top bar (logo, notifications bell, user menu → logout), left sidebar nav (Dashboard, Customers, Shipments, Assistant, Announcements), content area. Guard: server-side check on token presence → redirect `/login`.

## 3. Screen Specs

### 3.1 Login
- Centered card: RBHU wordmark, email + password (RHF + Zod), "Sign in" button with loading state.
- Error banner on 401 ("Invalid email or password"). Hint box with demo credentials (reviewer convenience).
- On success → store token → `/dashboard`.

### 3.2 Dashboard (`/dashboard`)
- **KPI row (3 cards):** Total Customers (Active), Total Shipments, Shipments in Transit.
- **Status distribution:** donut chart (Recharts) with legend + counts.
- **Recent shipments table** (latest 5, live-updating — WS triggers refetch).
- Data source: `GET /shipments/summary` + counts; React Query polling 30s + WS invalidation.

### 3.3 Customers (`/customers`)
- Header: search box (debounced `?q=`), status filter dropdown, "Add Customer" button.
- **Table:** Name, Company, Email, Status badge (Green Active / Gray Inactive), Actions (Edit, Soft Delete).
- **Pagination** footer (page × limit from API).
- **Add/Edit modal:** name*, company, email*, status select; Zod validation mirrors API; server errors mapped to field errors (e.g., duplicate email).
- **Delete:** confirmation dialog ("This soft-deletes the customer"); optimistic close + toast; row filtered out.

### 3.4 Shipments (`/shipments`)
- Header: status filter tabs (All/Pending/InTransit/Delivered/Cancelled), "Create Shipment" button.
- **Table:** Tracking #, Customer, Origin → Destination (route chip), Status badge with color coding, Created, Actions.
- **Create modal:** customer picker (searchable select from `/customers`), tracking#*, origin*, destination*.
- **Status update:** inline dropdown/badge action → `PATCH /shipments/:id/status` → optimistic update + WS event also arrives (dedupe via event id) → toast "RBHU-00123 → Delivered".
- Row click → details drawer: status history timeline from `GET /shipments/:id` (audit trail showcase).

### 3.5 Assistant (`/assistant`)
- Chat layout: session list sidebar (new chat button), message thread, composer with send button + disabled state while streaming/loading.
- Bubbles: user right (indigo), assistant left (slate); timestamps.
- Session persistence via `GET /chat/:sessionId/messages` on load; chat history maintained server-side per PRD.
- Friendly inline error card on provider failure, with "Retry" action (graceful error handling showcased).

### 3.6 Announcements (`/announcements`)
- Card list from `GET /announcements`: title, body, author, publishedAt; ribbon noting "SharePoint-integrated (preview design in docs)".

## 4. Reusable Component Inventory

`Button`, `Input`, `Select`, `Textarea`, `FormField` (label + error + hint), `Modal`, `ConfirmDialog`, `Drawer`, `Table` (generic + paginated), `StatusBadge` (shipment status colors), `KPICard`, `DonutChart`, `Toast` + `ToastProvider`, `EmptyState`, `Spinner`, `ErrorBanner`, `AppShell` (sidebar + topbar), `Navbar`, `UserMenu`, `NotificationBell` (WS-driven).

## 5. Cross-Cutting Behaviors

1. **API client:** single `apiClient` (axios) — baseURL from env, JWT interceptor, 401 → clear token → redirect `/login`.
2. **Error handling:** every mutation → toast (success/error) via React Query callbacks; queries → ErrorBanner with retry.
3. **Loading:** skeletons on tables/cards; button spinners on submit.
4. **WS integration:** connect once after login (token in query string at upgrade); on `shipment_status_changed` → toast + `queryClient.invalidateQueries` (shipments, summary). Reconnect with backoff.
5. **Form validation:** Zod schemas in `lib/schemas.ts`; required fields marked; `aria-invalid` + error text.
6. **Responsive:** sidebar → hamburger drawer under `lg`; tables → stacked key/value cards under `md`; KPI row single column on mobile.
7. **Accessibility:** labels, roles, focus rings, keyboard-closable modals (Esc), aria-live toasts.

## 6. Files to Create (frontend)

```
apps/web/
  src/app/(app)/layout.tsx          protected shell + guard
  src/app/(app)/dashboard/page.tsx
  src/app/(app)/customers/page.tsx
  src/app/(app)/shipments/page.tsx
  src/app/(app)/assistant/page.tsx
  src/app/(app)/announcements/page.tsx
  src/app/login/page.tsx
  src/components/ui/*               (component inventory above)
  src/components/{CustomerFormModal,ShipmentFormModal,StatusUpdate,NotificationBell}
  src/lib/{api,schemas,ws,auth-context,use-notifications}.ts
  src/hooks/use-toast.ts
```

## 7. Acceptance Criteria (UI)

- [ ] Login with demo creds lands on dashboard in <1s (mock data already seeded)
- [ ] All module flows operable end-to-end with zero console errors
- [ ] Second browser receives WS toast when shipment status changes in first
- [ ] Zod rejects bad forms client-side *and* API errors surface as field/toast
- [ ] Layout usable at 360px and 1920px widths
