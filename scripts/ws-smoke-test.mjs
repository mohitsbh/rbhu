// WS smoke test: connect two clients with a valid JWT, update a shipment
// status and verify both receive the shipment_status_changed broadcast.
import { io } from "socket.io-client";

const API = "http://localhost:4000";

const login = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@rbhu.in", password: "Admin@12345" }),
}).then((r) => r.json());
const token = login.token;

const shipments = await fetch(`${API}/shipments`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
const target = shipments.items[0];

const events = [];
const sockets = await Promise.all(
  [1, 2].map(
    (n) =>
      new Promise((resolve, reject) => {
        const s = io(API, { auth: { token } });
        s.on("connected", () => resolve(s));
        s.on("shipment_status_changed", (e) => events.push({ n, e }));
        s.on("connect_error", reject);
        setTimeout(() => reject(new Error(`connect timeout client ${n}`)), 5000);
      }),
  ),
);

console.log(`connected ${sockets.length} WS clients`);

const newStatus = target.status === "InTransit" ? "Delivered" : "InTransit";
await fetch(`${API}/shipments/${target.id}/status`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ status: newStatus }),
});

await new Promise((r) => setTimeout(r, 800));
console.log(`broadcast events received: ${events.length}`);
for (const ev of events) {
  console.log(`  client ${ev.n}: ${ev.e.trackingNumber} ${ev.e.oldStatus} -> ${ev.e.status}`);
}
if (events.length === 2 && events.every((x) => x.e.trackingNumber === target.trackingNumber)) {
  console.log("✔ WS broadcast OK");
} else {
  console.log("✖ WS broadcast FAILED");
  process.exitCode = 1;
}
for (const s of sockets) s.disconnect();
