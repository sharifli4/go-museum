# Go Museum

Go Museum: interactive Go internals (slice 1: **The Go Engine**).

An engineering-cutaway diagram of a Go program's lifecycle — one SVG, one
camera. Click a part to zoom in and step through what the compiler and
runtime actually do, with every caption, code line, node name, and
toolchain/runtime fact pulled verbatim from (or machine-verified against)
real Go output. The design source of truth is
[`docs/GO-MUSEUM-SLICE1-LOCK.md`](docs/GO-MUSEUM-SLICE1-LOCK.md).

All three slice-1 parts are fully steppable end to end (9 steps each):
**Parser / AST**, **Escape analysis**, and **Slices**.

## Stack

Next.js (App Router) + TypeScript, inline SVG, Framer Motion for the
camera zoom and step tweens. Local only: no deploy, no backend, no auth,
no analytics.

## Requirements

- Node, pinned in [`.nvmrc`](.nvmrc) (also enforced via `engines` in
  `package.json`). If you use nvm: `nvm use`.
- Go **1.24.4** to run the Go checks (see below). Each `go-check/*/go.mod`
  pins this via a `go` directive, so Go's toolchain manager downloads
  1.24.4 automatically on first run even if your system Go is older
  (Go 1.21+).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm run start
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Regenerates all three Go-derived snippets, then `next dev`. |
| `npm run build` | Regenerates all three Go-derived snippets, then `next build`. |
| `npm run start` | `next start` (run after `build`). |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run check:go` | Runs all three Go checks below. |
| `npm run check:escape` | The escape-output check. |
| `npm run check:parser` | The go/ast node-name check. |
| `npm run check:slices` | The slice len/cap/pointer check. |
| `npm run generate:go-sources` | Regenerates the three `src/lib/*-source.generated.ts` files from their `go-check/*` programs. |

## The Go checks

Nothing the museum renders about real Go behavior is hand-typed and
trusted — each part has a Go program under `go-check/`, and the UI's
plaque snippet is *generated* from that exact program (never a
hand-copied, possibly-drifted duplicate), so the displayed code and the
verified code can't diverge.

### Escape analysis — `go-check/escape`

The plaque shows the real, verbatim output of:

```bash
cd go-check/escape && go build -gcflags=-m .
```

which must print exactly:

```
./main.go:11:6: can inline main
./main.go:6:14: leaking param: name
./main.go:7:2: moved to heap: u
```

(ignoring the `# <package>` header line Go prints first). `main.go` is
gofmt'd with **tab** indentation — 4-space indentation shifts the last
line's column from `7:2` to `7:5` and the check fails on purpose.

### Parser / AST — `go-check/parser`

`main.go` is the exact 6-line program the plaque shows. `go-check/parser/astdump`
is a second small program, in the same module, that parses `main.go` with
the real `go/parser` + `go/ast` (not a hand-rolled approximation) and
prints every node kind it actually produces, pre-order. `npm run
check:parser` asserts that the node names the UI renders — `AssignStmt`
with `:=`, `BinaryExpr` with `+`, two `BasicLit`s, `CallExpr` inside
`ExprStmt`, `BlockStmt`, `FuncDecl main`, `*ast.File` — are a subset of
what astdump actually printed, so the museum can never show a node name
`go/ast` doesn't really produce for this file.

### Slices — `go-check/slices`

`main.go` wraps the plaque's exact five statements (marked with
`// snippet:start` / `// snippet:end` comments) in a `main()` that also
prints `len`/`cap`/values for `a`, `b`, `c` and whether `&a[0] == &b[0]`
/ `&a[0] == &c[0]`. `npm run check:slices` runs it (`go run .`) and
asserts the real output is exactly: `a` and `b` both `len 3 cap 3`
`[9 2 4]` sharing storage (`&a[0] == &b[0]`), and `c` is `len 6 cap 6`
`[9 2 4 5 6 7]` on a new array (`&a[0] != &c[0]`) — i.e. that
`c := append(b, 5, 6, 7)` never retargets `b`. The UI snippet is
generated from the marked region, reassembled with the `package
main`/`func main() {`/`}` scaffold, so what's displayed is exactly those
five lines, nothing more.

Run everything with:

```bash
npm run check:go
```

CI (`.github/workflows/ci.yml`) pins Go 1.24.4 via `actions/setup-go` and
runs all three checks on every push/PR, alongside lint, typecheck, and
build.

## Project layout

```
docs/GO-MUSEUM-SLICE1-LOCK.md   design lock, source of truth
go-check/escape/                checked escape-analysis program
go-check/parser/                checked parser program + astdump tool
go-check/slices/                checked slices program (snippet + runtime facts)
scripts/                        codegen + the three Go checks
src/app/                        Next.js App Router entry (single route)
src/components/                 Overview, PartView, Dock, Plaque, Minimap, EngineStage
src/lib/svg/                    the one machine SVG's markup (compact + per-part detail layers)
src/lib/parts.ts                step content (captions/code/node names), verbatim from the lock
src/lib/geometry.ts             camera zoom math
```
