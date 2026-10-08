#!/usr/bin/env node
// Runs go-check/slices/main.go (`go run .`) and asserts its printed facts
// match lock §0 exactly: a and b end len 3 cap 3 sharing storage, c ends
// len 6 cap 6 on a new array, and append never retargets b. Machine-checks
// the facts the Slices plaque renders instead of trusting them by hand.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const slicesDir = join(root, "go-check", "slices");
const goBinary = process.env.GO_BINARY || "go";

function fail(message) {
  console.error(`\ncheck:slices FAILED\n${message}\n`);
  process.exit(1);
}

const fmtResult = spawnSync("gofmt", ["-l", "main.go"], { cwd: slicesDir, encoding: "utf8" });
if ((fmtResult.stdout || "").trim()) {
  fail(`go-check/slices/main.go is not gofmt-clean (${fmtResult.stdout.trim()}).`);
}

const result = spawnSync(goBinary, ["run", "."], { cwd: slicesDir, encoding: "utf8" });
if (result.error) {
  fail(`could not run "${goBinary} run .": ${result.error.message}`);
}
if (result.status !== 0) {
  fail(`go run exited ${result.status}:\n${result.stderr}`);
}

const output = result.stdout;
const parsed = {};
for (const line of output.split("\n")) {
  const m = line.match(/^(\w+) len=(\d+) cap=(\d+) vals=\[([^\]]*)\]$/);
  if (m) {
    parsed[m[1]] = { len: Number(m[2]), cap: Number(m[3]), vals: m[4].split(/\s+/).filter(Boolean).map(Number) };
    continue;
  }
  const b = line.match(/^(a0_eq_b0|a0_eq_c0)=(true|false)$/);
  if (b) parsed[b[1]] = b[2] === "true";
}

const EXPECTED = {
  a: { len: 3, cap: 3, vals: [9, 2, 4] },
  b: { len: 3, cap: 3, vals: [9, 2, 4] },
  c: { len: 6, cap: 6, vals: [9, 2, 4, 5, 6, 7] },
  a0_eq_b0: true, // a and b share storage: &a[0] == &b[0]
  a0_eq_c0: false, // c got a new array: &a[0] != &c[0]
};

const errors = [];
for (const key of ["a", "b", "c"]) {
  const got = parsed[key];
  const want = EXPECTED[key];
  if (!got) {
    errors.push(`missing output for ${key}`);
    continue;
  }
  if (got.len !== want.len || got.cap !== want.cap || got.vals.join(",") !== want.vals.join(",")) {
    errors.push(
      `${key}: got len=${got.len} cap=${got.cap} vals=[${got.vals.join(" ")}], ` +
        `want len=${want.len} cap=${want.cap} vals=[${want.vals.join(" ")}]`
    );
  }
}
for (const key of ["a0_eq_b0", "a0_eq_c0"]) {
  if (parsed[key] !== EXPECTED[key]) {
    errors.push(`${key}: got ${parsed[key]}, want ${EXPECTED[key]}`);
  }
}

if (errors.length > 0) {
  fail(`unexpected runtime facts:\n${errors.map((e) => `  - ${e}`).join("\n")}\n\nfull output:\n${output}`);
}

console.log("check:slices OK — verified runtime facts match the design lock exactly:");
console.log(output.trimEnd());
process.exit(0);
