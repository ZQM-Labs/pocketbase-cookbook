/**
 * Server-side transport client for the trusted PocketBase entitlement projection route.
 *
 * This client is not itself the authorization boundary. The configured endpoint must
 * atomically enforce identity mapping, allowlisted products, idempotency, and monotonic
 * source-version checks before returning an accepted response.
 */
"use strict";

const VALID_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const VALID_STATUS = new Set(["active", "revoked"]);
const ACCEPTED_RESULTS = new Set(["applied", "already_current", "stale_ignored"]);

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(name + " must be a positive integer.");
  }
  return value;
}

function validateEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("endpoint must be an absolute URL.");
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new TypeError("endpoint must use HTTPS except for loopback development.");
  }
  if (url.username || url.password || url.hash) {
    throw new TypeError("endpoint must not contain credentials or a fragment.");
  }
  return url.toString();
}

function validateProjection(input, allowedProductKeys) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("projection must be an object.");
  }
  const { projectionKey, orderId, appUserId, productKey, status, sourceVersion } = input;
  for (const [name, value] of Object.entries({ projectionKey, orderId, appUserId, productKey })) {
    if (typeof value !== "string" || !VALID_KEY.test(value)) {
      throw new TypeError(name + " has an invalid format.");
    }
  }
  if (!allowedProductKeys.has(productKey)) throw new TypeError("productKey is not allowlisted.");
  if (!VALID_STATUS.has(status)) throw new TypeError("status must be active or revoked.");
  positiveInteger(sourceVersion, "sourceVersion");
  return { projectionKey, orderId, appUserId, productKey, status, sourceVersion };
}

function createEntitlementProjector({
  endpoint,
  token,
  allowedProductKeys,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
}) {
  const target = validateEndpoint(endpoint);
  if (typeof token !== "string" || token.length < 16 || /\s/.test(token)) {
    throw new TypeError("token must be a non-empty server-side bearer credential.");
  }
  if (!Array.isArray(allowedProductKeys) || allowedProductKeys.length === 0 ||
      allowedProductKeys.some((key) => typeof key !== "string" || !VALID_KEY.test(key))) {
    throw new TypeError("allowedProductKeys must be a non-empty list of valid product keys.");
  }
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function.");
  positiveInteger(timeoutMs, "timeoutMs");
  const allowlist = new Set(allowedProductKeys);

  return async function projectEntitlement(untrustedInput) {
    const projection = validateProjection(untrustedInput, allowlist);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(target, {
        method: "POST",
        headers: {
          "authorization": "Bearer " + token,
          "content-type": "application/json",
          "idempotency-key": projection.projectionKey,
        },
        body: JSON.stringify(projection),
        signal: controller.signal,
      });
      if (!response || !response.ok) {
        const status = Number.isInteger(response?.status) ? response.status : 0;
        const error = new Error("Entitlement projection endpoint rejected the request.");
        error.code = status === 429 || status >= 500 || status === 0 ? "PROJECTOR_RETRYABLE" : "PROJECTOR_REJECTED";
        throw error;
      }
      let result;
      try {
        result = await response.json();
      } catch {
        const error = new Error("Entitlement projection endpoint returned invalid JSON.");
        error.code = "PROJECTOR_BAD_RESPONSE";
        throw error;
      }
      if (!result || !ACCEPTED_RESULTS.has(result.status) ||
          result.projectionKey !== projection.projectionKey ||
          !Number.isSafeInteger(result.sourceVersion) ||
          result.sourceVersion < projection.sourceVersion) {
        const error = new Error("Entitlement projection endpoint returned an unconfirmed state.");
        error.code = "PROJECTOR_UNCONFIRMED";
        throw error;
      }
      return {
        status: result.status,
        projectionKey: result.projectionKey,
        sourceVersion: result.sourceVersion,
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeout = new Error("Entitlement projection request timed out.");
        timeout.code = "PROJECTOR_TIMEOUT";
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

module.exports = { createEntitlementProjector };
