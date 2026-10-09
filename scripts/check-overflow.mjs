#!/usr/bin/env node
// Automated regression guard for the class of bug PR 2.1's visual audit
// found: nominal SVG font-sizes get bumped (e.g. for lock §10's >=11px
// floor) without widening the boxes/plates/cards the text sits in, so the
// rendered text silently spills past its container.
//
// Boots a production server (reusing an existing `.next` build if present,
// building one otherwise), then for the overview and every step of all
// three parts, at both 1280x800 and 1024x700, walks every visible <text>
// in the active SVG and -- for every text whose rendered bbox starts
// inside some sibling <rect> ("plate/box/card" pattern: a solid fill, not
// a decorative url(#...) texture, with a visible stroke) -- asserts the
// text's full bbox stays inside that rect's bbox. Texts with no such
// containing rect (section labels, balloon numbers, callouts) are free
// labels and are not checked.
//
// Usage: npm run check:overflow
// CI: runs headless via Playwright's bundled Chromium; no system browser
// or display server needed. If this ever can't run in your CI image
// (e.g. a locked-down sandbox that blocks spawning a Next.js server),
// run it locally before merging instead -- `npm run build && npm run
// check:overflow` -- since it is otherwise self-contained.
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.CHECK_OVERFLOW_PORT || 4319);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OTHER_TOLERANCE = 2; // px of slop for anti-aliasing/font-metric rounding

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1024, height: 700 },
];
const PARTS = ["parser", "escape", "slices"];
const TOTAL_STEPS = 9;
// SVG text getBBox() includes a few px of font-metric ascent padding above
// the visible glyph that every hand-tuned box already accounts for, so the
// top edge needs a looser tolerance than the other three (confirmed empty
// on a clean run: left/right/bottom overflows are never positive by a
// couple of px the way top readings are).
const TOP_TOLERANCE = 4.5;
// A "plate/box/card" must be reasonably label-sized, not a big background
// container (the heap tank, the stack column, a housing panel) that a
// nearby balloon or callout's text might merely start inside of.
const MAX_PLATE_AREA = 16000;

function fail(message) {
  console.error(`\ncheck:overflow FAILED\n${message}\n`);
  process.exit(1);
}

function hasBuild() {
  return existsSync(join(root, ".next", "BUILD_ID"));
}

function killPort() {
  // Defensive: a prior run that errored out before its `finally` could
  // run leaves an orphaned `next-server` grandchild (reparented to pid 1;
  // `npx`/`next start`, the process this script actually spawns and can
  // kill, is just its short-lived parent) bound to PORT, serving a build
  // from before this run's source edits -- silently making every check
  // below pass or fail against stale code. `lsof -i`/`-ti` cannot see
  // this (confirmed in this sandbox: a real listener on PORT that
  // `lsof -ti:PORT` reports nothing for) and no `fuser` is installed, so
  // this matches by process name instead, which is sandbox-agnostic. It
  // is deliberately broad (any `next-server`/`next start`/`next dev` on
  // the box, not just on PORT, since the port can't be used as a filter
  // here) -- fine for this script's own throwaway check server, but if
  // you have an unrelated Next.js dev server running locally while
  // running this, expect it to also get killed; just restart it after.
  for (const pattern of ["next-server", "npx next start", "npx next dev"]) {
    try {
      execSync(`pkill -9 -f "${pattern}"`, { stdio: "ignore" });
    } catch {
      // pkill exits non-zero when it finds nothing to kill; that's fine.
    }
  }
}

function startServer() {
  killPort();
  return new Promise((resolve, reject) => {
    const useBuild = hasBuild();
    const args = useBuild
      ? ["next", "start", "-p", String(PORT)]
      : ["next", "dev", "-p", String(PORT)];
    console.log(`check:overflow: starting ${useBuild ? "production" : "dev"} server on :${PORT}...`);
    const child = spawn("npx", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: true });
    let settled = false;
    const onData = (data) => {
      const text = data.toString();
      if (!settled && /ready|started server/i.test(text)) {
        settled = true;
        resolve(child);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!settled) reject(new Error(`server exited early (code ${code})`));
    });
    // Fallback: if neither log line matched within 20s, try connecting anyway.
    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(child);
      }
    }, 20000);
  });
}

