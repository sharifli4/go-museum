// Canonical list of go/ast node names the Parser/AST part is allowed to
// render (diagram node labels + plaque tooling lines), per lock §0: "the
// ones go/ast and go/scanner actually produce for that file." Shared, as
// plain JS, by both src/lib/parts.ts (the TS app) and
// scripts/check-parser.mjs (plain Node), so the real `go/ast` dump
// (go-check/parser/astdump) can assert every one of these actually
// appears in its output -- the UI can never invent a node name.
export const PARSER_AST_NODES = [
  { node: "*ast.File", detail: null },
  { node: "FuncDecl", detail: "main" },
  { node: "BlockStmt", detail: null },
  { node: "AssignStmt", detail: ":=" },
  { node: "BinaryExpr", detail: "+" },
  { node: "BasicLit", detail: "1" },
  { node: "BasicLit", detail: "2" },
  { node: "ExprStmt", detail: null },
  { node: "CallExpr", detail: null },
];

export function astDumpLine({ node, detail }) {
  return detail ? `${node} ${detail}` : node;
}
