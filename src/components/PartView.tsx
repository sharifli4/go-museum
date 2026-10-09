"use client";

import type { MutableRefObject } from "react";
import { EngineStage } from "./EngineStage";
import { Minimap } from "./Minimap";
import { Dock, type Speed } from "./Dock";
import { Plaque } from "./Plaque";
import { PARTS } from "@/lib/parts";
import type { CameraTransform } from "@/lib/geometry";
import type { Part, PartId } from "@/lib/types";

interface PartViewProps {
  part: Part;
  stepNumber: number;
  playing: boolean;
  speed: Speed;
  reducedMotion: boolean;
  /** True for the ~520ms the part is zooming back out to the overview. */
  closing?: boolean;
  cameraRef: MutableRefObject<CameraTransform>;
  prevOpenRef: MutableRefObject<PartId | null>;
  onBack: () => void;
  onJumpPart: (id: PartId) => void;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlayPauseOrReplay: () => void;
  onJumpStep: (step: number) => void;
  onSpeedChange: (speed: Speed) => void;
}

const SECTION_TAG: Record<Part["id"], string> = {
  parser: "DETAIL 1 · PARSER / AST · SECTION",
  escape: "DETAIL 2 · ESCAPE VALVE · SECTION",
  slices: "DETAIL 3 · SLICES · SECTION",
};

export function PartView({
  part,
  stepNumber,
  playing,
  speed,
  reducedMotion,
  closing = false,
  cameraRef,
  prevOpenRef,
  onBack,
  onJumpPart,
  onReset,
  onPrev,
  onNext,
  onPlayPauseOrReplay,
  onJumpStep,
  onSpeedChange,
}: PartViewProps) {
  const partIndex = PARTS.findIndex((p) => p.id === part.id);
  const step = part.steps[stepNumber - 1];

  return (
    <div className="app-shell">
      <header className="pv-topbar">
        <button type="button" className="back" aria-label="Back to engine (Esc)" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M13 8H3m4-4L3 8l4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Engine
        </button>
        <nav className="crumb" aria-label="Breadcrumb">
          <span>Go Engine</span>
          <span>/</span>
          <b>
            <span className="n">{part.number}</span>
            {part.title}
          </b>
        </nav>
        <div className="count-top">
          <div className="pips" aria-hidden="true">
            {PARTS.map((p, i) => (
              <i key={p.id} className={i <= partIndex ? "on" : ""} />
            ))}
          </div>
          <span>
            Part <b>{partIndex + 1}</b> of {PARTS.length}
          </span>
        </div>
      </header>
      <div className="view">
        <section className="stage" aria-label="Part cutaway">
          <div className="ticks-x" />
          <div className="ticks-y" />
          <div className="stage-tag">
            <span className="lbl">{SECTION_TAG[part.id]}</span>
            {part.id === "escape" && (
              <>
                <span className="lbl sw">
                  <i className="sw-hatch" />
                  stack
                </span>
                <span className="lbl sw">
                  <i className="sw-solid" />
                  heap
                </span>
              </>
            )}
          </div>
          <div className="diagram">
            <EngineStage
              openPartId={part.id}
              currentStep={stepNumber}
              reducedMotion={reducedMotion}
              forceClosing={closing}
              cameraRef={cameraRef}
              prevOpenRef={prevOpenRef}
              onOpenPart={() => {}}
            />
          </div>
          <Minimap currentId={part.id} onJump={onJumpPart} />
          <div className={`dock-wrap${closing ? " leaving" : ""}`}>
            <Dock
              step={stepNumber}
              totalSteps={part.steps.length}
              playing={playing}
              speed={speed}
              steps={part.steps}
              reducedMotion={reducedMotion}
              onReset={onReset}
              onPrev={onPrev}
              onNext={onNext}
              onPlayPauseOrReplay={onPlayPauseOrReplay}
              onJumpStep={onJumpStep}
              onSpeedChange={onSpeedChange}
            />
            <div className="khint" aria-hidden="true">
              <span>
                <kbd>Space</kbd> play / pause
              </span>
              <span>
                <kbd>←</kbd>
                <kbd>→</kbd> step
              </span>
              <span>
                <kbd>⇧</kbd>
                <kbd>←</kbd>
                <kbd>→</kbd> part
              </span>
              <span>
                <kbd>Esc</kbd> engine
              </span>
            </div>
          </div>
        </section>
        <Plaque part={part} step={step} totalSteps={part.steps.length} closing={closing} />
      </div>
    </div>
  );
}
