#!/usr/bin/env node
// Automated regression guard for the two classes of visual bug the audits
// of this PR found:
//
// 1. Nominal SVG font-sizes get bumped (e.g. for lock §10's >=11px floor)
//    without widening the boxes/plates/cards the text sits in, so the
//    rendered text silently spills past its container.
// 2. Re-spacing one node in a tree (or moving one label) doesn't check
//    what it now overlaps: a sibling node's box/text, a thick structural
//    line (a duct/bus/pipe), or a DOM overlay like the minimap or dock.
//
// Boots a server (reusing an existing `.next` build if present, `next
// dev` otherwise, auto-picking a free port so it never has to touch any
// server this script didn't start itself -- see pickPort()), then for the
// overview and every step of all three parts, at both 1280x800 and
// 1024x700, walks every visible <text> and "plate" <rect> (a solid-filled,
// stroked rect, not a decorative url(#...) texture or an oversized
// background container) in the active SVG and fails on:
//   a. a text's rendered bbox escaping the plate/box/card rect it starts
//      inside of (checked in local SVG user-space via getBBox(), which is
//      invariant to the current camera zoom/viewport scale);
//   b. any two visible texts' screen-space rects overlapping each other
//      (getBoundingClientRect) -- texts should never visually collide,
//      regardless of DOM relationship ("sibling" or not);
//   c. any two visible "plate" rects' screen-space rects overlapping each
//      other (same reasoning, scoped to plate-sized rects so intentionally
//      nested housings/containers aren't flagged);
//   d. a visible text's screen-space rect overlapping the *stroke-inflated*
//      screen-space rect of a thick structural line (stroke-width >= 6:
//      a duct, bus bar, or pipe, not a 1-1.5px hairline a label is
//      expected to sit near or on top of);
//   e. anything in the SVG overlapping the minimap (`.mm`) or dock
//      (`.dock`) DOM overlays.
//
// Usage: npm run check:overflow
// CI: runs headless via Playwright's bundled Chromium; no system browser
// or display server needed. If this ever can't run in your CI image
// (e.g. a locked-down sandbox that blocks spawning a Next.js server), run
// it locally before merging instead -- `npm run build && npm run
// check:overflow` -- since it is otherwise self-contained.
//
// Safety: this script only ever kills the exact server process (by pid,
// via its own process group) that it itself spawned on the free port it
// picked. It never searches for or kills processes by name/pattern, so it
// can't touch an unrelated Next.js (or any other) server already running
// on your machine.
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// px of slop for anti-aliasing/sub-pixel rounding, applied to every
// screen-space overlap check (b)-(e) below.
const OVERLAP_TOLERANCE = 1.5;
// SVG text getBBox() includes a few px of font-metric ascent padding
// above the visible glyph that every hand-tuned box already accounts
// for, so check (a)'s top edge needs a looser tolerance than its other
// three (confirmed empty on a clean run: left/right/bottom overflows are
// never positive by the couple of px the way top readings are).
const CONTAINMENT_TOP_TOLERANCE = 4.5;
const CONTAINMENT_OTHER_TOLERANCE = 2;
// A "plate/box/card" must be reasonably label-sized, not a big background
// container (the heap tank, the stack column, a housing panel) that a
// nearby balloon or callout's text might merely start inside of, or that
// legitimately nests smaller plates without that being an overlap bug.
const MAX_PLATE_AREA = 16000;
// A structural duct/bus/pipe, not a 1-1.5px decorative hairline a label
// is expected to sit near or cross incidentally.
const MIN_DUCT_STROKE_WIDTH = 6;

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1024, height: 700 },
];
const PARTS = ["parser", "escape", "slices"];
const TOTAL_STEPS = 9;

function fail(message) {
  console.error(`\ncheck:overflow FAILED\n${message}\n`);
  process.exit(1);
}

function hasBuild() {
  return existsSync(join(root, ".next", "BUILD_ID"));
}

/** Finds a free TCP port by actually asking the OS for one (port 0),
 * rather than guessing and risking a collision with something already
 * running -- so this script never needs to touch any other process to
 * get a port to itself. */
