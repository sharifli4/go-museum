# Go Museum

Go Museum: interactive Go internals (slice 1: **The Go Engine**).

An engineering-cutaway diagram of a Go program's lifecycle — one SVG, one
camera. Click a part to zoom in and step through what the compiler and
runtime actually do, with every caption, code line, and toolchain line
pulled verbatim from real `go build` output. The design source of truth is
[`docs/GO-MUSEUM-SLICE1-LOCK.md`](docs/GO-MUSEUM-SLICE1-LOCK.md).

This PR (slice 1, part 1) ships the machine, the overview, the zoom/dock/
plaque chrome, and the **Escape analysis** part fully steppable end to end
(9 steps). Parser/AST and Slices are drawn and clickable but not yet
steppable — that's slice 1 part 2.

## Stack

Next.js (App Router) + TypeScript, inline SVG, Framer Motion for the
camera zoom and step tweens. Local only: no deploy, no backend, no auth,
no analytics.

## Requirements

- Node, pinned in [`.nvmrc`](.nvmrc) (also enforced via `engines` in
  `package.json`). If you use nvm: `nvm use`.
- Go **1.24.4** to run the escape-output check. `go-check/escape/go.mod`
  pins this via a `go` directive, so Go's toolchain manager will download
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
| `npm run dev` | Regenerates the escape snippet, then `next dev`. |
| `npm run build` | Regenerates the escape snippet, then `next build`. |
| `npm run start` | `next start` (run after `build`). |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run check:escape` | The escape-output check, see below. |

## The escape-output check

The **Escape analysis** part's plaque shows the real, verbatim output of:

```bash
cd go-check/escape
go build -gcflags=-m .
```

which must print exactly:

```
./main.go:11:6: can inline main
./main.go:6:14: leaking param: name
./main.go:7:2: moved to heap: u
```

(ignoring the `# <package>` header line Go prints first). This matters
enough to automate: `go-check/escape/main.go` is its own tiny Go module,
gofmt'd with **tab** indentation (4-space indentation shifts the last
line's column from `7:2` to `7:5` and the check will fail). The UI never
hand-copies this snippet — `src/lib/escape-source.generated.ts` is
generated from `go-check/escape/main.go` by
`scripts/generate-escape-source.mjs` (run automatically before `dev`/
`build`, or directly via `npm run generate:escape`), so the plaque and the
checked program can't drift apart.

Run the check with:

```bash
npm run check:escape
```

or directly:

```bash
cd go-check/escape && go build -gcflags=-m .
```

CI (`.github/workflows/ci.yml`) pins Go 1.24.4 via `actions/setup-go` and
runs this on every push/PR, alongside lint, typecheck, and build.

## Project layout

```
docs/GO-MUSEUM-SLICE1-LOCK.md   design lock, source of truth
go-check/escape/                the checked escape-analysis program
scripts/                        codegen + the escape-output check
src/app/                        Next.js App Router entry (single route)
src/components/                 Overview, PartView, Dock, Plaque, Minimap, EngineStage
src/lib/svg/                    the one machine SVG's markup
src/lib/parts.ts                step content (captions/code/hints), verbatim from the lock
src/lib/geometry.ts             camera zoom math
```
