import type { PartId } from "./types";

/** The one machine SVG's native coordinate space (lock §3). */
export const VIEWBOX = { width: 1400, height: 668 } as const;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the escape part's richer "detail" sub-drawing (ported from the
 * escape zoom mock, authored in a 900×554 box) sits inside the shared
 * 1400×668 machine coordinate space. Chosen to overlay roughly where the
 * compact valve/stack/heap already live, so fading compact → detail reads
 * as the same assembly getting bigger, not a swap.
 */
export const ESCAPE_DETAIL_TRANSFORM = { x: 360, y: 239, scale: 0.6444 } as const;

export const ESCAPE_DETAIL_RECT: Rect = {
  x: ESCAPE_DETAIL_TRANSFORM.x,
  y: ESCAPE_DETAIL_TRANSFORM.y,
  width: 900 * ESCAPE_DETAIL_TRANSFORM.scale,
  height: 554 * ESCAPE_DETAIL_TRANSFORM.scale,
};

/**
 * The camera fits a slightly tighter crop than the full detail drawing
 * (which has empty margin above the bus riser and below the free tray),
 * so the zoomed stage reads closer to the mock's edge-to-edge framing.
 */
export const ESCAPE_CAMERA_RECT: Rect = {
  x: ESCAPE_DETAIL_TRANSFORM.x,
  y: ESCAPE_DETAIL_TRANSFORM.y + 18 * ESCAPE_DETAIL_TRANSFORM.scale,
  width: 900 * ESCAPE_DETAIL_TRANSFORM.scale,
  height: 445 * ESCAPE_DETAIL_TRANSFORM.scale,
};

/**
 * Camera zoom target per part, in machine coordinates. Escape zooms onto
 * its detail sub-drawing; parser and slices (not yet steppable in this PR)
 * zoom onto their existing compact art, enlarged.
 */
export const PART_ZOOM_RECTS: Record<PartId, Rect> = {
  parser: { x: 34, y: 12, width: 376, height: 434 },
  escape: ESCAPE_CAMERA_RECT,
  slices: { x: 800, y: 58, width: 390, height: 214 },
};

export interface CameraTransform {
  x: number;
  y: number;
  scale: number;
}

export const IDENTITY_CAMERA: CameraTransform = { x: 0, y: 0, scale: 1 };

/** Scale + translate so `rect` fills the viewBox, centered (meet behavior). */
export function cameraTransformFor(rect: Rect): CameraTransform {
  const scale = Math.min(VIEWBOX.width / rect.width, VIEWBOX.height / rect.height);
  const x = (VIEWBOX.width - rect.width * scale) / 2 - rect.x * scale;
  const y = (VIEWBOX.height - rect.height * scale) / 2 - rect.y * scale;
  return { x, y, scale };
}

export function cameraTransformForPart(id: PartId): CameraTransform {
  return cameraTransformFor(PART_ZOOM_RECTS[id]);
}

export function cameraCssTransform(camera: CameraTransform): string {
  return `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
}
