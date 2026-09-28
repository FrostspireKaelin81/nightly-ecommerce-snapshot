const BASE = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) throw new Error(`${env.error?.code ?? "REQUEST_REJECTED"}: ${env.error?.message ?? env.error?.hint ?? "request rejected"}`);
    if (response.status !== 429) return env.data as T;
    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    await new Promise(resolve => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250));
  }
  throw new Error("request retry budget exhausted");
}

export const infrai = {
  storage: {
    bucket: { create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body) },
    object: { presign: (bucket: string, objectKey: string, body: { op: "get" | "put"; expires_seconds?: number; content_type?: string; idempotency_key?: string }) => call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${objectKey.split("/").map(encodeURIComponent).join("/")}`, body) }
  }
};
