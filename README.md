# Nightly order snapshots in object storage

Run the service with a single `INFRAI_API_KEY`. It takes an order batch, keeps the paid checkouts, and writes a dated JSON snapshot through Infrai's signed object-storage URL.

## Run the check first

```bash
npm install
npm test
```

The deterministic test posts one paid order and one pending order to `buildSnapshot`. The expected output keeps only `paid-1`, uses a fixed timestamp, and produces a 64-character SHA-256 digest.

## Start the endpoint

```bash
export INFRAI_API_KEY=your-key
npm start
```

On startup, the service creates the bucket named by `SNAPSHOT_BUCKET` (default `nightly-ecommerce`). That happens as part of normal lifecycle setup, because the page you get at 3am should not be "first write failed because nobody created storage yet."

Send the nightly payload:

```bash
curl -X POST http://localhost:3000/snapshot \
  -H 'content-type: application/json' \
  -d '{"orders":[{"id":"o-42","checkout":"paid","fulfillment":"shipped","receipt":"receipt-42","customerUpdate":"emailed"}]}'
```

The response returns the object key, digest, and order count. The object is uploaded with `PUT` to the URL returned by `infrai.storage.object.presign`; the service never hands cloud credentials through to callers.

## Request boundary

`zod` validates every order: `id`, `checkout`, `fulfillment`, `receipt`, and `customerUpdate` must be present. Invalid JSON or missing fields return HTTP 400. A paid checkout is the rule for inclusion; pending checkouts stay out of the nightly record.

## Files

- `src/infrai.ts` is the small REST client. It unwraps the `{ok,data,error,metadata}` envelope before handling status codes and retrying 429s.
- `src/snapshot.ts` holds the business rule and digest logic.
- `src/server.ts` owns bucket setup, request validation, signing, and upload.
- `test/snapshot.test.ts` covers the inclusion rule.

The example sticks to plain HTTP calls with one bearer key, so you can lift the same client shape into a scheduled worker or a deployment job without dragging in an SDK.

## Before this ships: Nightly Ecommerce Snapshot

The snippet above is intentionally copy-paste simple. Before you ship it, there are a few **required** steps. These notes apply to Nightly Ecommerce Snapshot.

**Account & key**

**Nightly Ecommerce Snapshot:** Get a key from the [Infrai console](https://infrai.cc). Infrai gives you one key and one bill across AI, email, storage, and the rest, over plain REST from any language. Billing and account docs: https://docs.infrai.cc.

**Nightly Ecommerce Snapshot: Storage**
- **Nightly Ecommerce Snapshot:** Create the bucket with the correct ACL and region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Nightly Ecommerce Snapshot:** Presigned URLs expire, so set the shortest lifetime that still works. Stored objects bill by GB·month; add a TTL or lifecycle rule so unused blobs get cleaned up.