function pickPort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const useBuild = hasBuild();
    const args = useBuild ? ["next", "start", "-p", String(port)] : ["next", "dev", "-p", String(port)];
    console.log(`check:overflow: starting ${useBuild ? "production" : "dev"} server on :${port}...`);
    // `detached: true` makes this child its own process group leader
    // (pgid == its own pid); its own children (the `next` wrapper, the
    // real `next-server`) inherit that same pgid, so killing the group
    // by *this* pid alone (see `stopServer`) reaches all of them without
    // ever having to search for or match any other process on the box.
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

function stopServer(child) {
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
}

async function waitForServer(page, baseUrl, retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await page.goto(baseUrl, { timeout: 2000 });
      if (res && res.ok()) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${baseUrl} never became ready`);
}

/**
 * Runs in-page. Checks (a)-(e) described in the file header, scoped to
 * `rootSelector`'s SVG for (a)-(d) and to the whole document for (e).
 */
function collectIssues({ rootSelector, sceneLabel, config }) {
  const { containmentTopTolerance, containmentOtherTolerance, overlapTolerance, maxPlateArea, minDuctStrokeWidth } = config;
  const svg = document.querySelector(rootSelector);
  if (!svg) return [{ scene: sceneLabel, error: `no element matched ${rootSelector}` }];

  const isVisible = (el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });

  function isPlateRect(rect, localBox) {
    const fill = rect.getAttribute("fill") || "";
    const stroke = rect.getAttribute("stroke") || "";
    if (!fill || fill === "none" || fill.startsWith("url(")) return false;
    if (!stroke || stroke === "none") return false;
    if (localBox.width * localBox.height > maxPlateArea) return false;
    return true;
  }

  function localBoxOf(el) {
    const b = el.getBBox();
    return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.x + b.width, bottom: b.y + b.height };
  }

  function screenRectOf(el) {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  }

  /** The screen-space rect of a stroked line/path, inflating its local
   * (unstroked) geometry by half the stroke-width *before* mapping
   * through the element's full current transform -- plain
   * getBoundingClientRect() on an SVG path does not include the stroke
   * (confirmed: a vertical line's reported width is 0 either way). */
  function strokedScreenRectOf(el) {
    const bbox = el.getBBox();
    const strokeWidth = parseFloat(el.getAttribute("stroke-width") || "1");
    const ctm = el.getScreenCTM();
    if (!ctm) return null;
    const half = strokeWidth / 2;
    const corners = [
      [bbox.x - half, bbox.y - half],
      [bbox.x + bbox.width + half, bbox.y - half],
      [bbox.x - half, bbox.y + bbox.height + half],
      [bbox.x + bbox.width + half, bbox.y + bbox.height + half],
    ].map(([x, y]) => ({ x: ctm.a * x + ctm.c * y + ctm.e, y: ctm.b * x + ctm.d * y + ctm.f }));
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  function rectsOverlap(a, b, tolerance = 0) {
    return !(
      a.right - tolerance <= b.left ||
      a.left + tolerance >= b.right ||
      a.bottom - tolerance <= b.top ||
      a.top + tolerance >= b.bottom
    );
  }

  function containsPoint(box, x, y) {
    return x >= box.x && x <= box.right && y >= box.y && y <= box.bottom;
  }

  const issues = [];
  const texts = [...svg.querySelectorAll("text")].filter((t) => isVisible(t) && (t.textContent || "").trim());

  // (a) text vs. its containing plate/box/card, in local SVG space.
  for (const text of texts) {
    const textBox = localBoxOf(text);
    const anchorX = textBox.x + textBox.width / 2;
    const anchorY = textBox.y + textBox.height / 2;
    const candidateParents = [text.parentElement, text.parentElement?.parentElement].filter(Boolean);
    let bestRect = null;
    let bestArea = Infinity;
    for (const parent of candidateParents) {
      for (const rect of parent.querySelectorAll(":scope > rect")) {
        const rectBox = localBoxOf(rect);
        if (!isPlateRect(rect, rectBox)) continue;
        if (!containsPoint(rectBox, anchorX, anchorY)) continue;
        const area = rectBox.width * rectBox.height;
        if (area < bestArea) {
          bestArea = area;
          bestRect = rectBox;
        }
      }
      if (bestRect) break;
    }
    if (!bestRect) continue;
    const overflowLeft = bestRect.x - textBox.x;
    const overflowRight = textBox.right - bestRect.right;
    const overflowTop = bestRect.y - textBox.y;
    const overflowBottom = textBox.bottom - bestRect.bottom;
    if (
      overflowLeft > containmentOtherTolerance ||
      overflowRight > containmentOtherTolerance ||
      overflowTop > containmentTopTolerance ||
      overflowBottom > containmentOtherTolerance
    ) {
      issues.push({
        scene: sceneLabel,
        kind: "text-overflows-box",
        text: text.textContent.trim(),
        detail: `overflows its box by L${overflowLeft.toFixed(1)} R${overflowRight.toFixed(1)} T${overflowTop.toFixed(1)} B${overflowBottom.toFixed(1)}`,
      });
    }
  }

  // (b) text vs. text, screen space, among "labeled" texts only: a text
  // that is the *sole* <text> child of its immediate parent, the same
  // signal a `[data-node]`-tagged AST node or a plate's lone caption
  // uses. This deliberately excludes multi-line text blocks (a 4-line
  // code card, a title+subtitle pair sharing one wrapper) whose generous
  // font-metric bboxes (ascent/descent padding, not just the tight glyph
  // outline) legitimately brush against each other at normal line
  // spacing without ever being visually overlapping -- confirmed false
  // positives on a clean run otherwise.
  const labeledTexts = texts.filter((t) => t.parentElement?.querySelectorAll(":scope > text").length === 1);
  const textScreens = labeledTexts.map((t) => ({ el: t, rect: screenRectOf(t) }));
  for (let i = 0; i < textScreens.length; i++) {
    for (let j = i + 1; j < textScreens.length; j++) {
      const a = textScreens[i];
      const b = textScreens[j];
      if (rectsOverlap(a.rect, b.rect, overlapTolerance)) {
        issues.push({
          scene: sceneLabel,
          kind: "text-overlaps-text",
          text: a.el.textContent.trim(),
          detail: `overlaps "${b.el.textContent.trim()}" on screen`,
        });
      }
    }
  }

  // (c) plate vs. plate, screen space.
  const plateRects = [...svg.querySelectorAll("rect")].filter((r) => isVisible(r) && isPlateRect(r, localBoxOf(r)));
  const plateScreens = plateRects.map((r) => ({ el: r, rect: screenRectOf(r) }));
  for (let i = 0; i < plateScreens.length; i++) {
    for (let j = i + 1; j < plateScreens.length; j++) {
      const a = plateScreens[i];
      const b = plateScreens[j];
      if (rectsOverlap(a.rect, b.rect, overlapTolerance)) {
        issues.push({
          scene: sceneLabel,
          kind: "box-overlaps-box",
          text: `rect@${Math.round(a.rect.left)},${Math.round(a.rect.top)}`,
          detail: `overlaps rect@${Math.round(b.rect.left)},${Math.round(b.rect.top)} on screen`,
        });
      }
    }
  }

  // (d) text vs. thick structural lines (ducts/bus bars/pipes). Scoped
  // to straight segments only (no curve commands in `d`): a curved
  // pipe's own axis-aligned bbox (the only cheap approximation available
  // for an arbitrary bezier) can be far larger than where its stroke
  // actually paints, which produced false positives against curvy decor
  // pipes nowhere near the text on a clean run; straight ducts/bus bars
  // (the actual target of this check) don't have that gap. Uses *all*
  // visible texts, not just "labeled" ones (b) is scoped to -- a free
  // label like "FROM ENGINE BUS" crossing a duct is exactly must-fix #2.
  const allTextScreens = texts.map((t) => ({ el: t, rect: screenRectOf(t) }));
  const ducts = [...svg.querySelectorAll("path, line")].filter((el) => {
    if (!isVisible(el)) return false;
    const sw = parseFloat(el.getAttribute("stroke-width") || "0");
    if (sw < minDuctStrokeWidth) return false;
    const d = el.getAttribute("d") || "";
    if (/[CcQqAaSsTt]/.test(d)) return false;
    return true;
  });
  const ductScreens = ducts.map((d) => strokedScreenRectOf(d)).filter(Boolean);
  for (const { el: text, rect: textRect } of allTextScreens) {
    for (const ductRect of ductScreens) {
      if (rectsOverlap(textRect, ductRect, overlapTolerance)) {
        issues.push({
          scene: sceneLabel,
          kind: "text-crosses-duct",
          text: text.textContent.trim(),
          detail: `crosses a duct/bus stroke at screen x${Math.round(ductRect.left)}-${Math.round(ductRect.right)}`,
        });
      }
    }
  }

  // (e) anything in the SVG vs. the minimap/dock DOM overlays.
  const overlays = [
    { name: "minimap", el: document.querySelector(".mm") },
    { name: "dock", el: document.querySelector(".dock") },
  ].filter((o) => o.el && isVisible(o.el));
  if (overlays.length > 0) {
    const svgContentRects = [
      ...allTextScreens.map(({ el: t, rect }) => ({ label: `text "${t.textContent.trim()}"`, rect })),
      ...plateRects.map((r) => ({ label: `rect@${Math.round(screenRectOf(r).left)},${Math.round(screenRectOf(r).top)}`, rect: screenRectOf(r) })),
    ];
    for (const overlay of overlays) {
      const overlayRect = screenRectOf(overlay.el);
      for (const { label, rect } of svgContentRects) {
        if (rectsOverlap(rect, overlayRect, overlapTolerance)) {
          issues.push({
            scene: sceneLabel,
            kind: "under-overlay",
            text: label,
            detail: `sits under the ${overlay.name}`,
          });
        }
      }
    }
  }

  return issues;
}

async function checkScene(page, rootSelector, sceneLabel) {
  return page.evaluate(collectIssues, {
    rootSelector,
    sceneLabel,
    config: {
      containmentTopTolerance: CONTAINMENT_TOP_TOLERANCE,
      containmentOtherTolerance: CONTAINMENT_OTHER_TOLERANCE,
      overlapTolerance: OVERLAP_TOLERANCE,
      maxPlateArea: MAX_PLATE_AREA,
      minDuctStrokeWidth: MIN_DUCT_STROKE_WIDTH,
    },
  });
}

async function run() {
  const port = await pickPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = await startServer(port);
  let browser;
  const allIssues = [];
  let scenesChecked = 0;

  try {
    browser = await chromium.launch();
    const probe = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await waitForServer(probe, baseUrl);
    await probe.close();

    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport });
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);

      const sceneTag = `${viewport.width}x${viewport.height}`;

      const overviewIssues = await checkScene(page, ".ov-sheet svg", `${sceneTag} overview`);
      allIssues.push(...overviewIssues);
      scenesChecked++;

      for (const part of PARTS) {
        await page.evaluate(
          (id) => document.querySelector(`#part-${id}`)?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
          part
        );
        await page.waitForTimeout(700);
        for (let step = 1; step <= TOTAL_STEPS; step++) {
          await page.keyboard.press(String(step));
          // Longer than the data-step opacity transition (0.2s): a
          // shorter wait caught the outgoing and incoming data-step
          // groups both partway through their crossfade, which produced
          // false "overlap" positives between what's really the same
          // slot's two alternate stylings (e.g. the `u` row's solid vs.
          // "moved" rects, identical geometry, mid-swap).
          await page.waitForTimeout(300);
          const issues = await checkScene(page, ".diagram svg", `${sceneTag} ${part} step${step}`);
          allIssues.push(...issues);
          scenesChecked++;
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(700);
      }

      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    stopServer(server);
  }

  if (allIssues.length > 0) {
    const lines = allIssues.map((issue) => {
      if (issue.error) return `  [${issue.scene}] ${issue.error}`;
      return `  [${issue.scene}] (${issue.kind}) "${issue.text}" ${issue.detail}`;
    });
    fail(`${allIssues.length} issue(s) found across ${scenesChecked} scenes:\n${lines.join("\n")}`);
  }

  console.log(
    `check:overflow OK — no text/box overflows, no text-on-text or box-on-box overlaps, ` +
      `no text crossing a duct/bus, nothing under the minimap or dock, across ${scenesChecked} scenes ` +
      `(overview + all 9 steps x 3 parts, at ${VIEWPORTS.map((v) => `${v.width}x${v.height}`).join(" and ")}).`
  );
  process.exit(0);
}

run().catch((error) => {
  fail(error.stack || String(error));
});
