#!/usr/bin/env node
// Derives src/lib/slices-source.generated.ts from the snippet region of
// go-check/slices/main.go (between the `// snippet:start` / `// snippet:end`
// markers), reassembled with the surrounding package/func scaffold, so the
// Slices plaque shows exactly the five statements scripts/check-slices.mjs
// runs and verifies -- never a hand-copied, possibly-drifted duplicate.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const goPath = join(root, "go-check", "slices", "main.go");
const outPath = join(root, "src", "lib", "slices-source.generated.ts");

const source = readFileSync(goPath, "utf8");
const allLines = source.split("\n");

const startIdx = allLines.findIndex((l) => l.includes("snippet:start"));
const endIdx = allLines.findIndex((l) => l.includes("snippet:end"));
if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
  console.error(`could not find snippet:start/snippet:end markers in ${goPath}`);
  process.exit(1);
}
const snippetLines = allLines.slice(startIdx + 1, endIdx);

const lines = ["package main", "", "func main() {", ...snippetLines, "}"];

const banner = `// GENERATED FILE. Do not edit by hand.
// Derived from the snippet:start/snippet:end region of
// go-check/slices/main.go by scripts/generate-slices-source.mjs.
// Run \`npm run generate:go-sources\` to refresh after editing the Go source.
`;

const body = `${banner}
export const SLICES_GO_FILE = ${JSON.stringify(goPath.replace(root + "/", ""))};

export const SLICES_SOURCE_LINES: readonly string[] = ${JSON.stringify(lines, null, 2)} as const;
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, body);
console.log(`generated ${outPath.replace(root + "/", "")} from ${goPath.replace(root + "/", "")}`);
