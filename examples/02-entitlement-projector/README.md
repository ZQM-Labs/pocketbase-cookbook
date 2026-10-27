# 02 — Entitlement projector transport client

This example is a **server-side transport client**, not a PocketBase collection hook or complete entitlement integration. It calls a separately implemented trusted PocketBase endpoint. That endpoint must atomically enforce the [entitlement adapter contract](../../docs/entitlement-adapter-implementation.md): trusted identity mapping, product allowlisting, stable-key idempotency, monotonic source-version handling, and server-only writes.

## Contract

The client accepts only `projectionKey`, `orderId`, `appUserId`, `productKey`, `status`, and positive integer `sourceVersion`. Product keys must be allowlisted in server configuration. It sends a POST with a bearer token and an `Idempotency-Key` equal to the stable projection key. It requires HTTPS, except for loopback development, and applies a bounded request timeout.

The endpoint must return a JSON response with:

```json
{
  "status": "applied",
  "projectionKey": "order:ord_123:entitlement:v1",
  "sourceVersion": 1
}
```

Accepted statuses are `applied`, `already_current`, and `stale_ignored`. The endpoint may return `stale_ignored` only after confirming that a strictly newer authoritative state is already persisted. It must not use that status for a missing identity mapping, invalid payload, or failed write. A successful HTTP response alone is insufficient; the client validates the projection key and version before acknowledging delivery.

## Security requirements for the endpoint

- Authenticate a dedicated server-to-server credential; do not expose it to browser code or game bundles.
- Map `appUserId` through a trusted mapping. Never trust submitted PocketBase record IDs or infer identity from email/display name.
- Allowlist product keys and validate all fields server-side.
- Perform version comparison and persistence atomically. A read-then-write sequence without concurrency control is insufficient.
- Make duplicate delivery idempotent and reject conflicting same-version state.
- Prevent stale activation from overwriting a newer revocation.
- Return bounded, non-sensitive errors. Do not log bearer credentials or full request bodies.
- Apply rate limits and network restrictions appropriate to the server-to-server route.

The PocketBase Cookbook currently does **not** implement this endpoint, define its actual collection schema, or prove these properties against a running PocketBase server. This transport client alone must not be wired to production or treated as a complete adapter.

## Test

Requires Node.js 20+ and no network or third-party packages:

```sh
npm test
```

Tests cover request construction, HTTPS enforcement, product allowlisting, payload validation, mismatched/stale responses, and safe error classification. These are transport contract tests, not live PocketBase authorization tests.
