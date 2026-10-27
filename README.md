# PocketBase Cookbook

<!-- ZQM-START -->
<!-- markdownlint-disable MD033 -->
<p align="center">
  <strong>ZQM Labs</strong><br>
  <a href="https://github.com/ZQM-Labs">ZQM Labs</a>
</p>
<!-- markdownlint-enable MD033 -->
<!-- ZQM-END -->

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A **PocketBase cookbook** for game backends: player authentication, kit unlocks, leaderboards, and administration. Patterns focus on the ZQM Labs game-backend use case rather than attempting to duplicate the general PocketBase manual. Examples use synthetic accounts and placeholder values only. Never commit real player records, tokens, credentials, or production database files.

## Repository role and status

**Status:** Active, public — player-auth guidance, an opt-in API access-test harness, and CI syntax checks. CI validates the harness syntax and runs local, network-free tests for the target safety guard; it does not execute API authorization tests against a live PocketBase instance.

**What this repository is:** Practical backend patterns for game auth, entitlement checks, leaderboard integrity, and safe administration.

**What it contributes:** Part of the ZQM Labs game-development portfolio. It complements ZQM Computing's geospatial cookbook series by focusing on game identity, authorization, and backend operations.

**Quality bar:** Every pattern should name its trust boundaries, show how to test both allowed and denied requests, state its PocketBase version assumptions, and document recovery limitations. A test harness is not proof that the target server is configured correctly until it has been run against that server.

## Cross-service integration

The companion [Stripe Cookbook](https://github.com/ZQM-Labs/stripe-cookbook) handles verified payment events and durable fulfillment. The shared design boundary for paid access is documented in [Entitlement Contract v1](docs/entitlement-contract-v1.md). It specifies identity mapping, server-only entitlement writes, idempotent projection, revocation/reconciliation requirements, and the integration tests still needed. This is a design contract, **not** a deployed Stripe-to-PocketBase bridge.

## Who this is for

Game developers operating a self-hosted PocketBase backend for players, kits, and leaderboards.

## Prerequisites

- A PocketBase release pinned and recorded for the application
- A web game client that talks to the PocketBase API
- A private administrative access path; do not expose the admin UI publicly
- Two disposable synthetic player accounts and their profiles for the access-test harness

## Patterns

### 01 — Player authentication and private profiles (recipe + API harness)

[Open the player-auth recipe](examples/01-player-auth/). Covers the player/profile data model, owner-scoped access rules, client trust boundaries, cross-account denial tests, and operational limits. The optional Node.js test harness checks unauthenticated listing, own-profile access, and cross-player profile denial against a running test instance. Verify rule syntax against the exact PocketBase release before use.

### 02 — Kit unlocks (planned)

Separate public catalog metadata from authoritative entitlements. Verify purchases and access on the server; never trust client-supplied kit IDs or unlock flags.

### 03 — Leaderboards (planned)

Validate score submissions, prevent client edits to trusted totals, define tie and replay behavior, and minimize player data in public rankings.

### 04 — Admin and backups (planned)

Private administration, database-plus-upload backup consistency, versioned upgrades, and a rehearsed clean-host restore.

## Repository layout

```text
pocketbase-cookbook/
├── .github/workflows/recipe-checks.yml
├── docs/
│   └── entitlement-contract-v1.md
├── examples/
│   └── 01-player-auth/
│       ├── .env.test.example
│       ├── tests/
│       │   ├── config-guard.test.mjs
│       │   └── player-profile-access.test.mjs
│       ├── package.json
│       └── README.md
├── README.md
└── LICENSE
```

## Security principles

- Treat every browser request as attacker-controlled.
- Derive identity from authenticated server context, not submitted player IDs.
- Keep admin, entitlement, purchase, moderation, and trusted score writes server-controlled.
- Test forbidden access across separate synthetic accounts.
- Keep admin interfaces private and public API exposure minimal.
- Back up database and uploaded files together; test restoration, not just backup creation.
- Do not claim version compatibility until the recipe has been tested against that exact version.
- The opt-in API harness refuses remote hosts by default; remote disposable instances require explicit opt-in.
- Never run destructive or mutation-focused authorization tests against production accounts.

## Roadmap

1. Add an opt-in, disposable-instance integration suite for entitlement collection rules, including denied client grants, cross-player reads/writes, and revocation behavior; do not point it at production.
2. Build an executable kit-unlock flow using a server-verified entitlement boundary and the versioned [Entitlement Contract v1](docs/entitlement-contract-v1.md).
3. Add leaderboard submission rules and replay/abuse tests.
4. Add a documented backup-and-restore rehearsal for a clean host.

## How this cookbook connects to the ZQM Labs stack

PocketBase owns **player identity and server-enforced access rules** in the reference architecture. It must not infer payment truth from browser state.

| Upstream/downstream concern | Related cookbook | Boundary |
|---|---|---|
| Client behavior that calls protected APIs | [Godot Cookbook](https://github.com/ZQM-Labs/godot-cookbook) | The client may present credentials and request data; it must not choose another user's trusted identity or grant itself access. |
| Regression coverage for player flows | [Playwright Cookbook](https://github.com/ZQM-Labs/playwright-cookbook) | Browser tests validate user-visible behavior; API authorization tests remain necessary for direct requests and cross-account denial. |
| Payment verification and purchase events | [Stripe Cookbook](https://github.com/ZQM-Labs/stripe-cookbook) | Stripe webhook verification and durable order fulfillment are authoritative for payment. PocketBase access should depend on a server-controlled entitlement record, not a redirect or client flag. |

### Integration contract

Before wiring a paid entitlement into PocketBase, specify a stable internal player/customer mapping, product-to-entitlement mapping, server-only write path, idempotency strategy, revocation/refund behavior, and reconciliation procedure. Do not accept owner IDs or entitlement flags as trusted merely because they came from the game client.

The cookbooks are **separate examples, not a turnkey integration**. The current profile harness does not prove deployed collection rules, and the Stripe adapter is not production-certified. Connect them only through an explicitly documented API/data contract and validate against disposable instances with synthetic users and orders.

## Contributing

Contributions should include the target PocketBase version, a clear authorization model, allowed and denied test cases, synthetic data, and known operational limitations. Avoid vague examples that imply a client-side check protects a server resource.

Report security issues to <zqmcomputing@gmail.com> — please do not open a public issue for those.
