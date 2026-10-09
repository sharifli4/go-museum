"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { animate } from "framer-motion";
import { ENGINE_SVG_MARKUP } from "@/lib/svg/engine-markup";
import {
  cameraTransformForPart,
  IDENTITY_CAMERA,
  VIEWBOX,
  type CameraTransform,
} from "@/lib/geometry";
import { getPart } from "@/lib/parts";
import type { PartId } from "@/lib/types";
import { useLatestRef } from "@/hooks/useLatestRef";

const PART_IDS: PartId[] = ["parser", "escape", "slices"];
const LOCKED_IDS = ["locked-scheduler", "locked-gc", "locked-maps"] as const;

const ESCAPE_GATE_ANGLE: Record<number, number> = {
  1: 0,
  2: 0,
  3: 20,
  4: 42,
  5: 42,
  6: 42,
  7: 42,
  8: 42,
  9: 42,
};

const ESCAPE_CARD_LANDED_FROM_STEP = 5;

/**
 * Lock §5: closing must land the camera such that "the last reverse frame
 * equals the first overview frame" in position, scale, *and* crop. The
 * part's `.diagram` box and the overview's `.ov-sheet` box are
 * different-sized DOM containers, at different screen positions, for the
 * same `viewBox="0 0 1400 668"` SVG, so each renders "camera at identity"
 * at a different effective px-per-viewBox-unit scale *and* a different
 * screen origin (`preserveAspectRatio="xMidYMid meet"`'s own fit,
 * entirely outside this camera transform's control). Scaling about the
 * viewBox's own center alone (an earlier version of this function) only
 * fixes the scale: the two boxes' *centers* aren't at the same screen
 * position either (the part's box shares its row with the plaque column,
 * shifting its center well left of where the overview's, which spans the
 * full row, sits), leaving a residual sideways-and-down translation jump
 * at the swap.
 *
 * Fixes both by computing the full affine map from viewBox-space to
 * screen-space for each box (`viewBoxOrigin`: the "meet" scale plus the
 * screen position its own letterboxed origin -- viewBox point (0,0) --
 * lands at) and solving for the camera's `{scale, x, y}` that makes the
 * part box's map equal the overview box's map for every point:
 *
 *   screenPos = partOrigin + partScale * (cameraScale * P + cameraTranslate)
 *             = overviewOrigin + overviewScale * P   for all P
 *
 * which gives `cameraScale = overviewScale / partScale` (unchanged) and
 * `cameraTranslate = (overviewOrigin - partOrigin) / partScale` (new).
 *
 * `partRect` must be the box the part's `.diagram` will have *once the
 * plaque column is collapsed* (see `.view.closing` in globals.css, which
 * EngineApp drives in lockstep with this camera animation) -- not
 * `.diagram`'s own live rect while the plaque still occupies it, which
 * would still leave the final frame cropped narrower than the overview's.
 * `PartViewScaleProbe` measures that collapsed box continuously (always
 * mounted, invisible) so it's available the instant closing starts.
 */
function meetScale(width: number, height: number): number {
  return Math.min(width / VIEWBOX.width, height / VIEWBOX.height);
}

interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function viewBoxOrigin(rect: ScreenRect) {
  const scale = meetScale(rect.width, rect.height);
  return {
    scale,
    x: rect.left + (rect.width - VIEWBOX.width * scale) / 2,
    y: rect.top + (rect.height - VIEWBOX.height * scale) / 2,
  };
}

/** `.diagram`'s fixed inset within `.stage` (lock §5.2: "inset 46px 24px
 * 112px 24px so the dock never covers it"), in CSS `inset` order. */
const DIAGRAM_INSET = { top: 46, right: 24, bottom: 112, left: 24 };

function diagramRectFromStage(stageRect: ScreenRect): ScreenRect | null {
  const width = stageRect.width - DIAGRAM_INSET.left - DIAGRAM_INSET.right;
  const height = stageRect.height - DIAGRAM_INSET.top - DIAGRAM_INSET.bottom;
  if (width <= 0 || height <= 0) return null;
  return { left: stageRect.left + DIAGRAM_INSET.left, top: stageRect.top + DIAGRAM_INSET.top, width, height };
}

