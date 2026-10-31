// Bonus 3 – GET /announcements proof-of-concept.
//
// Today: mocked intranet announcements (same JSON shape a SharePoint list
// would produce). Production integration path (documented in
// docs/BONUS-SHAREPOINT.md): SharePoint Online list via Microsoft Graph
// (`/sites/{site-id}/lists/{list-id}/items?expand=fields`), app-only Entra ID
// auth with certificate credentials, webhook subscriptions for change
// notifications, and a Redis/App-Service cache with TTL because intranet
// content is read-mostly.
import { Router } from "express";

export const announcementsRouter = Router();

const MOCK_ANNOUNCEMENTS = [
  {
    id: "a-001",
    title: "Quarterly town hall – Oct 6",
    body: "Join the leadership team for a Q business review in the Seawoods break room and via Teams. Bring questions for the logistics ops AMA.",
    author: "Nisha Singh (HR)",
    publishedAt: "2026-10-02T09:30:00.000Z",
    source: "sharepoint-preview",
  },
  {
    id: "a-002",
    title: "New shipment SLA dashboards",
    body: "The ops dashboard now shows realtime shipment status distribution posted by the eng team. Login with your RBHU account.",
    author: "Engineering",
    publishedAt: "2026-09-24T14:00:00.000Z",
    source: "sharepoint-preview",
  },
  {
    id: "a-003",
    title: "Navi Mumbai office maintenance",
    body: "Tower-02 lift maintenance on Sat 08:00–12:00. Use Tower-01 entrance; badge access unchanged.",
    author: "Facilities",
    publishedAt: "2026-09-18T11:15:00.000Z",
    source: "sharepoint-preview",
  },
];

announcementsRouter.get(
  "/announcements",
  async (_req, res) => {
    res.json({
      items: MOCK_ANNOUNCEMENTS,
      meta: { total: MOCK_ANNOUNCEMENTS.length, source: "mock/sharepoint-preview" },
    });
  },
);
