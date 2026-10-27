# PocketBase entitlement adapter implementation contract

**Status:** implementation specification; no Stripe-to-PocketBase adapter or production authorization has been verified by this document.

This document turns the shared [Entitlement Contract v1](entitlement-contract-v1.md) into an actionable PocketBase-side acceptance contract. It deliberately does not prescribe a PocketBase hook or collection migration until the application pins its PocketBase release, chooses its authoritative identity mapping, and supplies a disposable test instance.

## Scope boundary for the current Lantern product

The current Lantern backend schema is kit/event-scoped and does not define a `players` collection or trusted player-identity mapping. The current paid-kit fulfillment service delivers an approved artifact through a private download URL; it is not an entitlement projection worker. Therefore, the `player` relation below is a **future-product design requirement**, not an instruction to add a guessed `players` collection or infer identity from purchaser email, team name, access code, or a client-supplied record ID.

Before implementation, record an explicit product decision choosing between (a) the existing kit/order/download model and its separately reviewed admin provisioning process, or (b) a new hosted per-player entitlement model. Only option (b) should proceed with this adapter specification, after identity mapping, PocketBase collection/auth design, and ownership semantics are approved. Do not enable writes or production access as part of this documentation change.

## Security boundary

- Stripe's verified webhook and the Stripe-side PostgreSQL transaction remain the payment authority.
- The adapter is server-to-server only. Player clients must not create, list, view, update, or delete paid-entitlement records.
- Do not put a PocketBase superuser token, password, or API credential in browser code, game bundles, logs, or this repository.
- Resolve the Stripe-side `app_user_id` through an explicit, trusted mapping to a PocketBase `players` record. Never infer identity from email, display name, submitted player ID, or an arbitrary client field.
- Allowlist `product_key` values and accepted statuses server-side. Reject unknown contract versions, missing mappings, malformed identifiers, and unsupported status transitions.
- A success redirect, client request, or outbox row alone is not proof that a player can access content.

## Logical projection record

The implementation may use a PocketBase collection or an equivalent server-controlled data model, but it must preserve these logical fields:

| Field | Requirement |
| --- | --- |
| `external_key` | Required, unique stable key matching the outbox projection identity; retries update the same logical record. |
| `player` | Relation to the mapped PocketBase player record; resolved by trusted server code. |
| `product_key` | Server-allowlisted entitlement key. |
| `status` | Only `active` or `revoked`; writable only by trusted server processing. |
| `source_version` | Positive monotonic integer for that entitlement identity. |
| `contract_version` | Explicit contract version; initially `1`, separate from the source-state version. |
| `source_order_id` | Stable internal order reference for audit/reconciliation; no payment secret or unnecessary card data. |
| `source_updated_at` | Server-generated update time for diagnostics; not a substitute for monotonic version checks. |

Do not assume Stripe's `app_user_id` is a PocketBase record ID. Keep the mapping explicit and reject missing or ambiguous mappings.

## Monotonic state and idempotency

1. Treat `external_key` as the unique logical entitlement identity, not as a per-attempt delivery ID.
2. Apply an incoming projection only when its `source_version` is greater than the stored version, or when it is an exact idempotent replay with the same version and same authoritative state.
3. Reject or quarantine a same-version payload that disagrees with the stored product, player, or status.
4. Ignore/reject an older version; in particular, a delayed `active` retry must never overwrite a later `revoked` state.
5. Increment `source_version` in the authoritative store whenever entitlement state changes. `contract_version` is a schema/contract version and must not be used as the changing state sequence.
6. Only acknowledge delivery after the adapter has confirmed that the target is at the requested or a newer compatible authoritative version.
7. If PocketBase commits but the network response is lost, a retry must converge to the same record without duplication or state regression.

The current Stripe Cookbook sample creates the initial activation projection at source version `1`. Later revocation, refund, dispute, subscription, or reactivation behavior requires explicit authoritative state transitions and policy; it must not be inferred from this initial purchase example.

## Access rules and server credentials

Before implementing the collection:

- Pin the PocketBase version and test the exact collection rule semantics.
- Deny player-client list/view/create/update/delete access to entitlement records unless the application has a specifically reviewed read-only access design. Hiding a UI element is not authorization.
- Prevent clients from changing roles, player relations, product keys, statuses, source versions, and entitlement ownership through profile updates or alternate API paths.
- Keep administrative credentials server-side, use the least privileged supported server access pattern, restrict network access where possible, and rotate credentials only through an explicitly reviewed operational procedure.
- Do not make a paid-content authorization decision solely from client-cached state. The server must consult authoritative state or a projection whose freshness and failure behavior are defined.

## Required disposable-instance tests

Run against a pinned, disposable PocketBase instance using synthetic players and products only. Generic CI syntax checks are not evidence that these cases pass against a running server.

| Case | Expected result |
| --- | --- |
| Unauthenticated client reads entitlement collection | Denied |
| Player A lists or reads Player B's entitlement | Denied unless a reviewed public-read requirement explicitly applies; paid entitlement details should default to private |
| Player client creates an entitlement | Denied |
| Player client changes `status`, `product_key`, `player`, or `source_version` | Denied |
| Trusted adapter submits valid first activation | One active record created |
| Same projection delivered repeatedly | Same record; no duplicate |
| Same version, conflicting status or owner | Rejected and observable |
| Older activation arrives after newer revocation | Older state rejected; entitlement remains revoked |
| PocketBase commits but response times out | Retry converges without duplicate or reactivation |
| Internal identity mapping is missing or ambiguous | Rejected; no entitlement granted |
| Product key or contract version is unsupported | Rejected |
| Revocation projection succeeds | Access is denied by the authoritative access check |
| Adapter is unavailable | Durable outbox remains retryable; no client-side fallback grants access |
| Reconciliation finds paid-but-unprojected state | Actionable discrepancy is reported without silently granting from untrusted data |

Tests must verify both allowed and denied behavior, inspect resulting database state, and clean up synthetic records. A failed authorization assertion must fail the test suite rather than be reported as a skip.

## Reconciliation and operations

The integration is not complete without a repeatable reconciliation process that compares authoritative Stripe-side entitlement state against PocketBase projections and reports at least:

- fulfilled orders with no matching projection;
- projections with missing or mismatched identity/product mapping;
- stale source versions or status disagreement;
- duplicate logical entitlements;
- dead-lettered or over-age outbox entries;
- revoked authoritative entitlements still projected as active.

Reconciliation should be dry-run by default, emit stable record identifiers and bounded error codes, and require explicit review before destructive repairs. Safe replay uses the existing stable projection key and authoritative current state; it must not replay stale event payloads blindly.

## Completion gate

Do not describe the integration as implemented or production-ready until the adapter, access rules, identity mapping, version checks, failure recovery, and reconciliation have all been exercised against a disposable instance and their exact results recorded. This specification itself proves none of those runtime properties.
