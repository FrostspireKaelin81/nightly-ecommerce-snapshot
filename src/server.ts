import { createServer } from "node:http";
import { z } from "zod";
import { infrai } from "./infrai.js";
import { buildSnapshot, type Order } from "./snapshot.js";

const bucket = process.env.SNAPSHOT_BUCKET ?? "nightly-ecommerce";
const orderSchema = z.object({ id: z.string().min(1), checkout: z.enum(["pending", "paid"]), fulfillment: z.enum(["queued", "shipped"]), receipt: z.string(), customerUpdate: z.string() });
const bodySchema = z.object({ orders: z.array(orderSchema) });

async function readBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

await infrai.storage.bucket.create({ name: bucket }).catch(error => { if (!String(error).includes("already")) throw error; });
const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/snapshot") { response.writeHead(404).end(); return; }
  try {
    const input = bodySchema.parse(await readBody(request));
    const snapshot = buildSnapshot(input.orders as Order[]);
    const objectKey = `snapshots/${snapshot.generatedAt.slice(0, 10)}.json`;
    const signed = await infrai.storage.object.presign(bucket, objectKey, { op: "put", expires_seconds: 900, content_type: "application/json", idempotency_key: snapshot.digest });
    const upload = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) });
    if (!upload.ok) throw new Error(`upload failed with ${upload.status}`);
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ objectKey, digest: snapshot.digest, orderCount: snapshot.orders.length }));
  } catch (error) { response.writeHead(error instanceof z.ZodError ? 400 : 500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "request failed" })); }
});
server.listen(Number(process.env.PORT ?? 3000));
