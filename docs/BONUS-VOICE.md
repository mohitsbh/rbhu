# Bonus 2 — Voice Agent Architecture

A phone-call-first agent for shipment status inquiries. Caller dials the RBHU
number, asks in natural language, and hears their shipment status in seconds.

## 1. Recommended architecture

```
Caller ──PSTN──▶ Azure Communication Services (ACS: Call Automation)
                     │  call answered via Event Grid → /call webhook (this API)
                     ▼
              Azure Voice Live API (speech↔text loop)
                • ASR: streaming speech-to-text (multi-language en/hi/mr)
                • LLM: provider-agnostic adapter (same as /chat service)
                  — tool-calling with shipment tools
                • TTS: neural voice response
                     │            │
             tools/RPC          DTmf/transfer
                     ▼                 ▼
        shipmentRepository lookup    Escalate to human agent
        (RBHU internal, private)     (ACS Rooms → staff Teams)
```

### Components

1. **Call ingress — ACS Call Automation**: provisioned number, Event Grid
   triggers `POST /voice/calls` on our API; Call Automation answers, streams
   audio to the Voice Live API session, records consent notice.
2. **Speech loop — Azure Voice Live API**: manages ASR → LLM → TTS round-trip
   with barge-in handling; we supply the system prompt + tools.
3. **Agent brain — existing LLM adapter**: the same provider-agnostic
   OpenAI-compatible interface as `/chat`, with **tool/function calling**:
   - `lookup_shipment(tracking_or_phone)` → `shipmentRepository.find…`
   - `summarize_shipment(id)` → status + ETA + last event timestamp
   - `open_ticket(reason)` → follow-up record for staff callbacks
4. **Data plane**: private endpoint access only; VNET-injected App Service.
   PII stays in Azure; calls are logged as `ShipmentEvent`-adjacent audit
   records ( transcripts stored in Blob, TTL-based purge).

## 2. Data flow & call lifecycle

1. `CallConnected` (Event Grid) → create session, speak greeting/meta prompt.
2. ASR transcript → LLM plan → tool call (e.g. lookup by ANI = caller phone,
   or spoken tracking number with number-normalisation regex).
3. Tool result → templated spoken answer + confirm ("Anything else?").
4. `CallDisconnected` → session summarized into `ChatSession/ChatMessage`
   (same tables as the chat assistant, `channel='voice'`).
5. Hot-transfer: DTMF '0' or explicit request → ACS Rooms transfer with
   context payload to an agent.

## 3. Design considerations

| Aspect | Decision |
|---|---|
| Failure | If ASR/LLM fails: fallback replay ("sorry, system busy") + auto-ticket; never dead-air |
| Identity | Caller verified by ANI + optional OTP via ACS out-bound SMS for account actions |
| Security | No PII in ACS media; transcripts encrypted at rest; audit fields as in the platform DB |
| Latency | Voice Live (realtime API) keeps round trips sub-second; tools call local DB (no external auth round-trips) |
| Scale | Media sessions are WebSocket sessions in App Service/Container Apps — same WebSocket scale-out pattern as Module 5 |
| Analytics | Voice events also feed Fabric Real-Time Hub (see BONUS-FABRIC.md) for aggregate ops dashboards |