async function waitForServer(page, retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await page.goto(BASE_URL, { timeout: 2000 });
      if (res && res.ok()) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${BASE_URL} never became ready`);
}

/**
 * Runs in-page. For every visible <text> in `rootSelector`'s SVG, finds the
 * nearest sibling <rect> (checked at the text's own parent, then one level
 * up) that is a solid-fill, stroked "plate/box/card" (not a decorative
 * url(#...) texture) and whose bbox contains the text's start point. If
 * found, asserts the text's full bbox is inside that rect's bbox.
 */
function collectOverflows({ rootSelector, sceneLabel, topTolerance, otherTolerance, maxPlateArea }) {
  const svg = document.querySelector(rootSelector);
  if (!svg) return [{ scene: sceneLabel, error: `no element matched ${rootSelector}` }];

  function isPlateRect(rect, rectBox) {
    const fill = rect.getAttribute("fill") || "";
    const stroke = rect.getAttribute("stroke") || "";
    if (!fill || fill === "none" || fill.startsWith("url(")) return false;
    if (!stroke || stroke === "none") return false;
    if (rectBox.width * rectBox.height > maxPlateArea) return false;
    return true;
  }

  function bboxOf(el) {
    const b = el.getBBox();
    return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.x + b.width, bottom: b.y + b.height };
  }

  function containsPoint(box, x, y) {
    return x >= box.x && x <= box.right && y >= box.y && y <= box.bottom;
  }

  const texts = [...svg.querySelectorAll("text")];
  const results = [];

  for (const text of texts) {
    if (!text.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const content = (text.textContent || "").trim();
    if (!content) continue;

    const textBox = bboxOf(text);
    // Anchor point: the text's own (pre-anchor) rendered start, robust to
    // text-anchor start/middle/end since getBBox() already reflects it.
    const anchorX = textBox.x + textBox.width / 2;
    const anchorY = textBox.y + textBox.height / 2;

    const candidateParents = [text.parentElement, text.parentElement?.parentElement].filter(Boolean);
    let bestRect = null;
    let bestArea = Infinity;
    for (const parent of candidateParents) {
      const rects = parent.querySelectorAll(":scope > rect");
      for (const rect of rects) {
        const rectBox = bboxOf(rect);
        if (!isPlateRect(rect, rectBox)) continue;
        if (!containsPoint(rectBox, anchorX, anchorY)) continue;
        const area = rectBox.width * rectBox.height;
        if (area < bestArea) {
          bestArea = area;
          bestRect = rectBox;
        }
      }
      if (bestRect) break; // prefer the immediate parent's own rects
    }

    if (!bestRect) continue; // free-floating label; nothing to check

    const overflowLeft = bestRect.x - textBox.x;
    const overflowRight = textBox.right - bestRect.right;
    const overflowTop = bestRect.y - textBox.y;
    const overflowBottom = textBox.bottom - bestRect.bottom;
    const overflows =
      overflowLeft > otherTolerance ||
      overflowRight > otherTolerance ||
      overflowTop > topTolerance ||
      overflowBottom > otherTolerance;

    if (overflows) {
      results.push({
        scene: sceneLabel,
        text: content,
        textBox,
        parentBox: bestRect,
        overflowLeft: Math.round(overflowLeft * 10) / 10,
        overflowRight: Math.round(overflowRight * 10) / 10,
        overflowTop: Math.round(overflowTop * 10) / 10,
        overflowBottom: Math.round(overflowBottom * 10) / 10,
      });
    }
  }
  return results;
}

async function checkScene(page, rootSelector, sceneLabel) {
  return page.evaluate(collectOverflows, {
    rootSelector,
    sceneLabel,
    topTolerance: TOP_TOLERANCE,
    otherTolerance: OTHER_TOLERANCE,
    maxPlateArea: MAX_PLATE_AREA,
  });
}

async function run() {
  const server = await startServer();
  let browser;
  const allFailures = [];
  let scenesChecked = 0;

  try {
    browser = await chromium.launch();
    const probe = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await waitForServer(probe);
    await probe.close();

    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport });
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);

      const sceneTag = `${viewport.width}x${viewport.height}`;

      // Overview.
      const overviewResults = await checkScene(page, ".ov-sheet svg", `${sceneTag} overview`);
      allFailures.push(...overviewResults);
      scenesChecked++;

      // Every step of every part.
      for (const part of PARTS) {
        await page.evaluate(
          (id) => document.querySelector(`#part-${id}`)?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
          part
        );
        await page.waitForTimeout(700);
        for (let step = 1; step <= TOTAL_STEPS; step++) {
          await page.keyboard.press(String(step));
          await page.waitForTimeout(120);
          const results = await checkScene(page, ".diagram svg", `${sceneTag} ${part} step${step}`);
          allFailures.push(...results);
          scenesChecked++;
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(700);
      }

      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    try {
      // `detached: true` gave the server its own process group (pgid ==
      // its own pid); killing that whole group reaches the real
      // `next-server` grandchild too, not just the `npx` wrapper. Belt
      // and suspenders: killPort() below catches it by name regardless.
      process.kill(-server.pid, "SIGKILL");
    } catch {
      server.kill();
    }
    killPort();
  }

  if (allFailures.length > 0) {
    const lines = allFailures.map((f) => {
      if (f.error) return `  [${f.scene}] ${f.error}`;
      return (
        `  [${f.scene}] "${f.text}" overflows its box by ` +
        `L${f.overflowLeft} R${f.overflowRight} T${f.overflowTop} B${f.overflowBottom} ` +
        `(text ${JSON.stringify(f.textBox)} vs box ${JSON.stringify(f.parentBox)})`
      );
    });
    fail(`${allFailures.length} text(s) overflow their box across ${scenesChecked} scenes:\n${lines.join("\n")}`);
  }

  console.log(
    `check:overflow OK — every SVG text with a containing plate/box/card fits inside it, ` +
      `across ${scenesChecked} scenes (overview + all 9 steps x 3 parts, at ${VIEWPORTS.map((v) => `${v.width}x${v.height}`).join(" and ")}).`
  );
  process.exit(0);
}

run().catch((error) => {
  fail(error.stack || String(error));
});
