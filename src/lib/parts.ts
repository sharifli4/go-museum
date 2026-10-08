import type { Part } from "./types";
import { ESCAPE_SOURCE_LINES } from "./escape-source.generated";

/**
 * Content copied verbatim from GO-MUSEUM-SLICE1-LOCK.md §6 and §0.
 * Do not invent captions, code, hints, tokens, AST node names, or
 * slice len/cap. See docs/GO-MUSEUM-SLICE1-LOCK.md for the source of truth.
 */

const PARSER_LINES = [
  "package main",
  "",
  "func main() {",
  "\tx := 1 + 2",
  "\tprintln(x)",
  "}",
] as const;

export const parserPart: Part = {
  id: "parser",
  groupId: "part-parser",
  number: "01",
  balloon: 1,
  title: "Parser / AST",
  overviewBlurb: "Source is chopped into tokens and assembled into a tree.",
  subtitle: "Source is chopped into tokens and assembled into a tree.",
  file: "main.go",
  lines: PARSER_LINES,
  steps: [
    {
      n: 1,
      partState: "source",
      codeLine: 4,
      whatMoves: "Only the source card is lit; wheel still",
      caption: "The file arrives as a rune stream. The scanner has not run.",
    },
    {
      n: 2,
      partState: "tokens",
      codeLine: 4,
      whatMoves: "Five chips leave the wheel: x, :=, 1, +, 2",
      caption: "The scanner emits five tokens: x, :=, 1, +, 2.",
    },
    {
      n: 3,
      partState: "define",
      codeLine: 4,
      whatMoves: "The := chip turns and seats",
      caption: ":= is a declaration, not an assignment. The parser opens a new name.",
    },
    {
      n: 4,
      partState: "literals",
      codeLine: 4,
      whatMoves: "Arm places two BasicLit nodes",
      caption: "1 and 2 become BasicLit nodes.",
    },
    {
      n: 5,
      partState: "binary",
      codeLine: 4,
      whatMoves: "A BinaryExpr node closes over them",
      caption: "+ becomes a BinaryExpr with those two nodes as children.",
    },
    {
      n: 6,
      partState: "assign",
      codeLine: 4,
      whatMoves: "The line becomes one AssignStmt",
      caption: "The line becomes an AssignStmt with token :=.",
    },
    {
      n: 7,
      partState: "call",
      codeLine: 5,
      whatMoves: "A second statement node, CallExpr",
      caption: "println(x) is an ExprStmt holding a CallExpr.",
    },
    {
      n: 8,
      partState: "block",
      codeLine: 3,
      whatMoves: "Both statements hang off one BlockStmt",
      caption: "Both statements hang off the BlockStmt of FuncDecl main.",
    },
    {
      n: 9,
      partState: "file",
      codeLine: 1,
      whatMoves: "The tree roots at *ast.File; wheel stops",
      caption: "*ast.File is the root. The type checker walks it from here.",
    },
  ],
};

const ESCAPE_HINT = [
  "./main.go:11:6: can inline main",
  "./main.go:6:14: leaking param: name",
  "./main.go:7:2: moved to heap: u",
];

export const escapePart: Part = {
  id: "escape",
  groupId: "part-escape",
  number: "02",
  balloon: 2,
  title: "Escape analysis",
  overviewBlurb: "A sorting valve: each value stays on the stack or goes to the heap.",
  subtitle: "The sorting valve. Each value stays on the stack or goes to the heap.",
  file: "main.go",
  lines: ESCAPE_SOURCE_LINES,
  steps: [
    {
      n: 1,
      partState: "call",
      codeLine: 12,
      whatMoves: "A second frame drops into the stack column",
      caption: "main calls newUser. A second frame is pushed on the goroutine stack.",
    },
    {
      n: 2,
      partState: "stackAlloc",
      codeLine: 7,
      whatMoves: "u appears, solid, in newUser's frame. Gate centered",
      caption:
        "u is allocated in newUser's frame. Nothing points at it yet, so the stack is enough.",
    },
    {
      n: 3,
      partState: "seeReturn",
      codeLine: 8,
      whatMoves: "Gate twitches toward the heap port; indicator H fills",
      caption: "The compiler sees return &u. The address outlives the frame that owns it.",
    },
    {
      n: 4,
      partState: "inTransit",
      codeLine: 8,
      whatMoves: "Gate open to the heap; User in the chute; &u drawn back to ret",
      caption: "u escapes: its address is returned, so the compiler moves it to the heap.",
      hint: ESCAPE_HINT,
      hintCurrent: 2,
    },
    {
      n: 5,
      partState: "landed",
      codeLine: 8,
      whatMoves: "Card seats in the tank; the ink pointer now ends there",
      caption: "The User now lives at a heap address. ret holds &u, a pointer into the heap.",
      hint: ESCAPE_HINT,
      hintCurrent: 2,
    },
    {
      n: 6,
      partState: "framePop",
      codeLine: 9,
      whatMoves: "newUser's frame collapses into the free tray. Tank unchanged",
      caption: "newUser returns and its frame is popped. The User on the heap survives.",
      hint: ESCAPE_HINT,
      hintCurrent: 2,
    },
    {
      n: 7,
      partState: "received",
      codeLine: 12,
      whatMoves: "The ink outline moves to p in main; the pointer starts there",
      caption: "main receives the pointer in p. The stack keeps the pointer, not the value.",
      hint: ESCAPE_HINT,
      hintCurrent: 2,
    },
    {
      n: 8,
      partState: "deref",
      codeLine: 13,
      whatMoves: 'Arrow continues to a Name "Kenan" readout on the card',
      caption: "println(p.Name) follows p into the heap. The string header is read from there.",
      hint: ESCAPE_HINT,
      hintCurrent: 2,
    },
    {
      n: 9,
      partState: "contrast",
      codeLine: 7,
      whatMoves: 'A ghosted second column, stack-only, tagged "freed with its frame", beside the real tank',
      caption:
        "If u's address had never left the function, the frame would have freed it. No heap, no GC.",
      hint: ESCAPE_HINT,
      hintCurrent: 2,
    },
  ],
};

