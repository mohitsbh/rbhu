# Bonus 3 — SharePoint Integration (GET /announcements)

## Shipped proof of concept

`GET /announcements` (auth-protected) returns mocked intranet announcements in
the same JSON shape a SharePoint list feed would produce:

```json
{
  "items": [
    { "id": "a-001", "title": "…", "body": "…", "author": "…",
      "publishedAt": "…", "source": "sharepoint-preview" }
  ],
  "meta": { "total": 3, "source": "mock/sharepoint-preview" }
}
```

Frontend consumes it on `/announcements` exactly as a live feed would, so the
swap is connector-only.

## Production integration path (SharePoint Online)

1. **Data source** — a SharePoint list (e.g. `IntranetAnnouncements`: Title,
   Body, Author, PublishedDate, Audience) on the corporate comms site.
2. **API authentication** — Microsoft Graph `GET
   /sites/{site-id}/lists/{list-id}/items?expand=fields` with **app-only
   auth**: app registration w/ `Sites.Read.All` (restricted via
   `Sites.Selected` to that one site), certificate credential in Key Vault —
   no client secrets.
3. **Sync strategy** — prefer **pull-on-read + cache**:
   - Graph change notifications (webhook subscriptions) push "site changed"
     events into the API → cache invalidation token.
   - Announcements GET reads Redis/IMemoryCache; TTL 5 min as backstop.
4. **Mapping** — Graph item → `{id, title: fields.Title, body: fields.Body,
   author, publishedAt: fields.PublishedDate, source: 'sharepoint'}`; text
   sanitised (HTML stripped) before serving.
5. **Resilience** — if Graph is down the cache serves last-known-good and the
   API flags `meta.stale = true` instead of failing the page.

The routes file `apps/api/src/modules/announcements/routes.ts` documents this
path inline as well.
