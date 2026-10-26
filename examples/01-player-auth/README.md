# 01 — Player authentication and private profiles

This pattern separates identity from game state and makes privacy rules explicit before the client is built. It is a configuration recipe, not a drop-in migration: confirm rule syntax and collection field types against the exact PocketBase release pinned by your deployment.

## Threat model

Assume every browser request can be modified by a player. A client-supplied player ID, kit ID, score, purchase state, or role is not proof of authorization. Use PocketBase's authenticated request context and server-controlled records to decide access.

## Suggested data model

### Built-in auth collection: `players`

Use a dedicated auth collection for player accounts. Keep administrator accounts separate from ordinary player accounts; do not promote a player by accepting a client-submitted role field.

- Allow only the registration and authentication flows the game actually needs.
- Disable public listing of player records.
- Keep email visibility and verification requirements intentional.
- Do not put purchase entitlements, organizer privileges, or trusted score totals in client-editable player fields.
- Configure password reset, verification, and rate limits for the pinned PocketBase version.

### Base collection: `player_profiles`

Suggested fields:

- `owner`: required relation to one `players` record; not user-editable after creation.
- `display_name`: bounded public-facing label; do not use it as an identity key.
- `avatar_key`: optional key for an allowlisted asset, not an arbitrary filesystem path or remote URL.
- `created` / `updated`: server-managed timestamps.

Avoid storing precise location histories or unnecessary personal information in a profile.

## API-rule starting point

PocketBase API rules control which records a request may access. For a private `player_profiles` collection, use owner-scoped list/view rules equivalent to:

```text
owner = @request.auth.id
```

For create/update, enforce both of these invariants:

1. The authenticated player is the profile owner.
2. The request cannot set or change `owner` to another player.

The exact create/update expression depends on the pinned PocketBase version and how the client submits partial updates. Test both omitted and tampered `owner` values. Do not copy a rule into production without verifying its behavior against the actual version and collection schema.

For collections that represent purchases, kit entitlements, trusted scores, moderation actions, or organizer roles, **do not allow the player client to create or change authoritative records**. Write them only through a server-controlled flow that validates the purchase, organizer authority, or score submission.

## Access-control checklist

- Unauthenticated requests cannot list or read private profiles.
- Player A cannot read, update, or delete Player B's profile.
- Player A cannot create a profile owned by Player B.
- Player A cannot change their own profile's owner relation.
- Client requests cannot grant themselves a kit, paid entitlement, organizer role, or trusted score.
- Unknown fields and unexpected payload types fail validation.
- Rate-limited auth and recovery endpoints behave as configured.
- Rules are tested through the API using separate synthetic accounts, not only by clicking around in the admin UI.

## Verification procedure

1. Pin and record the exact PocketBase release.
2. Create two disposable test accounts, Player A and Player B, and one profile for each.
3. Use authenticated API requests to exercise every checklist case above.
4. Repeat with no auth token, an expired token, a malformed record ID, a forged owner ID, and an unexpected field.
5. Save sanitized test results and the PocketBase version with the recipe. Never commit tokens, live records, or database files.
6. Re-run the tests after changing collection fields, API rules, PocketBase versions, or reverse-proxy configuration.

## Operational boundaries

- Keep the admin UI off the public internet; use a private management path.
- Use HTTPS for player traffic and restrict reverse-proxy exposure to intended public endpoints.
- Back up the database and uploaded files together, and rehearse restoration separately from an upgrade.
- A client-side check is not authorization. A successful response from a player-facing endpoint does not prove that a paid entitlement or trusted score is valid.
- This pattern does not establish production readiness until the version-specific rules and API tests pass in the target environment.
