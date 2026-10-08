#!/usr/bin/env node
// Derives src/lib/escape-source.generated.ts from go-check/escape/main.go so the
// UI always renders the exact program the escape-output check compiles against.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const goPath = join(root, "go-check", "escape", "main.go");
const outPath = join(root, "src", "lib", "escape-source.generated.ts");

const source = readFileSync(goPath, "utf8");
const lines = source.replace(/\n$/, "").split("\n");

const banner = `// GENERATED FILE. Do not edit by hand.
// Derived from go-check/escape/main.go by scripts/generate-escape-source.mjs.
// Run \`npm run generate:escape\` to refresh after editing the Go source.
`;

const body = `${banner}
export const ESCAPE_GO_FILE = ${JSON.stringify(goPath.replace(root + "/", ""))};

export const ESCAPE_SOURCE_LINES: readonly string[] = ${JSON.stringify(lines, null, 2)} as const;
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, body);
console.log(`generated ${outPath.replace(root + "/", "")} from ${goPath.replace(root + "/", "")}`);
