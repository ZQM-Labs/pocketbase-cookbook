"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createEntitlementProjector } = require("../entitlement-projector-client.cjs");

const valid = {
  projectionKey: "order:ord_123:entitlement:v1",
  orderId: "ord_123",
  appUserId: "user_123",
  productKey: "halloween-kit",
  status: "active",
  sourceVersion: 1,
};

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function makeProjector(fetchImpl = async () => response(200, {
  status: "applied",
  projectionKey: valid.projectionKey,
  sourceVersion: 1,
})) {
  return createEntitlementProjector({
    endpoint: "https://pb.example.test/api/zqm/entitlements/project",
    token: "synthetic-test-token-12345",
    allowedProductKeys: ["halloween-kit"],
    fetchImpl,
  });
}

test("sends a validated projection with bearer auth and stable idempotency key", async () => {
  let request;
  const project = makeProjector(async (url, options) => {
    request = { url, options };
    return response(200, { status: "applied", projectionKey: valid.projectionKey, sourceVersion: 1 });
  });
  const result = await project(valid);
  assert.equal(request.url, "https://pb.example.test/api/zqm/entitlements/project");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.authorization, "Bearer synthetic-test-token-12345");
  assert.equal(request.options.headers["idempotency-key"], valid.projectionKey);
  assert.deepEqual(JSON.parse(request.options.body), valid);
  assert.deepEqual(result, { status: "applied", projectionKey: valid.projectionKey, sourceVersion: 1 });
});

test("rejects an unallowlisted product before making a request", async () => {
  let calls = 0;
  const project = makeProjector(async () => { calls += 1; return response(200, {}); });
  await assert.rejects(project({ ...valid, productKey: "admin-role" }), /not allowlisted/);
  assert.equal(calls, 0);
});

test("rejects invalid statuses and non-positive source versions", async () => {
  const project = makeProjector();
  await assert.rejects(project({ ...valid, status: "pending" }), /status must be active or revoked/);
  await assert.rejects(project({ ...valid, sourceVersion: 0 }), /sourceVersion must be a positive integer/);
});

test("requires HTTPS except loopback development", () => {
  assert.throws(() => createEntitlementProjector({
    endpoint: "http://pb.example.test/project",
    token: "synthetic-test-token-12345",
    allowedProductKeys: ["halloween-kit"],
  }), /HTTPS/);
  assert.throws(() => createEntitlementProjector({
    endpoint: "https://user:pass@pb.example.test/project",
    token: "synthetic-test-token-12345",
    allowedProductKeys: ["halloween-kit"],
  }), /credentials/);
});

test("does not accept a response for a different projection or an older version", async () => {
  const mismatch = makeProjector(async () => response(200, {
    status: "applied", projectionKey: "somebody-elses-key", sourceVersion: 1,
  }));
  await assert.rejects(mismatch(valid), /unconfirmed state/);
  const older = makeProjector(async () => response(200, {
    status: "already_current", projectionKey: valid.projectionKey, sourceVersion: 0,
  }));
  await assert.rejects(older(valid), /unconfirmed state/);
});

test("accepts an authoritative newer version as proof the requested state is superseded", async () => {
  const project = makeProjector(async () => response(200, {
    status: "stale_ignored", projectionKey: valid.projectionKey, sourceVersion: 2,
  }));
  assert.deepEqual(await project(valid), {
    status: "stale_ignored", projectionKey: valid.projectionKey, sourceVersion: 2,
  });
});

test("classifies server failures as retryable without leaking response bodies", async () => {
  const project = makeProjector(async () => ({
    ok: false, status: 503, text: async () => "secret response body",
  }));
  await assert.rejects(project(valid), (error) => {
    assert.equal(error.code, "PROJECTOR_RETRYABLE");
    assert.equal(error.message.includes("secret response body"), false);
    return true;
  });
});

test("rejects malformed JSON responses", async () => {
  const project = makeProjector(async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad"); } }));
  await assert.rejects(project(valid), (error) => error.code === "PROJECTOR_BAD_RESPONSE");
});
