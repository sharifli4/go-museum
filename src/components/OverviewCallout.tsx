import type { Part } from "@/lib/types";
import { CALLOUT_BOXES } from "@/lib/callout-positions";

interface OverviewCalloutProps {
  part: Part;
}

export function OverviewCallout({ part }: OverviewCalloutProps) {
  const box = CALLOUT_BOXES[part.id];
  return (
    <div
      className="callout"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      aria-hidden="true"
    >
      <div className="top">
        <span className="n">{part.balloon}</span>
        <h2>{part.title}</h2>
        <span className="lbl steps">9 steps</span>
      </div>
      <p>{part.overviewBlurb}</p>
      <div className="foot">
        {part.id === "escape" ? (
          <span className="sw lbl">
            <span>
              <i className="sw-hatch" />
              stack
            </span>
            <span>
              <i className="sw-solid" />
              heap
            </span>
          </span>
        ) : (
          <span />
        )}
        <span className="open">Open →</span>
      </div>
    </div>
  );
}
