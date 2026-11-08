import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// A fixture store, so the test does not depend on the live data/verification_state.json.
// The state loader reads this path once per process, so it must be set before the import below.
const FIXTURE_SUCCESS = "2026-10-26";
const RETOOL_SUCCESS = "2026-09-25";
const RETOOL_CONTRADICTING_READ = "2026-10-18";
const fixtureDir = mkdtempSync(path.join(os.tmpdir(), "restated-confirmation-"));
const fixturePath = path.join(fixtureDir, "verification_state.json");
const record = (vendor: string, url: string, overrides: Record<string, unknown>) => ({
  vendor,
  url,
  last_attempt_at: null,
  last_outcome: null,
  last_error: null,
  failure_category: null,
  consecutive_failures: 0,
  last_success: null,
  last_read_at: null,
  quarantined_since: null,
  ...overrides,
});
writeFileSync(
  fixturePath,
  JSON.stringify({
    records: [
      record("Expo", "https://expo.dev/pricing", {
        last_attempt_at: FIXTURE_SUCCESS,
        last_outcome: "confirmed",
        last_success: FIXTURE_SUCCESS,
        last_read_at: FIXTURE_SUCCESS,
      }),
      record("Retool", "https://retool.com/pricing", {
        last_attempt_at: RETOOL_CONTRADICTING_READ,
        last_outcome: "changed",
        last_success: RETOOL_SUCCESS,
        last_read_at: RETOOL_CONTRADICTING_READ,
      }),
    ],
  }),
);
process.env.AGENTDEALS_VERIFICATION_STATE_PATH = fixturePath;

const { confirmationDate, whereOurTermsCameFrom } = await import("../dist/read-date.js");

const restatedOffer = (restatedOn: string | null, vendor = "Expo", url = "https://expo.dev/pricing") => ({
  vendor,
  url,
  verifiedDate: "2026-08-28",
  restated_from: { reading_date: "2026-08-28", source_url: url, restated_on: restatedOn },
});

describe("a restated listing is confirmed by a read after its restatement", () => {
  it("returns the later confirmation when last_success is after restated_on", () => {
    assert.strictEqual(confirmationDate(restatedOffer("2000-01-01") as any), FIXTURE_SUCCESS,
      `confirmationDate expected ${FIXTURE_SUCCESS} (last_success after restated_on), got null or another value`);
  });

  it("returns null when last_success is on or before restated_on", () => {
    assert.strictEqual(confirmationDate(restatedOffer(FIXTURE_SUCCESS) as any), null,
      `confirmationDate expected null (last_success on restated_on), got a date`);
    assert.strictEqual(confirmationDate(restatedOffer("2999-01-01") as any), null,
      `confirmationDate expected null (last_success before restated_on), got a date`);
  });

  it("returns null when there is no last_success", () => {
    const unread = restatedOffer("2000-01-01", "No Such Vendor", "https://no-such-vendor.example/pricing");
    assert.strictEqual(confirmationDate(unread as any), null,
      `confirmationDate expected null (no last_success), got a date`);
  });

  it("says the confirming read is where the terms come from, not the restatement", () => {
    assert.deepStrictEqual(whereOurTermsCameFrom(restatedOffer("2000-01-01") as any),
      { read: "a_read_that_confirmed_them", on: FIXTURE_SUCCESS });
    assert.deepStrictEqual(whereOurTermsCameFrom(restatedOffer("2999-01-01") as any),
      { read: "a_read_we_restated_them_from", on: "2026-08-28" });
  });

  it("treats a later contradicting read the way it treats a listing that was never restated", () => {
    const plain = { vendor: "Retool", url: "https://retool.com/pricing", verifiedDate: "2026-08-20" };
    assert.strictEqual(confirmationDate(plain as any), RETOOL_SUCCESS);
    assert.strictEqual(confirmationDate(restatedOffer("2026-09-20", "Retool", "https://retool.com/pricing") as any), RETOOL_SUCCESS,
      `confirmationDate expected ${RETOOL_SUCCESS} as for a never-restated listing, got a different value`);
  });
});
