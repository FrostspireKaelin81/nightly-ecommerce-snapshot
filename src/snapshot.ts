import { createHash } from "node:crypto";

export type Order = { id: string; checkout: "pending" | "paid"; fulfillment: "queued" | "shipped"; receipt: string; customerUpdate: string };
export type Snapshot = { generatedAt: string; orders: Order[]; digest: string };

export function buildSnapshot(orders: Order[], now = new Date("2026-01-01T00:00:00.000Z")): Snapshot {
  const included = orders.filter(order => order.checkout === "paid");
  const payload = JSON.stringify(included);
  return { generatedAt: now.toISOString(), orders: included, digest: createHash("sha256").update(payload).digest("hex") };
}
