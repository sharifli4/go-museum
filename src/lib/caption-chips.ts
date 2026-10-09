/**
 * Wraps known identifiers in a caption with hairline mono chips (lock §5.2:
 * "Identifiers sit in hairline mono chips"), without altering the verbatim
 * caption text itself. Only a short, hand-checked token list per part is
 * used, each verified against every caption in src/lib/parts.ts to avoid
 * matching English words (e.g. the article "a") instead of identifiers.
 */

export interface CaptionSegment {
  text: string;
  chip: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWordy(token: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(token);
}

export function chipTokensFor(tokens: readonly string[]): RegExp {
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  const pattern = sorted
    .map((t) => {
      if (!isWordy(t)) return escapeRegExp(t);
      // The slices part's only one-letter identifier is `a`, which also
      // collides with the English indefinite article: "a backing array"
      // in step 2's caption and "allocates a new array" in step 8's.
      // Exclude those two known phrases so the article is never chipped,
      // without needing a per-step token list.
      const guard = t === "a" ? "(?!\\s+(?:backing|new)\\b)" : "";
      return `\\b${escapeRegExp(t)}\\b${guard}`;
    })
    .join("|");
  return new RegExp(pattern, "g");
}

export function splitCaptionIntoChips(caption: string, tokens: readonly string[]): CaptionSegment[] {
  if (tokens.length === 0) return [{ text: caption, chip: false }];
  const re = chipTokensFor(tokens);
  const segments: CaptionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(caption))) {
    if (match.index > lastIndex) {
      segments.push({ text: caption.slice(lastIndex, match.index), chip: false });
    }
    segments.push({ text: match[0], chip: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < caption.length) {
    segments.push({ text: caption.slice(lastIndex), chip: false });
  }
  return segments;
}

export const CHIP_TOKENS: Record<string, readonly string[]> = {
  parser: [
    "println(x)",
    "*ast.File",
    "FuncDecl main",
    "AssignStmt",
    "BinaryExpr",
    "BasicLit",
    "CallExpr",
    "ExprStmt",
    "BlockStmt",
    "FuncDecl",
    ":=",
    "main",
    "x",
    "1",
    "2",
    "+",
  ],
  escape: [
    "println(p.Name)",
    "return &u",
    "p.Name",
    "newUser",
    "User",
    "&u",
    "ret",
    "main",
    "u",
    "p",
  ],
  slices: ["b := a[:2]", "b[0] = 9", "append(b, 4)", "[1 2 3]", "[9 2 4]", "a", "b", "c"],
};