function closingTarget(
  collapsedStage: HTMLElement | null | undefined,
  overviewSheet: HTMLElement | null | undefined
): CameraTransform {
  if (!collapsedStage || !overviewSheet) return IDENTITY_CAMERA;
  const stageBox = collapsedStage.getBoundingClientRect();
  const overviewBox = overviewSheet.getBoundingClientRect();
  if (stageBox.width <= 0 || stageBox.height <= 0 || overviewBox.width <= 0 || overviewBox.height <= 0) {
    return IDENTITY_CAMERA;
  }
  const partRect = diagramRectFromStage(stageBox);
  if (!partRect) return IDENTITY_CAMERA;

  const part = viewBoxOrigin(partRect);
  const overview = viewBoxOrigin(overviewBox);
  const scale = overview.scale / part.scale;
  return {
    scale,
    x: (overview.x - part.x) / part.scale,
    y: (overview.y - part.y) / part.scale,
  };
}

/** lock §6.1: "current step ink at 1.5px; earlier hairline; later dashed." */
function applyAstNodeState(el: SVGElement, created: number, step: number) {
  if (created > step) {
    el.style.opacity = "0.45";
    el.style.strokeDasharray = "3 3";
    el.style.strokeWidth = "1";
    el.style.stroke = ""; // back to the element's own (muted) stroke attribute
  } else if (created === step) {
    el.style.opacity = "1";
    el.style.strokeDasharray = "none";
    el.style.strokeWidth = "1.5";
    el.style.stroke = "var(--ink)"; // lock §6.1: current step's node is ink at 1.5px
  } else {
    el.style.opacity = "1";
    el.style.strokeDasharray = "none";
    el.style.strokeWidth = "1";
    el.style.stroke = ""; // back to the element's own (muted) stroke attribute
  }
}

function applyParserStep(detail: SVGGElement, step: number) {
  detail.querySelectorAll<SVGGElement>("[data-node]").forEach((node) => {
    const created = Number(node.getAttribute("data-created"));
    const rect = node.querySelector<SVGRectElement>("rect");
    if (rect) applyAstNodeState(rect, created, step);
  });
  detail.querySelectorAll<SVGPathElement>("[data-connector]").forEach((connector) => {
    const created = Number(connector.getAttribute("data-created"));
    applyAstNodeState(connector, created, step);
  });
}

const SLICES_B_INFO: Record<number, string> = {
  3: "len 2 cap 3",
  4: "len 2 cap 3",
  5: "len 3 cap 3",
  6: "len 3 cap 3",
  7: "len 3 cap 3",
  8: "len 3 cap 3",
  9: "len 3 cap 3",
};

const SLICES_RACK1_CELLS: Record<number, [string, string, string]> = {
  2: ["1", "2", "3"],
  3: ["1", "2", "3"],
  4: ["9", "2", "3"],
  5: ["9", "2", "4"],
  6: ["9", "2", "4"],
  7: ["9", "2", "4"],
  8: ["9", "2", "4"],
  9: ["9", "2", "4"],
};

function applySlicesStep(detail: SVGGElement, step: number) {
  const bInfo = detail.querySelector("#sliceBInfo");
  if (bInfo) bInfo.textContent = SLICES_B_INFO[step] ?? SLICES_B_INFO[3];
  const cells = SLICES_RACK1_CELLS[step] ?? SLICES_RACK1_CELLS[2];
  cells.forEach((value, i) => {
    const cell = detail.querySelector(`#sliceCell${i}`);
    if (cell) cell.textContent = value;
  });
}

interface EngineStageProps {
  openPartId: PartId | null;
  currentStep: number;
  reducedMotion: boolean;
  onOpenPart: (id: PartId) => void;
  onActivePartChange?: (id: PartId | null) => void;
  onLockedAnnounce?: (message: string) => void;
  /**
   * The overview and the part view each mount their own `<EngineStage>`
   * (so each can lay its chrome out independently), which would normally
   * reset the camera on every open/close. These two refs are created once
   * in EngineApp and passed into both mounts, so the camera's last known
   * position (and which part was open last) survive the remount and the
   * reverse zoom on close keeps animating from where the forward zoom
   * left off instead of jumping straight to the overview (lock §5).
   */
  cameraRef: MutableRefObject<CameraTransform>;
  prevOpenRef: MutableRefObject<PartId | null>;
  /**
   * Set by EngineApp for the ~520ms a part is closing (lock §5: "Esc or
   * '← Engine' reverses it in 520ms"). The part is still mounted and its
   * `openPartId` prop is still set, but the camera should already be
   * animating back to the overview framing.
   */
  forceClosing?: boolean;
  /**
   * A ref to the overview's `.ov-sheet` box (see OverviewScaleProbe),
   * read only while `forceClosing`. The overview and a zoomed part's
   * `.diagram` are different-sized DOM boxes for the same 1400x668
   * viewBox, so "camera at identity" renders at a different effective
   * scale in each; the reverse zoom needs this to compute a target that
   * actually matches the overview's real on-screen scale (lock §5: "the
   * last reverse frame equals the first overview frame"), not a flat
   * identity that would still jump the instant the overview mounts.
   */
  overviewSheetRef?: MutableRefObject<HTMLDivElement | null>;
  /**
   * A ref to the "collapsed" (plaque-column-at-0) `.stage` box (see
   * PartViewScaleProbe), read only while `forceClosing`, to compute what
   * `.diagram`'s own box will be once `.view.closing`'s grid-column
   * collapse finishes -- not `.diagram`'s live box while the plaque
   * still occupies that column, which would still leave the final
   * reverse frame cropped narrower than the overview will be.
   */
  collapsedStageRef?: MutableRefObject<HTMLDivElement | null>;
  /**
   * True only for Overview's own EngineStage instance. Its camera target
   * is always identity (`openPartId` is always null there) and the only
   * reason it would otherwise animate is a *leftover* "closing" signal
   * from the shared refs above (set by the part that was just unmounted,
   * whose own reverse zoom already finished the whole visual transition)
   * -- so Overview must just snap to identity, never animate.
   */
  skipCameraAnimation?: boolean;
}

