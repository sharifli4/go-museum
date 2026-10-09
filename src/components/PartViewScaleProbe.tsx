"use client";

import type { MutableRefObject } from "react";

interface PartViewScaleProbeProps {
  stageRef: MutableRefObject<HTMLDivElement | null>;
}

/**
 * Lock §5 ("the last reverse frame equals the first overview frame in
 * position, scale, and crop"): the camera's closing target needs to know
 * what `.diagram`'s box *will be* once the plaque column has collapsed
 * (`.view.closing`, see globals.css) -- not its live box while the plaque
 * still occupies that column, which would still leave the final reverse
 * frame narrower (and cropped) than the overview's.
 *
 * Renders PartView's layout-relevant chrome (same classes, with the
 * plaque column already collapsed) permanently, invisibly
 * (`position: fixed`, `visibility: hidden`), with no `EngineStage`/SVG or
 * plaque/dock content inside -- `.stage`'s own box only depends on this
 * shell, not its content. `EngineStage` derives `.diagram`'s box from
 * this by subtracting the fixed inset (lock §5.2: "inset 46px 24px 112px
 * 24px"). Keep this in sync with PartView.tsx's structure if that layout
 * ever changes.
 */
export function PartViewScaleProbe({ stageRef }: PartViewScaleProbeProps) {
  return (
    <div className="app-shell" style={{ position: "fixed", inset: 0, visibility: "hidden", pointerEvents: "none" }} aria-hidden="true">
      <header className="pv-topbar" />
      <div className="view closing">
        <section className="stage" ref={stageRef} />
      </div>
    </div>
  );
}
