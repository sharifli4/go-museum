// GENERATED FILE. Do not edit by hand.
// Derived from the snippet:start/snippet:end region of
// go-check/slices/main.go by scripts/generate-slices-source.mjs.
// Run `npm run generate:go-sources` to refresh after editing the Go source.

export const SLICES_GO_FILE = "go-check/slices/main.go";

export const SLICES_SOURCE_LINES: readonly string[] = [
  "package main",
  "",
  "func main() {",
  "\ta := []int{1, 2, 3}",
  "\tb := a[:2]",
  "\tb[0] = 9",
  "\tb = append(b, 4)",
  "\tc := append(b, 5, 6, 7)",
  "}"
] as const;
