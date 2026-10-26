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

A **PocketBase cookbook** for game backends: player auth, kit unlocks, leaderboards, and admin. Patterns are written for the Labs slice of PocketBase — the game backend plane behind web location games — not as a generic PocketBase manual. It is intended for game developers running a small self-hosted backend for players. Validate each pattern against your own backend, PocketBase version, and operating environment before adopting it. Examples use synthetic players and placeholder credentials only, never real player data.

## Repository role and status

**Status:** Active, public — seeding. Pattern passes land in follow-up work; the table below lists what is planned, not what is already written.

**What this repository is:** PocketBase patterns for game backends — auth, unlocks, leaderboards, and admin.

**What it contributes:** Part of the ZQM Labs game-development portfolio, and a sibling to the ZQM Computing geospatial cookbook series.

**Standing:** This repository is maintained independently. Automated checks cover only the paths and environments configured in its workflows; they do not establish production readiness or operational certification.

## Who this is for

Game developers running a small self-hosted backend for players, kits, and leaderboards.

## Prerequisites

- PocketBase (version pinned per pattern at fill time)
- A web game client that talks to the PocketBase API
- Admin access kept private: localhost or tailnet-only bindings, never a public admin panel with default credentials

## Patterns (planned)

| # | Example | What it will demonstrate |
|---|---------|--------------------------|
| 01 | `01-player-auth` | Player accounts and auth rules with least-privilege collections |
| 02 | `02-kit-unlock` | Kit records, access codes, and unlock checks for purchased content |
| 03 | `03-leaderboard` | Per-kit leaderboards with score submission rules |
| 04 | `04-admin-backups` | Admin-only access, backups, and safe upgrade practice |

## Repository layout

```text
pocketbase-cookbook/
├── examples/  # one directory per pattern
├── README.md
└── LICENSE
```

## Roadmap

- First pattern pass: player auth (01), then kit unlock (02)
- Second pass: leaderboards (03) and admin/backups (04)

## Contributing

A contributing guide lands with the first pattern pass. Report security issues to <zqmcomputing@gmail.com> — please do not open a public issue for those.
