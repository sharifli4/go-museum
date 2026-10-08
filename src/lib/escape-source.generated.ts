// GENERATED FILE. Do not edit by hand.
// Derived from go-check/escape/main.go by scripts/generate-escape-source.mjs.
// Run `npm run generate:escape` to refresh after editing the Go source.

export const ESCAPE_GO_FILE = "go-check/escape/main.go";

export const ESCAPE_SOURCE_LINES: readonly string[] = [
  "package main",
  "",
  "type User struct{ Name string }",
  "",
  "//go:noinline",
  "func newUser(name string) *User {",
  "\tu := User{Name: name}",
  "\treturn &u",
  "}",
  "",
  "func main() {",
  "\tp := newUser(\"Kenan\")",
  "\tprintln(p.Name)",
  "}"
] as const;
