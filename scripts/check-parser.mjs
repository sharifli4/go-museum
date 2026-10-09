#!/usr/bin/env node
// Parses go-check/parser/main.go with the real go/parser + go/ast (via
// astdump) and asserts every AST node name the Parser/AST plaque claims
// (lock §0: "Parser node names ... are the ones go/ast and go/scanner
// actually produce for that file") really appears in that output.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PARSER_AST_NODES, astDumpLine } from "../src/lib/parser-ast-nodes.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const parserDir = join(root, "go-check", "parser");
const goBinary = process.env.GO_BINARY || "go";

function fail(message) {
  console.error(`\ncheck:parser FAILED\n${message}\n`);
  process.exit(1);
}

const fmtResult = spawnSync("gofmt", ["-l", "main.go"], { cwd: parserDir, encoding: "utf8" });
if ((fmtResult.stdout || "").trim()) {
  fail(`go-check/parser/main.go is not gofmt-clean (${fmtResult.stdout.trim()}).`);
}

const result = spawnSync(goBinary, ["run", "./astdump", "main.go"], {
  cwd: parserDir,
  encoding: "utf8",
});
if (result.error) {
  fail(`could not run "${goBinary} run ./astdump": ${result.error.message}`);
}
if (result.status !== 0) {
  fail(`astdump exited ${result.status}:\n${result.stderr}`);
}

const output = result.stdout;
const lines = output
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

// Every node name/detail the museum renders (diagram labels + the
// go/ast · <Node> tooling line, from the single shared list in
// src/lib/parser-ast-nodes.mjs) must be a line astdump actually printed
// from the real parse -- never invented.
const REQUIRED_LINES = PARSER_AST_NODES.map(astDumpLine);

const missing = REQUIRED_LINES.filter((want) => !lines.includes(want));
if (missing.length > 0) {
  fail(
    "astdump's real go/ast output is missing lines the museum relies on:\n" +
      missing.map((m) => `  - ${m}`).join("\n") +
      `\n\nfull astdump output:\n${output}`
  );
}

console.log("check:parser OK — every rendered go/ast node name is real, verified output:");
for (const line of lines) console.log(`  ${line}`);
process.exit(0);
