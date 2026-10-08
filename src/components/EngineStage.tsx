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

  // Escape part: compact art fades out, detail art fades in and reacts to
  // the current step (lock §5.4, §6.2). Other groups fade during zoom (§5.1).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const escapeOpen = openPartId === "escape";

    const compact = svg.querySelector<SVGGElement>(".escape-compact");
    const detail = svg.querySelector<SVGGElement>(".escape-detail");
    compact?.classList.toggle("is-open", escapeOpen);
    if (compact) compact.style.opacity = escapeOpen ? "0" : "1";
    if (detail) {
      // `display: none` (not just opacity) when closed, so this far larger
      // sub-drawing never inflates part-escape's hoverable/hit-test bbox.
      if (escapeOpen) {
        detail.style.display = "";
        requestAnimationFrame(() => detail.classList.add("is-open"));
      } else {
        detail.classList.remove("is-open");
        detail.style.display = "none";
      }
    }

    // Other groups and connecting pipes fade while any part is zoomed in.
    const fadeTargets = svg.querySelectorAll<SVGGElement>(
      "#locked-scheduler, #locked-gc, #locked-maps, #output, #titleblock, #chassis"
    );
    fadeTargets.forEach((el) => {
      el.style.transition = "opacity 0.3s ease";
      el.style.opacity = openPartId ? "0" : "1";
    });
    for (const id of PART_IDS) {
      if (id === openPartId) continue;
      const el = svg.querySelector<SVGGElement>(`#part-${id}`);
      if (el) {
        el.style.transition = "opacity 0.3s ease";
        el.style.opacity = openPartId ? "0" : "1";
      }
    }

    if (!escapeOpen || !detail) return;

    const step = Math.min(9, Math.max(1, currentStep));

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

    const stepped = detail.querySelectorAll<SVGElement>("[data-step]");
    stepped.forEach((el) => {
      const steps = (el.getAttribute("data-step") ?? "").split(/\s+/).filter(Boolean);
      const visible = steps.includes(String(step));
      el.style.opacity = visible ? "1" : "0";
      el.style.pointerEvents = visible ? "auto" : "none";
    });

    const part = getPart("escape");
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
      aria-label={
        openPartId
          ? openPartId === "escape"
            ? undefined
            : getPart(openPartId)?.overviewBlurb
          : "The Go Engine, cutaway"
      }
    >
      <g ref={cameraRef} dangerouslySetInnerHTML={{ __html: ENGINE_SVG_MARKUP }} />
    </svg>
  );
}
