import test from "node:test";
import assert from "node:assert/strict";

const baseUrl = process.env.PB_TEST_URL?.replace(/\/+$/, "");
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

test("unauthenticated clients cannot list private profiles", async () => {
  const { response } = await request(`/api/collections/${encodeURIComponent(profiles)}/records`);
  assert.notEqual(response.status, 200, "private profile list must not be public");
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
