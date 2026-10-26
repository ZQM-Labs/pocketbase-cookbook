import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const recipeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const harness = path.join(recipeRoot, "tests", "player-profile-access.test.mjs");

function runWithUrl(url, allowRemote) {
  const env = { ...process.env, PB_TEST_URL: url };
  for (const key of Object.keys(env)) {
    if (key.startsWith("PB_TEST_PLAYER_") || key.startsWith("PB_TEST_PROFILE_")) delete env[key];
  }
  delete env.PB_TEST_ALLOW_REMOTE;
  if (allowRemote) env.PB_TEST_ALLOW_REMOTE = "1";
  return spawnSync(process.execPath, [harness], { encoding: "utf8", env, timeout: 5000 });
}

test("remote hosts are refused unless explicit opt-in is set", () => {
  const result = runWithUrl("https://example.invalid", false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to target a non-local PocketBase host/);
});

test("unsupported URL schemes are refused", () => {
  const result = runWithUrl("ftp://127.0.0.1:8090", false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must use HTTP or HTTPS/);
});

test("local target passes host guard and then fails closed on missing credentials", () => {
  const result = runWithUrl("http://127.0.0.1:8090", false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Access tests require a disposable PocketBase instance/);
  assert.doesNotMatch(result.stderr, /Refusing to target a non-local PocketBase host/);
});

test("explicit remote opt-in passes host guard but still requires test credentials", () => {
  const result = runWithUrl("https://example.invalid", true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Access tests require a disposable PocketBase instance/);
  assert.doesNotMatch(result.stderr, /Refusing to target a non-local PocketBase host/);
});
