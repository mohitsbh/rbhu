# Bonus 1 — Microsoft Fabric Readiness

Goal: keep the operational database as the transactional source of truth while
making platform data continuously available for analytics in Microsoft Fabric.

## 1. Short answer

PostgreSQL Flexible Server supports **native mid-cast replication to Fabric
OneLake (mirroring)**. If mirroring were unavailable for the target PG tier,
the contract/fallback path is a change-data-capture pipeline through Event
Hubs → Fabric Activator/Eventstream. Both paths land data as Delta tables in
OneLake, which every Fabric engine (Warehouse, Lakehouse SQL, Spark, Data
Factory, Power BI, Real-Time Hub) can query without additional ETL.

## 2. Recommended architecture & data flow

```
PostgreSQL (source of truth)
   │  Mirror-to-Fabric / logical replication (WAL)
   ▼
Fabric OneLake (mirrored DB = read-only Delta tables)
   ├── Lakehouse: rbhu_lake       (customers, shipments + events, chat)
   ├── Warehouse: rbhu_dw         (curated star schema, optional)
   ├── Real-Time Hub: shipment_status_changed (Eventstream from API)
   │        ▼
   │   Eventhouse (KQL) for realtime ops dashboards
   └── Direct Lake semantic model ⇄ Power BI (no import/refresh needed)
```

- **Transactional data (mirror path)**: `Customer`, `Shipment`,
  `ShipmentEvent`, `ChatMessage` mirrored continuously — ~exact replication,
  no code changes in the API.
- **Semantic additions**, shipped by scheduled **Data Pipeline/Notebook**:
  - `fact_shipment_lifecycle`: one row per shipment with days-in-each-status,
    final status, customer dim key.
  - `dim_customer` + `f_shipment` star schema in the Warehouse.
- **Event path**: the API already publishes `shipment_status_changed` through
  an event-bus abstraction; a Fabric Eventstream consumer with an Azure
  Event Hubs endpoint is a *connector-only* addition that feeds the
  Real-Time Hub without touching business code.

## 3. Reporting & analytics possibilities

| Question | Fabric surface |
|---|---|
| SLA % per region/route | Warehouse SQL + Power BI Direct Lake |
| Customer 360 (revenue, shipments, activity) | Lakehouse notebook → semantic model |
| Live ops board (in-transit watchlist) | Eventhouse KQL dashboard from events |
| Carrier/region revenue trend | Power BI paginated export for finance |
| AI Q&A on ops data | Fabric Copilot over the semantic model |

## 4. Governance

- OneLake is segregated per workspace; ops/finance/analytics get RBAC'd workspaces.
- PII (customer email) restricted at the mirror or in OneLake views with
  dynamic row/column masking; Purview labels applied on export paths.
- Cost control: mirroring is incremental; drop the chat mirror if unused.
