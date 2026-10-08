#!/usr/bin/env node
// Runs `go build -gcflags=-m` on go-check/escape/main.go and fails unless the
// output is exactly the three verbatim lines from the design lock §0 (the
// leading "# <pkg>" header line that -m prints is ignored).
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const escapeDir = join(root, "go-check", "escape");
const mainGoPath = join(escapeDir, "main.go");

const EXPECTED_LINES = [
  "./main.go:11:6: can inline main",
  "./main.go:6:14: leaking param: name",
  "./main.go:7:2: moved to heap: u",
];

const EXPECTED_GO_VERSION = "go1.24.4";
const goBinary = process.env.GO_BINARY || "go";

function fail(message) {
  console.error(`\ncheck:escape FAILED\n${message}\n`);
  process.exit(1);
}

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", ...options });
}

// 1. Confirm the checked-in file is gofmt-clean (tab indentation matters:
// 4-space indentation shifts the "moved to heap" column from 2 to 5).
let needsFormatting;
try {
  needsFormatting = run("gofmt", ["-l", "main.go"], { cwd: escapeDir }).trim();
} catch {
  needsFormatting = "";
}
if (needsFormatting) {
  fail(
    `go-check/escape/main.go is not gofmt-clean (${needsFormatting}). ` +
      "It must use tab indentation; 4-space indentation shifts the diagnostic column."
  );
}

// 2. Report the toolchain version actually used, warn (not fail) on mismatch
// so local runs on a different Go still work, matching CI's pinned version.
let versionOutput = "";
try {
  // Run from escapeDir so go.mod's `go 1.24.4` directive can trigger Go's
  // toolchain auto-switch (Go 1.21+) even if the system `go` is older.
  versionOutput = run(goBinary, ["version"], { cwd: escapeDir }).trim();
} catch (error) {
  fail(`could not run "${goBinary} version": ${error.message}`);
}
if (!versionOutput.includes(EXPECTED_GO_VERSION)) {
  console.warn(
    `warning: expected ${EXPECTED_GO_VERSION}, found "${versionOutput}". ` +
      "Output below may not match exactly; CI pins go1.24.4."
  );
}

// 3. Build with -gcflags=-m and capture the escape analysis diagnostics.
// spawnSync (unlike execFileSync) returns stderr even on a zero exit code.
const buildResult = spawnSync(
  goBinary,
  ["build", "-gcflags=-m", "-o", join(escapeDir, ".checkbin"), "."],
  { cwd: escapeDir, encoding: "utf8" }
);
if (buildResult.error) {
  fail(`could not run "${goBinary} build": ${buildResult.error.message}`);
}
if (buildResult.status !== 0) {
  fail(`go build exited ${buildResult.status}:\n${buildResult.stderr}`);
}
const stderr = buildResult.stderr || "";

const lines = stderr
  .split("\n")
  .map((line) => line.trimEnd())
  .filter((line) => line.length > 0);

// go prints a leading "# <package path>" header before -m diagnostics; ignore it.
const diagnosticLines = lines.filter((line) => !line.startsWith("# "));

const matches =
  diagnosticLines.length === EXPECTED_LINES.length &&
  diagnosticLines.every((line, i) => line === EXPECTED_LINES[i]);

if (!matches) {
  fail(
    "unexpected -gcflags=-m output.\n\n" +
      `expected (ignoring the "# <pkg>" header):\n${EXPECTED_LINES.join("\n")}\n\n` +
      `got:\n${diagnosticLines.join("\n") || "(no output)"}\n`
  );
}

// 4. Confirm the rendered snippet (what the UI shows) is byte-identical to
// this file, so the plaque never drifts from the program being checked.
const generatedPath = join(root, "src", "lib", "escape-source.generated.ts");
let generated;
try {
  generated = readFileSync(generatedPath, "utf8");
} catch {
  fail(
    `${generatedPath.replace(root + "/", "")} is missing. Run \`npm run generate:escape\` first.`
  );
}
const sourceLines = readFileSync(mainGoPath, "utf8").replace(/\n$/, "").split("\n");
const expectedGenerated = JSON.stringify(sourceLines, null, 2);
if (!generated.includes(expectedGenerated)) {
  fail(
    "src/lib/escape-source.generated.ts is out of date with go-check/escape/main.go. " +
      "Run `npm run generate:escape` and commit the result."
  );
}

console.log("check:escape OK — go1.24.4-verified output matches the design lock exactly:");
for (const line of diagnosticLines) console.log(`  ${line}`);
process.exit(0);
