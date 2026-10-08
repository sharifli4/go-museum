import type { PartId } from "./types";

export interface CalloutBox {
  left: string;
  top: string;
  width: string;
  height: string;
}

/**
 * Overview callout placement, as a percentage of the 1400×668 sheet.
 * Escape's box is lifted verbatim from the overview mock (lock §4: "sits
 * in the empty lower-left, clear of the stack column and the valve").
 * Parser and slices use their own clear patches of the sheet.
 */
export const CALLOUT_BOXES: Record<PartId, CalloutBox> = {
  parser: { left: "2.000%", top: "68.862%", width: "23.571%", height: "16.168%" },
  escape: { left: "2.000%", top: "70.359%", width: "22.857%", height: "16.168%" },
  slices: { left: "85.000%", top: "1.497%", width: "14.714%", height: "16.168%" },
};
