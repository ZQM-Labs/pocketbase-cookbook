# 01 — Player authentication and private profiles

This recipe separates identity from game state and makes privacy rules explicit before the client is built. The API tests exercise a running PocketBase instance using two **disposable synthetic players**. They are intentionally opt-in and do not run in generic CI because they require a provisioned instance and credentials.

## Suggested data model

Use a dedicated auth collection named `players` and a base collection named `player_profiles`.

Suggested profile fields:

- `owner`: required relation to one `players` record; not player-editable after creation.
- `display_name`: bounded public-facing label; never use as an identity key.
- `avatar_key`: optional key for an allowlisted asset, not an arbitrary filesystem path or remote URL.
- Server-managed `created` / `updated` timestamps.

Disable public listing of player records. Keep administrator accounts separate from ordinary players; do not promote a player by accepting a client-submitted role field. Keep purchase entitlements, organizer privileges, and trusted score totals out of client-editable player fields.

## API-rule starting point

For a private `player_profiles` collection, owner-scoped list/view rules should restrict records to the authenticated owner, for example:

```text
owner = @request.auth.id
```

Treat that as a starting point, not a universal copy/paste migration. Verify the exact rule syntax and create/update semantics against the PocketBase version and actual collection schema. For create/update, test that a player cannot set or change `owner` to another player.

Do not allow player clients to create or change authoritative purchase, kit-entitlement, organizer-role, moderation, or trusted-score records. Those writes must use a server-controlled flow that validates the underlying authorization or event.

## API access tests

Requires Node.js 20+, a disposable PocketBase instance, and two synthetic accounts with one profile each. **Do not run this against production accounts or production data.**

The default names are `players` and `player_profiles`; override the collection names with environment variables if your test instance uses different names.

Start with the committed template, then fill in only synthetic test-account values:

```sh
cp .env.test.example .env.test
# Edit .env.test with credentials and IDs for the disposable test instance.
set -a
. ./.env.test
set +a
npm run test:access
```

Do not commit `.env.test`; keep it local and delete it after testing. The default URL points to a local PocketBase instance. The harness refuses non-local hosts unless you explicitly set `PB_TEST_ALLOW_REMOTE=1` for a disposable remote test instance. Never use production accounts or data.

Set these variables in your local shell or a temporary test-only secret context:

- `PB_TEST_URL`
- `PB_TEST_PLAYER_A_EMAIL`, `PB_TEST_PLAYER_A_PASSWORD`, `PB_TEST_PLAYER_A_ID`, `PB_TEST_PROFILE_A_ID`
- `PB_TEST_PLAYER_B_EMAIL`, `PB_TEST_PLAYER_B_PASSWORD`, `PB_TEST_PLAYER_B_ID`, `PB_TEST_PROFILE_B_ID`
- Optional: `PB_TEST_AUTH_COLLECTION`, `PB_TEST_PROFILE_COLLECTION`, `PB_TEST_ALLOW_REMOTE=1` (remote disposable instance only)

Run from this directory:

```sh
npm run test:access
```

The API suite verifies that unauthenticated profile listing does not disclose records, each player can read their own profile, and Player A cannot read Player B's profile. The separate `npm run test:config` suite checks the local-host default, remote-host opt-in, and unsupported URL schemes without making network requests. The API suite fails immediately if required configuration is missing; it does not silently report a skipped security test.

### Additional API cases before production

- Player A cannot create a profile owned by Player B.
- Player A cannot change their own profile's owner relation.
- Client requests cannot grant a kit, paid entitlement, organizer role, or trusted score.
- Unknown fields and unexpected payload types fail validation.
- Expired tokens and malformed record IDs fail safely.
- Repeat the suite after changing rules, schema, PocketBase version, or proxy configuration.

## Operational boundaries

- Keep the admin UI off the public internet; use a private management path.
- Use HTTPS for player traffic and restrict reverse-proxy exposure to intended public endpoints.
- Back up the database and uploaded files together, then rehearse restoration on a clean host.
- A client-side check is not authorization. A successful player-facing response does not prove a purchase or trusted score is valid.
- This recipe does not certify production readiness; retain the PocketBase version and sanitized test results with the release evidence.


## Ownership mutation check

The opt-in API harness also attempts to change Player B's profile owner using Player A's token, then verifies the persisted owner and Player B's continued read access. This catches owner reassignment even if the API returns a successful status while filtering protected fields. Run the suite only against a disposable PocketBase instance with synthetic accounts; static CI checks do not establish that a deployed instance's collection rules are correct.


The harness now also attempts to transfer Player A's own profile to Player B, then verifies that Player A remains the persisted owner. Both owner-mutation cases should be run against a disposable instance configured with the intended collection rules; a green static CI job is not a substitute for that runtime check.
