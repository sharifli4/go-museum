"use client";

import { useState, type CSSProperties, type MutableRefObject } from "react";
import { EngineStage } from "./EngineStage";
import { OverviewCallout } from "./OverviewCallout";
import { PARTS, getPart } from "@/lib/parts";
import type { CameraTransform } from "@/lib/geometry";
import type { PartId } from "@/lib/types";

interface OverviewProps {
  visitedParts: Set<PartId>;
  reducedMotion: boolean;
  cameraRef: MutableRefObject<CameraTransform>;
  prevOpenRef: MutableRefObject<PartId | null>;
  onOpenPart: (id: PartId) => void;
}

export function Overview({
  visitedParts,
  reducedMotion,
  cameraRef,
  prevOpenRef,
  onOpenPart,
}: OverviewProps) {
  const [activePartId, setActivePartId] = useState<PartId | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const activePart = activePartId ? getPart(activePartId) : undefined;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="wordmark">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="7.5" fill="none" stroke="#d9d6cf" strokeWidth="1.2" />
            <circle cx="10" cy="10" r="2.2" fill="#00ADD8" />
            <path d="M10 0.5v4M10 15.5v4M0.5 10h4M15.5 10h4" stroke="#7d828a" strokeWidth="1" />
          </svg>
          Go Museum
        </div>
        <div className="progress" aria-label={`${visitedParts.size} of ${PARTS.length} parts explored`}>
          <div className="pips">
            {PARTS.map((p) => (
              <i key={p.id} className={visitedParts.has(p.id) ? "on" : ""} />
            ))}
          </div>
          <span>
            <b>
              {visitedParts.size} / {PARTS.length}
            </b>{" "}
            parts explored
          </span>
        </div>
      </header>
      <main className="ov-main">
        <div className="ov-head">
          <div>
            <h1>The Go Engine</h1>
            <p className="sub">Source enters on the left. A running program leaves on the right.</p>
          </div>
          <p className="ov-hint">Click any part to open it.</p>
        </div>
        <div className="ov-wrap">
          <div className="ov-sheet">
            <EngineStage
              openPartId={null}
              currentStep={1}
              reducedMotion={reducedMotion}
              cameraRef={cameraRef}
              prevOpenRef={prevOpenRef}
              skipCameraAnimation
              onOpenPart={onOpenPart}
              onActivePartChange={setActivePartId}
              onLockedAnnounce={setAnnouncement}
            />
            {activePart && <OverviewCallout part={activePart} />}
          </div>
        </div>
        <div className="foot-row">
          <div className="notes" aria-hidden="true">
            <span>
              <i className="sw-line" />
              Open part
            </span>
            <span>
              <i className="sw-dash" />
              Not yet open
            </span>
            <span>
              <i className="sw-hatch" />
              Stack
            </span>
            <span>
              <i className="sw-solid" />
              Heap
            </span>
          </div>
          <div className="keys">
            <span>
              <kbd>Tab</kbd> next part
            </span>
            <span>
              <kbd>Enter</kbd> open
            </span>
            <span>
              <kbd>Esc</kbd> back
            </span>
          </div>
        </div>
      </main>
      <div aria-live="polite" className="sr-only" style={visuallyHiddenStyle}>
        {announcement}
      </div>
    </div>
  );
}

const visuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
};