export function EngineStage({
  openPartId,
  currentStep,
  reducedMotion,
  onOpenPart,
  onActivePartChange,
  onLockedAnnounce,
  cameraRef: sharedCameraRef,
  prevOpenRef: sharedPrevOpenRef,
  forceClosing = false,
  overviewSheetRef,
  collapsedStageRef,
  skipCameraAnimation = false,
}: EngineStageProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<SVGGElement>(null);
  const [hoveredId, setHoveredId] = useState<PartId | null>(null);
  const [focusedId, setFocusedId] = useState<PartId | null>(null);

  const onOpenPartRef = useLatestRef(onOpenPart);
  const onLockedAnnounceRef = useLatestRef(onLockedAnnounce);
  // Pending "finish hiding the detail layer" timeouts, keyed by part id
  // (see the compact/detail crossfade effect below).
  const detailHideTimers = useRef<Partial<Record<PartId, ReturnType<typeof setTimeout>>>>({});
  useEffect(() => {
    // The ref object itself is stable for this component's lifetime (only
    // its properties get mutated by the effect below); capturing it here
    // still reads whatever's pending *at unmount time* once read through,
    // since `timers` and `detailHideTimers.current` are the same object.
    const timers = detailHideTimers.current;
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer);
    };
  }, []);

  // Wire part/locked group interactivity once; the SVG markup never changes.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const cleanups: Array<() => void> = [];

    for (const id of PART_IDS) {
      const el = svg.querySelector<SVGGElement>(`#part-${id}`);
      if (!el) continue;
      const open = () => onOpenPartRef.current(id);
      const onKeydown = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      };
      const onEnter = () => setHoveredId(id);
      const onLeave = () => setHoveredId((cur) => (cur === id ? null : cur));
      const onFocus = () => setFocusedId(id);
      const onBlur = () => setFocusedId((cur) => (cur === id ? null : cur));
      el.addEventListener("click", open);
      el.addEventListener("keydown", onKeydown);
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
      el.addEventListener("focus", onFocus);
      el.addEventListener("blur", onBlur);
      cleanups.push(() => {
        el.removeEventListener("click", open);
        el.removeEventListener("keydown", onKeydown);
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
        el.removeEventListener("focus", onFocus);
        el.removeEventListener("blur", onBlur);
      });
    }

    for (const id of LOCKED_IDS) {
      const el = svg.querySelector<SVGGElement>(`#${id}`);
      if (!el) continue;
      const onKeydown = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onLockedAnnounceRef.current?.("Coming soon");
        }
      };
      el.addEventListener("keydown", onKeydown);
      cleanups.push(() => el.removeEventListener("keydown", onKeydown));
    }

    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hover/focus-driven dimming + cyan "is-active" treatment (lock §4).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || openPartId) return;
    const activeId = hoveredId ?? focusedId;
    onActivePartChange?.(activeId);

    const allIds: string[] = [...PART_IDS.map((p) => `part-${p}`), ...LOCKED_IDS];
    for (const id of allIds) {
      const el = svg.querySelector<SVGGElement>(`#${id}`);
      if (!el) continue;
      const isActive = activeId !== null && id === `part-${activeId}`;
      el.classList.toggle("is-active", isActive);
      el.classList.toggle("dimmed", activeId !== null && !isActive);
    }

    // The escape callout's leader line shows only with that callout, never
    // on its own and never while a part is zoomed in (lock §4).
    const leader = svg.querySelector<SVGPathElement>("#escapeCalloutLeader");
    leader?.classList.toggle("is-shown", activeId === "escape");
  }, [hoveredId, focusedId, openPartId, onActivePartChange]);

  // Part groups leave the tab order and stop reacting to pointer input once a
  // part view is open; the dock/plaque/minimap own the tab order there (§7).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    for (const id of PART_IDS) {
      const el = svg.querySelector<SVGGElement>(`#part-${id}`);
      if (!el) continue;
      const inert = openPartId !== null;
      el.setAttribute("tabindex", inert ? "-1" : "0");
      el.style.pointerEvents = inert ? "none" : "auto";
      if (inert) {
        el.classList.remove("is-active", "dimmed");
      }
    }
    for (const id of LOCKED_IDS) {
      const el = svg.querySelector<SVGGElement>(`#${id}`);
      if (!el) continue;
      const inert = openPartId !== null;
      el.setAttribute("tabindex", inert ? "-1" : "0");
      el.style.pointerEvents = inert ? "none" : "auto";
      if (inert) el.classList.remove("dimmed");
    }
  }, [openPartId]);

  // Camera transform: a transform on a camera group wrapping the SVG, never
  // a swap to a different illustration (lock §5). Applied as the SVG `g`
  // transform *attribute* (always in user-space units) rather than a CSS
  // transform, whose `px` lengths are physical pixels and would be scaled
  // incorrectly by the SVG's own viewBox-to-viewport ratio.
  //
  // useLayoutEffect, not useEffect: this mount may be a fresh instance
  // (Overview and PartView each own one) picking up a camera position
  // left behind by the instance that was just unmounted. Setting the
  // attribute before paint avoids a one-frame flash at the identity/old
  // transform before the animation's first frame lands.
  useLayoutEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    let target: CameraTransform;
    if (openPartId && !forceClosing) {
      target = cameraTransformForPart(openPartId);
    } else if (forceClosing) {
      target = closingTarget(collapsedStageRef?.current, overviewSheetRef?.current);
    } else {
      target = IDENTITY_CAMERA;
    }

    const setAttr = (c: CameraTransform) => {
      camera.setAttribute("transform", `translate(${c.x} ${c.y}) scale(${c.scale})`);
      sharedCameraRef.current = c;
    };

    if (reducedMotion || skipCameraAnimation) {
      setAttr(target);
      sharedPrevOpenRef.current = openPartId;
      return;
    }

    const start = sharedCameraRef.current;
    const closing = forceClosing || (sharedPrevOpenRef.current !== null && openPartId === null);
    const controls = animate(0, 1, {
      duration: closing ? 0.52 : 0.65,
      ease: [0.22, 0.8, 0.2, 1],
      onUpdate: (p) => {
        setAttr({
          x: start.x + (target.x - start.x) * p,
          y: start.y + (target.y - start.y) * p,
          scale: start.scale + (target.scale - start.scale) * p,
        });
      },
    });
    sharedPrevOpenRef.current = openPartId;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPartId, reducedMotion, forceClosing, skipCameraAnimation]);

  // Every part: compact art fades out, detail art fades in and reacts to
  // the current step (lock §5.4, §6.1-§6.3). Other groups fade during zoom
  // (§5.1). Generic across parts; escape/parser/slices each get a small
  // part-specific pass for the bits plain data-step show/hide can't do
  // (gate rotation, AST node weight, slice cell values).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // While `forceClosing`, `openPartId` is still the real part (lock §5:
    // the part stays mounted for the whole 520ms reverse zoom) but
    // everything in this effect that only cares about "is anything
    // zoomed in right now" should already be reversing, not waiting for
    // the eventual unmount to pop back -- bus/grid/locked-parts/siblings
    // fade back in during the zoom-out, not after it.
    const zoomedIn = Boolean(openPartId) && !forceClosing;

    for (const id of PART_IDS) {
      const partGroup = svg.querySelector<SVGGElement>(`#part-${id}`);
      if (!partGroup) continue;
      const isOpen = zoomedIn && openPartId === id;
      const compact = partGroup.querySelector<SVGGElement>(".part-compact");
      const detail = partGroup.querySelector<SVGGElement>(".part-detail");
      if (compact) compact.style.opacity = isOpen ? "0" : "1";
      if (detail) {
        const pendingHide = detailHideTimers.current[id];
        if (pendingHide) {
          clearTimeout(pendingHide);
          delete detailHideTimers.current[id];
        }
        if (isOpen) {
          detail.style.display = "";
          requestAnimationFrame(() => detail.classList.add("is-open"));
        } else {
          // Crossfade to the compact art, don't pop straight to it: drop
          // the `.is-open` class so `.part-detail`'s own CSS transition
          // (opacity 1 -> 0 over 300ms) actually plays, matching compact
          // fading up over the same window. `display: none` (so these
          // larger sub-drawings never inflate the part's hoverable/
          // hit-test bbox once hidden) has to wait for that transition to
          // finish -- setting it in this same tick, as a previous version
          // of this effect did, skips the transition entirely (there's no
          // visual effect of animating a property on an element about to
          // stop rendering) and the whole detail drawing -- while the
          // camera is still showing it zoomed in, right at the start of
          // the reverse zoom -- just vanishes instantly.
          detail.classList.remove("is-open");
          detailHideTimers.current[id] = setTimeout(() => {
            detail.style.display = "none";
            delete detailHideTimers.current[id];
          }, 300);
        }
      }
    }

    // Other groups, the bus, the sheet frame, and the grid all fade over
    // the first 300ms while any part is zoomed in (lock §5.1), and restore
    // when zooming back out.
    const fadeTargets = svg.querySelectorAll<SVGGElement>(
      "#locked-scheduler, #locked-gc, #locked-maps, #output, #titleblock, #chassis, #bus, #sheetFrame, #grid"
    );
    fadeTargets.forEach((el) => {
      el.style.transition = "opacity 0.3s ease";
      // Same rule as above: only force opacity while zoomed in. In the
      // overview, locked groups can still be hover/focus-dimmed via CSS.
      el.style.opacity = zoomedIn ? "0" : "";
    });

    // The escape callout leader has its own hover-driven visibility; only
    // force it off here when zooming in, never force it on when zooming out.
    if (zoomedIn) {
      svg.querySelector<SVGPathElement>("#escapeCalloutLeader")?.classList.remove("is-shown");
    }
    for (const id of PART_IDS) {
      if (zoomedIn && id === openPartId) continue;
      const el = svg.querySelector<SVGGElement>(`#part-${id}`);
      if (!el) continue;
      el.style.transition = "opacity 0.3s ease";
      // Only force an inline opacity while a part is actually zoomed in.
      // In overview mode, leave inline opacity unset so the hover/focus
      // ".dimmed" class (opacity: .62) controls it instead of always
      // being clobbered back to "1" (lock §4).
      el.style.opacity = zoomedIn ? "0" : "";
    }

    if (!openPartId) return;
    const openGroup = svg.querySelector<SVGGElement>(`#part-${openPartId}`);
    const detail = openGroup?.querySelector<SVGGElement>(".part-detail");
    if (!detail) return;

    const step = Math.min(9, Math.max(1, currentStep));

    if (openPartId === "escape") {
      const gate = detail.querySelector<SVGGElement>("#escapeGate");
      if (gate) {
        const angle = ESCAPE_GATE_ANGLE[step] ?? 42;
        gate.setAttribute("transform", `rotate(${angle} 446 196)`);
      }
      const card = detail.querySelector<SVGGElement>("#escapeUserCard");
      if (card) {
        card.setAttribute(
          "transform",
          step >= ESCAPE_CARD_LANDED_FROM_STEP ? "translate(0 32)" : "translate(0 0)"
        );
      }
    } else if (openPartId === "parser") {
      applyParserStep(detail, step);
    } else if (openPartId === "slices") {
      applySlicesStep(detail, step);
    }

    const stepped = detail.querySelectorAll<SVGElement>("[data-step]");
    stepped.forEach((el) => {
      const steps = (el.getAttribute("data-step") ?? "").split(/\s+/).filter(Boolean);
      const visible = steps.includes(String(step));
      el.style.opacity = visible ? "1" : "0";
      el.style.pointerEvents = visible ? "auto" : "none";
    });

    const part = getPart(openPartId);
    const caption = part?.steps[step - 1]?.caption;
    const diagramSvg = svgRef.current;
    if (diagramSvg && caption) {
      diagramSvg.setAttribute("aria-label", caption);
    }
  }, [openPartId, currentStep, forceClosing]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      role={openPartId ? "img" : "group"}
      aria-label={openPartId ? undefined : "The Go Engine, cutaway"}
    >
      <g ref={cameraRef} dangerouslySetInnerHTML={{ __html: ENGINE_SVG_MARKUP }} />
    </svg>
  );
}
