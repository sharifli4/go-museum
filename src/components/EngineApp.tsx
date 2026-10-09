"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Overview } from "./Overview";
import { OverviewScaleProbe } from "./OverviewScaleProbe";
import { PartView } from "./PartView";
import { SmallViewportGate } from "./SmallViewportGate";
import type { Speed } from "./Dock";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useViewportGate } from "@/hooks/useViewportGate";
import { getPart, nextOpenPart, prevOpenPart } from "@/lib/parts";
import { IDENTITY_CAMERA, type CameraTransform } from "@/lib/geometry";
import type { PartId } from "@/lib/types";

const DWELL_MS: Record<Speed, number> = { 0.5: 8000, 1: 4000, 2: 2000 };
const TOTAL_STEPS = 9;
/** Lock §5: "Esc or '← Engine' reverses it in 520ms." */
const CLOSE_MS = 520;

export function EngineApp() {
  const reducedMotion = useReducedMotion();
  const gated = useViewportGate();

  const [openPartId, setOpenPartId] = useState<PartId | null>(null);
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [visitedParts, setVisitedParts] = useState<Set<PartId>>(new Set());
  // Closing is a part view fading out over CLOSE_MS while its camera
  // reverse-zooms (lock §5); openPartId only flips to null once that
  // finishes, so PartView (and its one EngineStage) stays mounted for the
  // whole 520ms instead of being swapped out instantly.
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared across every EngineStage mount (Overview's and PartView's each
  // own one): the camera's last known position and which part was open
  // last, so a zoom reversal keeps animating from where the forward zoom
  // left off instead of jumping straight to the overview on remount.
  const cameraRef = useRef<CameraTransform>(IDENTITY_CAMERA);
  const prevOpenRef = useRef<PartId | null>(null);
  // See OverviewScaleProbe: lets a closing part's camera compute a
  // reverse-zoom target that matches the overview's real on-screen scale
  // (lock §5), even though Overview itself is unmounted for that whole
  // 520ms.
  const overviewSheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const openPart = useCallback((id: PartId) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setClosing(false);
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
    setPlaying(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (reducedMotion) {
      // Lock §8: "Zoom in/out is a 150ms crossfade, not a camera move."
      // -- an instant state flip, crossfaded by the AnimatePresence wrap
      // below, with no 520ms reverse-zoom stagger.
      setOpenPartId(null);
      setClosing(false);
      return;
    }
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setOpenPartId(null);
      setClosing(false);
    }, CLOSE_MS);
  }, [reducedMotion]);

  const jumpPart = useCallback((id: PartId) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setClosing(false);
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
  // Keyed by *mode*, not by which part: jumping directly between open
  // parts (Shift+arrow, minimap) must not retrigger this crossfade or
  // remount EngineStage, only closing back to the overview (or opening
  // from it) should.
  const mode = currentPart ? "part" : "overview";

  return (
    <>
      <OverviewScaleProbe sheetRef={overviewSheetRef} />
      <AnimatePresence initial={false}>
        <motion.div
          key={mode}
          className="app-shell-anim"
          initial={reducedMotion ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 1 }}
          transition={{ duration: reducedMotion ? 0.15 : 0 }}
        >
          {currentPart ? (
            <PartView
              part={currentPart}
              stepNumber={step}
              playing={playing}
              speed={speed}
              reducedMotion={reducedMotion}
              closing={closing}
              cameraRef={cameraRef}
              prevOpenRef={prevOpenRef}
              overviewSheetRef={overviewSheetRef}
              onBack={closePart}
              onJumpPart={jumpPart}
              onReset={reset}
              onPrev={() => stepBy(-1)}
              onNext={() => stepBy(1)}
              onPlayPauseOrReplay={playPauseOrReplay}
              onJumpStep={goToStep}
              onSpeedChange={setSpeed}
            />
          ) : (
            <Overview
              visitedParts={visitedParts}
              reducedMotion={reducedMotion}
              cameraRef={cameraRef}
              prevOpenRef={prevOpenRef}
              onOpenPart={openPart}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
