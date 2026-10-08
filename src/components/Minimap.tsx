"use client";

import { PARTS, nextOpenPart, prevOpenPart } from "@/lib/parts";
import type { PartId } from "@/lib/types";

interface MinimapProps {
  currentId: PartId;
  onJump: (id: PartId) => void;
}

const OPEN_SHAPES: Record<PartId, { rects: Array<[number, number, number, number, number?]>; circles?: Array<[number, number, number]> }> = {
  parser: { rects: [[100, 150, 295, 290]] },
  escape: {
    rects: [[420, 404, 50, 182], [600, 488, 296, 98, 10]],
    circles: [[520, 446, 34]],
  },
  slices: { rects: [[886, 96, 300, 168]] },
};

const LOCKED_SHAPES: Array<{ rect: [number, number, number, number] }> = [
  { rect: [910, 496, 96, 82] },
  { rect: [1040, 380, 160, 96] },
];

export function Minimap({ currentId, onJump }: MinimapProps) {
  const prev = prevOpenPart(currentId);
  const next = nextOpenPart(currentId);

  return (
    <div className="mm">
      <div className="mm-h">
        <span className="lbl">Engine map</span>
        <span className="nav">
          <button
            type="button"
            aria-label={`Previous part: ${prev.number} ${prev.title} (Shift+Left)`}
            onClick={() => onJump(prev.id)}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={`Next part: ${next.number} ${next.title} (Shift+Right)`}
            onClick={() => onJump(next.id)}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M4.5 2.5 8 6 4.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </span>
      </div>
      <div className="mm-b">
        <svg viewBox="60 60 1340 560" role="group" aria-label="Engine map">
          <path
            d="M402 300H588M812 300H1240M520 306V400"
            stroke="#3a3f47"
            strokeWidth={6}
            fill="none"
          />
          <circle cx="700" cy="300" r={112} fill="none" stroke="#3a3f47" strokeWidth={4} strokeDasharray="12 10" />
          {LOCKED_SHAPES.map(({ rect: [x, y, w, h] }, i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke="#3a3f47"
              strokeWidth={4}
              strokeDasharray="12 10"
            />
          ))}
          {PARTS.map((part) => {
            const shapes = OPEN_SHAPES[part.id];
            const isCurrent = part.id === currentId;
            const stroke = isCurrent ? "#00ADD8" : "#5a5f67";
            const fill = isCurrent ? "#00ADD8" : "none";
            const fillOpacity = isCurrent ? 0.1 : undefined;
            const strokeWidth = isCurrent ? 6 : 5;
            return (
              <g
                key={part.id}
                role={isCurrent ? undefined : "button"}
                tabIndex={isCurrent ? undefined : 0}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={isCurrent ? undefined : `Jump to ${part.number} ${part.title}`}
                style={{ cursor: isCurrent ? "default" : "pointer" }}
                onClick={isCurrent ? undefined : () => onJump(part.id)}
                onKeyDown={
                  isCurrent
                    ? undefined
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onJump(part.id);
                        }
                      }
                }
              >
                {shapes.rects.map(([x, y, w, h, rx], i) => (
                  <rect
                    key={i}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={rx}
                    fill={fill}
                    fillOpacity={fillOpacity}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />
                ))}
                {shapes.circles?.map(([cx, cy, r], i) => (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={fill}
                    fillOpacity={fillOpacity}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />
                ))}
              </g>
            );
          })}
          <rect x={1254} y={262} width={122} height={76} fill="none" stroke="#5a5f67" strokeWidth={5} />
        </svg>
      </div>
      <div className="mm-f">
        {PARTS.map((part) =>
          part.id === currentId ? (
            <b key={part.id}>
              {part.number} {part.title}
            </b>
          ) : (
            <span key={part.id}>{part.number}</span>
          )
        )}
      </div>
    </div>
  );
}
