import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PROVIDER ENFORCEMENT (mandatory). The Razorpay SDK may be imported ONLY
 * inside src/lib/payments/providers/*. Any other importer breaks the
 * provider boundary the future Route migration depends on. This test is the
 * CI gate.
 */

const SRC = join(process.cwd(), "src");
const PROVIDERS_DIR = join("lib", "payments", "providers"); // allowed location (OS-native sep)

// static `from "razorpay"`, dynamic `import("razorpay")`, or `require("razorpay")`,
// including subpath imports like "razorpay/dist/...".
const RAZORPAY_IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']razorpay(?:\/[^"']*)?["']/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("provider boundary", () => {
  const files = walk(SRC);

  it("(6) no Razorpay SDK import outside lib/payments/providers/*", () => {
    const offenders = files.filter(
      (f) => !f.includes(PROVIDERS_DIR) && RAZORPAY_IMPORT.test(readFileSync(f, "utf8")),
    );
    expect(offenders, `Razorpay SDK imported outside the providers directory:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the scan is meaningful — the SDK IS imported inside the providers dir", () => {
    const inProviders = files.filter(
      (f) => f.includes(PROVIDERS_DIR) && RAZORPAY_IMPORT.test(readFileSync(f, "utf8")),
    );
    expect(inProviders.length).toBeGreaterThan(0);
  });
});
