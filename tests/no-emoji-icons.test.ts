import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Emoji / pictograph / dingbat / symbol ranges treated as "emoji used as UI".
// Deliberately excludes Arrows (U+2190–U+21FF) and Geometric Shapes (U+25A0–U+25FF).
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}]/u;

// Strip // line comments and /* */ block comments so emoji in comments don't count.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// Recursive walker: collects relative .tsx paths from the src directory.
function collectTsxFiles(dir: string, cwd: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(fullPath, cwd));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      // Return path relative to cwd, using forward slashes for consistency
      results.push(fullPath.slice(cwd.length + 1).replace(/\\/g, "/"));
    }
  }
  return results;
}

describe("no emoji used as UI elements", () => {
  const cwd = process.cwd();
  const srcDir = join(cwd, "src");
  const files = collectTsxFiles(srcDir, cwd);

  it("scans at least the known UI surface", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const rel of files) {
    it(`${rel} contains no emoji glyphs`, () => {
      const src = stripComments(readFileSync(join(cwd, rel), "utf8"));
      const lines = src.split("\n");
      const offenders = lines
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => EMOJI.test(line))
        .map(({ line, n }) => `  ${rel}:${n}  ${line.trim()}`);
      expect(offenders, `emoji found:\n${offenders.join("\n")}`).toHaveLength(0);
    });
  }
});
