"use client";

import { useRef, useState } from "react";
import type { Step } from "@/lib/types";

export type Speed = 0.5 | 1 | 2;

const DWELL_MS: Record<Speed, number> = { 0.5: 8000, 1: 4000, 2: 2000 };

interface DockProps {
  step: number;
  totalSteps: number;
  playing: boolean;
  speed: Speed;
  steps: Step[];
  reducedMotion: boolean;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlayPauseOrReplay: () => void;
  onJumpStep: (step: number) => void;
  onSpeedChange: (speed: Speed) => void;
}

const SPEEDS: Speed[] = [0.5, 1, 2];

export function Dock({
  step,
  totalSteps,
  playing,
  speed,
  steps,
  reducedMotion,
  onReset,
  onPrev,
  onNext,
  onPlayPauseOrReplay,
  onJumpStep,
  onSpeedChange,
}: DockProps) {
  const ended = step >= totalSteps;
  const [hoverTick, setHoverTick] = useState<number | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHover = (n: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (reducedMotion) {
      setHoverTick(n);
      return;
    }
    hoverTimer.current = setTimeout(() => setHoverTick(n), 150);
  };
  const clearHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverTick(null);
  };

  const tickPitchPx = 216 / totalSteps;

  return (
    <div className="dock" role="toolbar" aria-label="Step controls">
      <button type="button" className="ib" aria-label="Reset to step 1 (Home)" onClick={onReset}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8a5 5 0 1 0 1.5-3.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M4.2 1.6v3h3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className="ib" aria-label="Previous step (Left arrow)" onClick={onPrev}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 3.5v9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M12.5 3.8v8.4L6.5 8z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      </button>
      {ended ? (
        <button type="button" className="replay" aria-label="Replay from step 1" onClick={onPlayPauseOrReplay}>
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13 8a5 5 0 1 1-1.5-3.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M11.8 1.6v3h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Replay
        </button>
      ) : (
        <button
          type="button"
          className="play"
          aria-label={playing ? "Pause (Space)" : "Play (Space)"}
          onClick={onPlayPauseOrReplay}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="4" y="3.2" width="2.6" height="9.6" fill="currentColor" />
              <rect x="9.4" y="3.2" width="2.6" height="9.6" fill="currentColor" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5 3.2v9.6L12.6 8z" fill="currentColor" />
            </svg>
          )}
        </button>
      )}
      <button
        type="button"
        className={`ib${ended ? " disabled" : ""}`}
        aria-label="Next step (Right arrow)"
        aria-disabled={ended || undefined}
        onClick={ended ? undefined : onNext}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M12 3.5v9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M3.5 3.8v8.4L9.5 8z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="vsep" />
      <div className="scrub" role="group" aria-label="Steps">
        <div className="track" />
        {playing && step < totalSteps && (
          <div
            key={`${step}-${speed}`}
            className="dwell"
            style={{
              left: `${12 + (step - 1) * tickPitchPx}px`,
              animationDuration: `${DWELL_MS[speed]}ms`,
            }}
          />
        )}
        <div className="ticks">
          {Array.from({ length: totalSteps }, (_, i) => {
            const n = i + 1;
            const isPast = n < step;
            const isCur = n === step;
            const isHover = hoverTick === n && !isCur;
            const cls = ["tick", isPast && "past", isCur && "cur", isHover && "hover"]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={n}
                type="button"
                className={cls}
                aria-label={`Step ${n} of ${totalSteps}`}
                aria-current={isCur ? "step" : undefined}
                onClick={() => onJumpStep(n)}
                onMouseEnter={() => scheduleHover(n)}
                onMouseLeave={clearHover}
                onFocus={() => scheduleHover(n)}
                onBlur={clearHover}
              >
                <i />
                {isHover && (
                  <span className="tip" role="tooltip">
                    <span className="t1">
                      <span>Step {n}</span>
                      <span>Click to jump</span>
                    </span>
                    <p>{steps[n - 1]?.caption}</p>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="count" aria-hidden="true">
        {step} <span>/ {totalSteps}</span>
      </div>
      <div className="vsep" />
      <div className="speed" role="radiogroup" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={s === speed}
            onClick={() => onSpeedChange(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
