"use client";

import { useEffect, useRef, useState } from "react";
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
}

export function EngineStage({
  openPartId,
  currentStep,
  reducedMotion,
  onOpenPart,
  onActivePartChange,
  onLockedAnnounce,
}: EngineStageProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<SVGGElement>(null);
  const [hoveredId, setHoveredId] = useState<PartId | null>(null);
  const [focusedId, setFocusedId] = useState<PartId | null>(null);

  const onOpenPartRef = useLatestRef(onOpenPart);
  const onLockedAnnounceRef = useLatestRef(onLockedAnnounce);

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
  const currentCameraRef = useRef<CameraTransform>(IDENTITY_CAMERA);
  const previousOpenRef = useRef<PartId | null>(null);
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const target: CameraTransform = openPartId
      ? cameraTransformForPart(openPartId)
      : IDENTITY_CAMERA;

    const setAttr = (c: CameraTransform) => {
      camera.setAttribute("transform", `translate(${c.x} ${c.y}) scale(${c.scale})`);
      currentCameraRef.current = c;
    };

    if (reducedMotion) {
      setAttr(target);
      previousOpenRef.current = openPartId;
      return;
    }

    const start = currentCameraRef.current;
    const closing = previousOpenRef.current !== null && openPartId === null;
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
    previousOpenRef.current = openPartId;
    return () => controls.stop();
  }, [openPartId, reducedMotion]);

  // Every part: compact art fades out, detail art fades in and reacts to
  // the current step (lock §5.4, §6.1-§6.3). Other groups fade during zoom
  // (§5.1). Generic across parts; escape/parser/slices each get a small
  // part-specific pass for the bits plain data-step show/hide can't do
  // (gate rotation, AST node weight, slice cell values).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    for (const id of PART_IDS) {
      const partGroup = svg.querySelector<SVGGElement>(`#part-${id}`);
      if (!partGroup) continue;
      const isOpen = openPartId === id;
      const compact = partGroup.querySelector<SVGGElement>(".part-compact");
      const detail = partGroup.querySelector<SVGGElement>(".part-detail");
      if (compact) compact.style.opacity = isOpen ? "0" : "1";
      if (detail) {
        // `display: none` (not just opacity) when closed, so these larger
        // sub-drawings never inflate the part's hoverable/hit-test bbox.
        if (isOpen) {
          detail.style.display = "";
          requestAnimationFrame(() => detail.classList.add("is-open"));
        } else {
          detail.classList.remove("is-open");
          detail.style.display = "none";
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
      el.style.opacity = openPartId ? "0" : "1";
    });

    // The escape callout leader has its own hover-driven visibility; only
    // force it off here when zooming in, never force it on when zooming out.
    if (openPartId) {
      svg.querySelector<SVGPathElement>("#escapeCalloutLeader")?.classList.remove("is-shown");
    }
    for (const id of PART_IDS) {
      if (id === openPartId) continue;
      const el = svg.querySelector<SVGGElement>(`#part-${id}`);
      if (el) {
        el.style.transition = "opacity 0.3s ease";
        el.style.opacity = openPartId ? "0" : "1";
      }
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
  }, [openPartId, currentStep]);

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
