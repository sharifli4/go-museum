export type PartId = "parser" | "escape" | "slices";

export type GroupId = "part-parser" | "part-escape" | "part-slices";

export type LockedGroupId = "locked-scheduler" | "locked-gc" | "locked-maps";

export interface Step {
  /** 1-based step number, 1-9. */
  n: number;
  /** Key the part's SVG group switches on; drives which sub-elements show. */
  partState: string;
  /** 1-based line number in `lines` to highlight. 0 highlights nothing. */
  codeLine: number;
  /** One sentence describing what moves in the diagram this step. */
  whatMoves: string;
  /** The step caption shown in the plaque, verbatim from the lock. */
  caption: string;
  /** Verbatim toolchain output lines, in display order. Omit if none. */
  hint?: string[];
  /** Index into `hint` (0-based) of the line marked current/active. */
  hintCurrent?: number;
}

export interface Part {
  id: PartId;
  groupId: GroupId;
  /** "01" | "02" | "03" */
  number: string;
  balloon: number;
  title: string;
  /** One-line overview callout copy, verbatim from the lock §4. */
  overviewBlurb: string;
  /** One-line plaque subtitle, shown under the part name. */
  subtitle: string;
  /** The file name shown in the code card header, e.g. "main.go". */
  file: string;
  /** Source lines, 1-indexed by position (lines[0] is line 1). Max 14. */
  lines: readonly string[];
  steps: Step[];
}