const SLICES_LINES = [
  "package main",
  "",
  "func main() {",
  "\ta := []int{1, 2, 3}",
  "\tb := a[:2]",
  "\tb[0] = 9",
  "\tb = append(b, 4)",
  "\tc := append(b, 5, 6, 7)",
  "}",
] as const;

export const slicesPart: Part = {
  id: "slices",
  groupId: "part-slices",
  number: "03",
  balloon: 3,
  title: "Slices",
  overviewBlurb: "Headers point at cells. Append can move one slice to a new array.",
  subtitle: "Headers point at cells. Append can move one slice to a new array.",
  file: "main.go",
  lines: SLICES_LINES,
  steps: [
    {
      n: 1,
      partState: "header",
      codeLine: 4,
      whatMoves: "One empty header plate, no rack",
      caption: "A slice value is three words: pointer, length, capacity. Not the array.",
    },
    {
      n: 2,
      partState: "backing",
      codeLine: 4,
      whatMoves: "a len 3 cap 3 → [1 2 3]",
      caption: "a points at a backing array [1 2 3], len 3, cap 3.",
    },
    {
      n: 3,
      partState: "reslice",
      codeLine: 5,
      whatMoves: "b len 2 cap 3 joins a's arrow into the same rack",
      caption: "b := a[:2] shares that array. Its header is len 2, cap 3.",
    },
    {
      n: 4,
      partState: "shared",
      codeLine: 6,
      whatMoves: "Cell 0 flips to 9. Both headers still on it: [9 2 3]",
      caption: "Two headers, one array. b[0] = 9 is visible through a.",
    },
    {
      n: 5,
      partState: "appendFit",
      codeLine: 7,
      whatMoves: "The write lands in the spare cell. No new rack",
      caption: "append(b, 4) still fits in cap 3, so it writes in place. No allocation.",
    },
    {
      n: 6,
      partState: "overwrite",
      codeLine: 7,
      whatMoves: "Rack is [9 2 4]. a and b both len 3 cap 3, still sharing",
      caption: "The array is now [9 2 4]. a sees the write at index 2.",
    },
    {
      n: 7,
      partState: "overflow",
      codeLine: 8,
      whatMoves: "The three new values wait at the rack's edge and do not fit",
      caption: "Appending three more ints needs len 6. Cap 3 cannot hold it.",
    },
    {
      n: 8,
      partState: "grow",
      codeLine: 8,
      whatMoves: "A second rack appears, cap 6. c's arrow moves to it. b's arrow stays",
      caption: "The runtime allocates a new array, copies, and points c at it. b is not retargeted.",
    },
    {
      n: 9,
      partState: "diverged",
      codeLine: 8,
      whatMoves:
        "The overview's picture: a and b share [9 2 4] len 3 cap 3; c is [9 2 4 5 6 7] len 6 cap 6",
      caption: "a and b still share the old array. c has its own. The headers have diverged.",
    },
  ],
};

export const PARTS: readonly Part[] = [parserPart, escapePart, slicesPart];

export function getPart(id: string | null | undefined): Part | undefined {
  return PARTS.find((p) => p.id === id);
}

export function nextOpenPart(currentId: string): Part {
  const idx = PARTS.findIndex((p) => p.id === currentId);
  return PARTS[(idx + 1) % PARTS.length];
}

export function prevOpenPart(currentId: string): Part {
  const idx = PARTS.findIndex((p) => p.id === currentId);
  return PARTS[(idx - 1 + PARTS.length) % PARTS.length];
}
