"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Overview } from "./Overview";
import { PartView } from "./PartView";
import { SmallViewportGate } from "./SmallViewportGate";
import type { Speed } from "./Dock";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useViewportGate } from "@/hooks/useViewportGate";
import { getPart, nextOpenPart, prevOpenPart } from "@/lib/parts";
import type { PartId } from "@/lib/types";

const DWELL_MS: Record<Speed, number> = { 0.5: 8000, 1: 4000, 2: 2000 };
const TOTAL_STEPS = 9;

export function EngineApp() {
  const reducedMotion = useReducedMotion();
  const gated = useViewportGate();

  const [openPartId, setOpenPartId] = useState<PartId | null>(null);
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [visitedParts, setVisitedParts] = useState<Set<PartId>>(new Set());

  const openPart = useCallback((id: PartId) => {
    setOpenPartId(id);
    setStep(1);
    setPlaying(false);
    setVisitedParts((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const closePart = useCallback(() => {
    setOpenPartId(null);
    setPlaying(false);
  }, []);

  const jumpPart = useCallback((id: PartId) => {
    setOpenPartId(id);
    setStep(1);
    setPlaying(false);
    setVisitedParts((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const goToStep = useCallback((n: number) => {
    setStep(Math.min(TOTAL_STEPS, Math.max(1, n)));
    setPlaying(false);
  }, []);

  const stepBy = useCallback(
    (delta: number) => {
      setStep((s) => Math.min(TOTAL_STEPS, Math.max(1, s + delta)));
      setPlaying(false);
    },
    []
  );

  const reset = useCallback(() => {
    setStep(1);
    setPlaying(false);
  }, []);

  const goToEnd = useCallback(() => {
    setStep(TOTAL_STEPS);
    setPlaying(false);
  }, []);

  const playPauseOrReplay = useCallback(() => {
    if (step >= TOTAL_STEPS) {
      setStep(1);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  }, [step]);

  // Dwell-driven auto-advance (lock §5.2): 8s/4s/2s at 0.5x/1x/2x. Reduced
  // motion still autoplays (§8); only the per-step transition crossfades.
  // The dwell bar itself is a plain CSS animation in Dock, keyed off these
  // same values, so no per-frame state is needed here.
  useEffect(() => {
    if (!playing || !openPartId) return;
    const duration = DWELL_MS[speed];
    const timer = setTimeout(() => {
      if (step >= TOTAL_STEPS) setPlaying(false);
      else setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    }, duration);
    return () => clearTimeout(timer);
  }, [playing, speed, openPartId, step]);

  // Keyboard map (lock §7), swallowed on `window` so nothing scrolls.
  const openPartIdRef = useRef(openPartId);
  useEffect(() => {
    openPartIdRef.current = openPartId;
  }, [openPartId]);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const partId = openPartIdRef.current;
      if (!partId) return; // overview keyboard handling lives in the SVG groups.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closePart();
          break;
        case " ":
          e.preventDefault();
          playPauseOrReplay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) jumpPart(prevOpenPart(partId).id);
          else stepBy(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) jumpPart(nextOpenPart(partId).id);
          else stepBy(1);
          break;
        case "Home":
          e.preventDefault();
          reset();
          break;
        case "End":
          e.preventDefault();
          goToEnd();
          break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            e.preventDefault();
            goToStep(Number(e.key));
          }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePart, playPauseOrReplay, stepBy, jumpPart, reset, goToEnd, goToStep]);

  if (gated) return <SmallViewportGate />;

  const currentPart = openPartId ? getPart(openPartId) : undefined;

  if (currentPart) {
    return (
      <PartView
        part={currentPart}
        stepNumber={step}
        playing={playing}
        speed={speed}
        reducedMotion={reducedMotion}
        onBack={closePart}
        onJumpPart={jumpPart}
        onReset={reset}
        onPrev={() => stepBy(-1)}
        onNext={() => stepBy(1)}
        onPlayPauseOrReplay={playPauseOrReplay}
        onJumpStep={goToStep}
        onSpeedChange={setSpeed}
      />
    );
  }

  return <Overview visitedParts={visitedParts} reducedMotion={reducedMotion} onOpenPart={openPart} />;
}
