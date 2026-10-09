"use client";

import type { MutableRefObject } from "react";

interface OverviewScaleProbeProps {
  sheetRef: MutableRefObject<HTMLDivElement | null>;
}

/**
 * Lock §5 ("the last reverse frame equals the first overview frame"): the
 * overview's `.ov-sheet` and the zoomed part's `.diagram` box are
 * different-sized DOM containers for the exact same 1400x668 SVG
 * viewBox, so "camera at identity" renders at a different effective
 * px-per-viewBox-unit scale in each one. EngineStage needs the
 * overview's *real* box size to compute a reverse-zoom target that lands
 * on the overview's actual scale, not a flat identity -- but Overview
 * itself is unmounted for the whole 520ms of that reverse zoom.
 *
 * This renders Overview's layout-relevant chrome (same classes, same
 * text, so it occupies the same box) permanently, invisibly, and
 * independent of layout (`position: fixed`, `visibility: hidden`), with
 * no EngineStage/SVG inside -- `.ov-sheet`'s own box doesn't depend on
 * its content, only on this shell. Keep this in sync with Overview.tsx's
 * structure if that layout ever changes.
 */
export function OverviewScaleProbe({ sheetRef }: OverviewScaleProbeProps) {
  return (
    <div className="app-shell" style={{ position: "fixed", inset: 0, visibility: "hidden", pointerEvents: "none" }} aria-hidden="true">
      <header className="topbar">
        <div className="wordmark">Go Museum</div>
        <div className="progress">
          <div className="pips" />
          <span>0 / 3 parts explored</span>
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
          <div className="ov-sheet" ref={sheetRef} />
        </div>
        <div className="foot-row">
          <div className="notes">
            <span>Open part</span>
            <span>Not yet open</span>
            <span>Stack</span>
            <span>Heap</span>
          </div>
          <div className="keys">
            <span>Tab next part</span>
            <span>Enter open</span>
            <span>Esc back</span>
          </div>
        </div>
      </main>
    </div>
  );
}
