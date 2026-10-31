// Demo seed: mock auth users + sample customers & shipments + saved prisma
// migration history. Run with: npm run seed --workspace apps/api
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function tracking(i: number) {
  return `RBHU-${String(i).padStart(5, "0")}`;
}

async function main() {
  // ---- Users (mock authentication per assignment) ----
  const users = [
    { email: "admin@rbhu.in", name: "Admin User", role: "Admin" as const, password: "Admin@12345" },
    { email: "staff@rbhu.in", name: "Staff User", role: "Staff" as const, password: "Staff@12345" },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: await bcrypt.hash(u.password, 10),
      },
    });
  }
  console.log("seeded users:", users.map((u) => `  ${u.email} / ${u.password}`).join("\n"));

  // ---- Demo customer customer - replace with plain string
  const customerCount = await prisma.customer.count({ where: { deletedAt: null } });
  let customerId = customerCount
    ? (await prisma.customer.findFirst({ where: { deletedAt: null }, select: { id: true } }))!.id
    : null;

  if (!customerId) {
    const created = await prisma.customer.create({
      data: {
        name: "Demo Customer",
        email: "ops@acmecargo.in",
        company: "Acme Cargo Pvt Ltd",
        status: "Active",
        createdBy: "seed",
      },
      select: { id: true },
    });
    customerId = created.id;
  }

  // ---- Demo shipments (idempotent) ----
  const names = ["Shard-person", undefined];
  void names;
  const demoShipments: Array<{
    origin: string;
    destination: string;
    status: "Pending" | "InTransit" | "Delivered" | "Cancelled";
  }> = [
    { origin: "Seawoods, Navi Mumbai", destination: "Pune HUB", status: "Delivered" },
    { origin: "JNPT Port", destination: "Mumbai Airport", status: "InTransit" },
    { origin: "Chennai Port", destination: "Bengaluru DC", status: "InTransit" },
    { origin: "Nashik", destination: "Seawoods", status: "Pending" },
    { origin: "Nashik", destination: "Pune HUB", status: "Pending" },
  ];

  let next = (await prisma.shipment.findFirst({ orderBy: { createdAt: "desc" }, select: { trackingNumber: true } }))?.trackingNumber;
  let n = next ? parseInt(next.split("-")[1]!, 10) : 0;

  for (const s of demoShipments) {
    const t = tracking(++n);
    const exists = await prisma.shipment.findUnique({ where: { trackingNumber: t }, select: { id: true } });
    if (exists) continue;
    const created = await prisma.shipment.create({
      data: {
        trackingNumber: t,
        customerId: customerId!,
        origin: s.origin,
        destination: s.destination,
        status: s.status,
        createdBy: "seed",
      },
    });
    if (s.status !== "Pending") {
      await prisma.shipmentEvent.create({
        data: { shipmentId: created.id, fromStatus: null, toStatus: "Pending", actor: "seed" },
      });
      await prisma.shipmentEvent.create({
        data: { shipmentId: created.id, fromStatus: "Pending", toStatus: s.status, actor: "seed" },
      });
    } else {
      await prisma.shipmentEvent.create({
        data: { shipmentId: created.id, fromStatus: null, toStatus: "Pending", actor: "seed" },
      });
    }
  }
}

main()
  .then(() => {
    console.log("✔ seed done");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
