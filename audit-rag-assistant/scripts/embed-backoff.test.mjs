import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRetryAfterMs, rateLimitWaitMs } from "./embed.mjs";

const NOW = Date.parse("2026-08-21T19:43:31.000Z");

describe("parseRetryAfterMs", () => {
  it("returns null when the header is missing or not a wait", () => {
    assert.equal(parseRetryAfterMs(null, NOW), null);
    assert.equal(parseRetryAfterMs(undefined, NOW), null);
    assert.equal(parseRetryAfterMs("", NOW), null);
    assert.equal(parseRetryAfterMs("   ", NOW), null);
    assert.equal(parseRetryAfterMs("soon", NOW), null);
  });

  it("reads delta-seconds", () => {
    assert.equal(parseRetryAfterMs("21", NOW), 21_000);
    assert.equal(parseRetryAfterMs("0", NOW), 0);
  });

  it("reads an HTTP-date", () => {
    const header = new Date(NOW + 90_000).toUTCString();
    assert.equal(parseRetryAfterMs(header, NOW), 90_000);
  });
});

describe("rateLimitWaitMs", () => {
  it("waits a full minute on the first 429 even when Retry-After is 21s", () => {
    // The 2026-08-21 CI log waited 21s per attempt and never left the
    // free-tier window. A 21s Retry-After must not win over the floor.
    assert.equal(rateLimitWaitMs(1, "21", NOW), 60_000);
    assert.equal(rateLimitWaitMs(1, null, NOW), 60_000);
    assert.equal(rateLimitWaitMs(1, "soon", NOW), 60_000);
  });

  it("backs off and then caps", () => {
    assert.equal(rateLimitWaitMs(2, null, NOW), 120_000);
    assert.equal(rateLimitWaitMs(3, null, NOW), 180_000);
    assert.equal(rateLimitWaitMs(4, null, NOW), 180_000);
  });

  it("honors a Retry-After longer than the floor, up to the cap", () => {
    assert.equal(rateLimitWaitMs(1, "90", NOW), 90_000);
    assert.equal(rateLimitWaitMs(1, "600", NOW), 180_000);
  });
});
