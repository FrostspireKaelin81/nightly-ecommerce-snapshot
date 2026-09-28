import assert from "node:assert/strict";
import { buildSnapshot } from "../src/snapshot.js";

const result = buildSnapshot([
  { id: "paid-1", checkout: "paid", fulfillment: "shipped", receipt: "r1", customerUpdate: "sent" },
  { id: "pending-1", checkout: "pending", fulfillment: "queued", receipt: "r2", customerUpdate: "waiting" }
]);
assert.deepEqual(result.orders.map(order => order.id), ["paid-1"]);
assert.equal(result.generatedAt, "2026-01-01T00:00:00.000Z");
assert.equal(result.digest.length, 64);
console.log("snapshot decision test passed");
