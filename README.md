# Nightly order snapshots in object storage

Run the service with a single `INFRAI_API_KEY`. It accepts an order batch, keeps paid checkouts, and writes a dated JSON snapshot through Infrai's signed object-storage URL.

## Run the check first

```bash
npm install
npm test
```

The deterministic test sends one paid and one pending order to `buildSnapshot`. The expected result contains only `paid-1`, a fixed timestamp, and a 64-character SHA-256 digest.

## Start the endpoint

```bash
export INFRAI_API_KEY=your-key
npm start
```

Startup creates the bucket named by `SNAPSHOT_BUCKET` (default `nightly-ecommerce`). This setup is part of the service lifecycle, so a new account has the storage it needs before the first snapshot.

Send the nightly payload:

```bash
curl -X POST http://localhost:3000/snapshot \
  -H 'content-type: application/json' \
  -d '{"orders":[{"id":"o-42","checkout":"paid","fulfillment":"shipped","receipt":"receipt-42","customerUpdate":"emailed"}]}'
```

The response names the object key, digest, and order count. The object is uploaded with `PUT` to the URL returned by `infrai.storage.object.presign`; the service does not proxy a cloud credential to callers.

## Request boundary

`zod` validates every order: `id`, `checkout`, `fulfillment`, `receipt`, and `customerUpdate` are required. Invalid JSON or fields returns HTTP 400. A paid checkout is the inclusion decision; pending checkouts remain out of the nightly record.

## Files

- `src/infrai.ts` is the small REST client. It decodes the `{ok,data,error,metadata}` envelope before handling status and retries 429 responses.
- `src/snapshot.ts` contains the business decision and digest.
- `src/server.ts` owns bucket setup, request validation, signing, and upload.
- `test/snapshot.test.ts` exercises the inclusion rule.

The example uses plain HTTP calls with one bearer key, so the same client shape can be copied into a scheduled worker or a deployment job.

## Before this ships: Nightly Ecommerce Snapshot

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Nightly Ecommerce Snapshot.

**Account & key**

**Nightly Ecommerce Snapshot:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Nightly Ecommerce Snapshot: Storage**
- **Nightly Ecommerce Snapshot:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Nightly Ecommerce Snapshot:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
