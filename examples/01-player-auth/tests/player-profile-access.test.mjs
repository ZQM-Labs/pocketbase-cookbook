import test from "node:test";
import assert from "node:assert/strict";

const baseUrl = process.env.PB_TEST_URL?.replace(/\/+$/, "");
if (baseUrl) {
  let target;
  try {
    target = new URL(baseUrl);
  } catch {
    throw new Error("PB_TEST_URL must be a valid absolute URL.");
  }
  if (!["http:", "https:"].includes(target.protocol)) {
    throw new Error("PB_TEST_URL must use HTTP or HTTPS.");
  }
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(target.hostname) && process.env.PB_TEST_ALLOW_REMOTE !== "1") {
    throw new Error(
      "Refusing to target a non-local PocketBase host by default. Use a disposable test instance and set PB_TEST_ALLOW_REMOTE=1 explicitly to opt in."
    );
  }
}
const collection = process.env.PB_TEST_AUTH_COLLECTION || "players";
const profiles = process.env.PB_TEST_PROFILE_COLLECTION || "player_profiles";
const required = [
  "PB_TEST_PLAYER_A_EMAIL",
  "PB_TEST_PLAYER_A_PASSWORD",
  "PB_TEST_PLAYER_A_ID",
  "PB_TEST_PROFILE_A_ID",
  "PB_TEST_PLAYER_B_EMAIL",
  "PB_TEST_PLAYER_B_PASSWORD",
  "PB_TEST_PLAYER_B_ID",
  "PB_TEST_PROFILE_B_ID",
];
const missing = required.filter((key) => !process.env[key]);
if (!baseUrl || missing.length) {
  throw new Error(
    "Access tests require a disposable PocketBase instance and environment variables. " +
    "Missing: " + [...(!baseUrl ? ["PB_TEST_URL"] : []), ...missing].join(", ")
  );
}

async function request(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}

async function authenticate(email, password) {
  const { response, data } = await request(
    `/api/collections/${encodeURIComponent(collection)}/auth-with-password`,
    { method: "POST", body: { identity: email, password } }
  );
  assert.equal(response.status, 200, "test account authentication must succeed");
  assert.equal(typeof data?.token, "string", "PocketBase auth response must include a token");
  return data.token;
}

let tokenA;
let tokenB;

test.before(async () => {
  tokenA = await authenticate(process.env.PB_TEST_PLAYER_A_EMAIL, process.env.PB_TEST_PLAYER_A_PASSWORD);
  tokenB = await authenticate(process.env.PB_TEST_PLAYER_B_EMAIL, process.env.PB_TEST_PLAYER_B_PASSWORD);
});

test("unauthenticated clients cannot read private profile records", async () => {
  const { response, data } = await request(`/api/collections/${encodeURIComponent(profiles)}/records`);
  // PocketBase may return 200 with an empty filtered result when a list rule excludes
  // unauthenticated users. Status alone is not enough to establish a data leak.
  assert.ok(
    !response.ok || (Array.isArray(data?.items) && data.items.length === 0),
    "unauthenticated list request must not disclose profile records"
  );
});

test("player A's profile list contains no other owner's records", async () => {
  const { response, data } = await request(
    `/api/collections/${encodeURIComponent(profiles)}/records`,
    { token: tokenA }
  );
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(data?.items), "PocketBase list response must contain items");
  assert.ok(
    data.items.every((profile) => profile.owner === process.env.PB_TEST_PLAYER_A_ID),
    "player A must not receive another player's profile in a list response"
  );
});

test("player A can read their own profile", async () => {
  const { response, data } = await request(
    `/api/collections/${encodeURIComponent(profiles)}/records/${encodeURIComponent(process.env.PB_TEST_PROFILE_A_ID)}`,
    { token: tokenA }
  );
  assert.equal(response.status, 200);
  assert.equal(data?.owner, process.env.PB_TEST_PLAYER_A_ID);
});

test("player A cannot read player B's profile", async () => {
  const { response } = await request(
    `/api/collections/${encodeURIComponent(profiles)}/records/${encodeURIComponent(process.env.PB_TEST_PROFILE_B_ID)}`,
    { token: tokenA }
  );
  assert.notEqual(response.status, 200, "cross-player profile read must be denied");
});

test("player B can read their own profile", async () => {
  const { response, data } = await request(
    `/api/collections/${encodeURIComponent(profiles)}/records/${encodeURIComponent(process.env.PB_TEST_PROFILE_B_ID)}`,
    { token: tokenB }
  );
  assert.equal(response.status, 200);
  assert.equal(data?.owner, process.env.PB_TEST_PLAYER_B_ID);
});


test("player A cannot reassign player B's profile ownership", async () => {
  const profilePath = `/api/collections/${encodeURIComponent(profiles)}/records/${encodeURIComponent(process.env.PB_TEST_PROFILE_B_ID)}`;
  await request(profilePath, {
    token: tokenA,
    method: "PATCH",
    body: { owner: process.env.PB_TEST_PLAYER_A_ID },
  });

  // A successful HTTP status alone is not proof that the protected field changed
  // (some APIs filter fields); verify the durable owner with the original owner.
  const { response, data } = await request(profilePath, { token: tokenB });
  assert.equal(response.status, 200, "player B must retain access to their own profile");
  assert.equal(
    data?.owner,
    process.env.PB_TEST_PLAYER_B_ID,
    "player A must not transfer ownership of player B's profile",
  );
});
