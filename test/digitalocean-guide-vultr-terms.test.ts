import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(REPO, "src", "serve.ts"), "utf8");

describe("the DigitalOcean guide states Vultr's free program and IPv4 price", () => {
  it("includes the eligibility and address terms in Vultr's comparison cell", () => {
    const row = source.match(/\{ name: "Vultr", slug: "vultr", freeTier: "([^"]+)"/);
    assert.ok(row, "Vultr comparison row exists");
    assert.match(row[1], /Free Tier Program: a free 1 vCPU, 512 MB instance for applicants Vultr admits/);
    assert.match(row[1], /\$2\.50\/mo \(IPv6 only\) or \$3\.50\/mo with IPv4/);
    assert.doesNotMatch(row[1], /cheapest VPS at \$2\.50\/mo/);
  });
});
