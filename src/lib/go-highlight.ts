/**
 * Minimal, non-rainbow Go syntax coloring for the plaque's code card (lock
 * §5.2: "keywords may be #a9b4c2 and strings #c7c1b4, nothing more").
 * Purely cosmetic span-wrapping; never changes the line's characters.
 */

export interface CodeToken {
  text: string;
  kind: "plain" | "keyword" | "string" | "comment";
}

const KEYWORDS = ["package", "type", "struct", "func", "return"];
const TOKEN_RE = new RegExp(`(//[^\\n]*)|("(?:[^"\\\\]|\\\\.)*")|\\b(${KEYWORDS.join("|")})\\b`, "g");

export function tokenizeGoLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(line))) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), kind: "plain" });
    }
    if (match[1]) tokens.push({ text: match[1], kind: "comment" });
    else if (match[2]) tokens.push({ text: match[2], kind: "string" });
    else if (match[3]) tokens.push({ text: match[3], kind: "keyword" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), kind: "plain" });
  }
  return tokens;
}
