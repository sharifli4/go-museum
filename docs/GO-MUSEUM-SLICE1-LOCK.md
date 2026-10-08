# Go Museum — Slice 1 design lock (v2.1.1, The Go Engine)

Source of truth for the Next.js + SVG build. Mocks in this folder are the visual reference; where a mock and this file disagree, this file wins. v1 (the gallery floor plan) is in `archive/`. The vivid v2 renders are in `archive/v2-vivid/` and are not to be built. v2.1.1 is a spacing pass on v2.1. Content rules in §0 and every step in §6 are unchanged.

Slice 1 content is unchanged: three exhibits, nine steps each — **01 Parser / AST**, **02 Escape analysis**, **03 Slices**. What changed is the container. There is no lobby and no hallway. The three exhibits are parts of one machine.

## 0. Content rule

Show only real toolchain behavior. Never invent a compiler diagnostic, a token, an AST node name, or a slice length/cap.

Verified on this box with **go1.24.4** (`go build -gcflags=-m`, `go run`):

- Escape, the file in §6.2, prints exactly these three lines and no others:
  ```
  ./main.go:11:6: can inline main
  ./main.go:6:14: leaking param: name
  ./main.go:7:2: moved to heap: u
  ```
  `//go:noinline` is what keeps `newUser`'s frame in the story (`-m=2` adds `cannot inline newUser: marked go:noinline`; the plaque shows `-m`, not `-m=2`, so that line is not displayed).
- There is **no** "u does not escape" line for this program. Step 9 must not show one. The contrast is told in the caption only.
- Slices, the program in §6.3, ends as: `a` and `b` both `[9 2 4]` len 3 cap 3 and `a`/`b` share storage (`&a[0] == &b[0]`); `c` is `[9 2 4 5 6 7]` len 6 cap 6 on a **new** array (`&a[0] != &c[0]`). `c := append(...)` does not retarget `b`.
- Parser node names in §6.1 are the ones `go/ast` and `go/scanner` actually produce for that file (`AssignStmt` with `:=`, `BinaryExpr`, `BasicLit`, `CallExpr` inside `ExprStmt`, `BlockStmt`, `FuncDecl`, `*ast.File`).

## 1. Concept and visual language (v2.1)

**The Go Engine**, drawn as an engineering cutaway. Same machine, same parts, same interactions as v2. The register is a Teenage Engineering manual or a Linear surface: graphite, hairlines, one accent. Not a game, not neon.

**Color.** Near-monochrome. `--bg #0b0c0e`, `--panel #121417`, hairlines `--hair #2c3036` and `--hair-2 #3a3f47`, ink `#d9d6cf`, muted `#7d828a`. Exactly one accent, Go cyan `#00ADD8`, and only on: the hovered or focused part (its balloon, its label, its selection brackets), the Play/Replay key, the current scrubber tick, and the keyboard focus outline. Nothing else is cyan. Stack and heap are **not** color-coded as a rainbow: stack is hatched (`#6f8a7d` at low opacity), heap is a solid fill with a `#9a6f5f` outline. Both are also labeled. Gold `#f2c46d` appears in exactly one place: a 2px left rule on the current code line, plus a 6% tint behind that line. No glow on it.

**No neon.** No glows, no pulsing dots, no glowing pipes, no colored drop shadows, no spotlight blooms. Fills are flat. Strokes are 1px. The only shadow in the product is the dock's `0 8px 24px rgba(0,0,0,.35)`.

**Drawing.** Section views. Cut material is hatched (the band on a housing wall, half of the scanner disc, the valve body, the stack column). Centerlines are dash-dot. Datum lines carry arrowheads. Callouts are numbered balloons ①–⑥ with a leader to the feature: 1 parser, 2 escape, 3 slices, 4 scheduler, 5 GC, 6 maps. A fine grid (10px minor, 50px major) sits behind the sheet, with zone ticks and numerals on the frame. Title block, bottom right: `GO ENGINE` / `SLICE 1` / `REV 2` / `go1.24`. Labels are IBM Plex Mono, 10–11px, uppercase, tracking about .08em.

**Type.** IBM Plex Sans for UI, IBM Plex Mono for code, labels, counters. Headline is 18/500: "The Go Engine", with the plain subtitle "Source enters on the left. A running program leaves on the right." No eyebrow, no marketing line.

**Idle motion, and only this.** One 50px ink segment travels the main bus, 6s linear, loop. No spinning disc, no rotating core, no pipe dashes, no breathing glow. The mocks show that segment parked just right of the parser outlet. Reduced motion (§8) holds it still.

Contrast, measured: ink on `--bg` is 13.5:1, muted on `--bg` is 5.1:1, muted on `--panel` is 4.8:1. `--bg` on cyan is 7.4:1, so the Play glyph is `--bg`, never white. Focus: 1.5px cyan outline, 2px offset, `:focus-visible` only.

## 2. Breakpoints

| Viewport | Behavior |
|---|---|
| ≥ 1280 × ≥ 800 | Spec below. No document scroll on overview or part view. |
| 1024–1279 wide, height ≥ 700 | Same layout; plaque 380→332, diagram scales inside the stage. Still no page scroll. |
| width < 1024 **or** height < 700 | The gate in §9. No reflow. |

## 3. Machine layout

One SVG, `viewBox="0 0 1400 668"` (the v2 drawing offset 12px inside a sheet frame), `preserveAspectRatio="xMidYMid meet"`. Every part is its own `<g>` with a stable id. Pipes are paths shared by the groups they connect, not part of any one group, so a zoom can fade them independently.

Left → right along the main bus (y ≈ 300):

| Group id | What | Box (viewBox px) | State in slice 1 |
|---|---|---|---|
| `part-parser` | **01 Parser / AST**. Inlet duct, sectioned scanner disc at (195,246), token datum, two-link arm, tree | housing 100,150 → 395,440 | Interactive |
| `locked-scheduler` | **Scheduler reactor**, center. Dashed ring r=112 at (700,300), inner core, three dashed P nodes, label `G·M·P` | circle Ø 224 | Locked |
| `part-escape` | **02 Escape analysis**. Sorting valve at (520,446); stack column at x=420; heap tank 600,488 296×98 | the valve + both vessels | Interactive |
| `locked-gc` | **Garbage collector**, a dashed sweeper head docked on the heap tank's right | 910,496 96×82 | Locked |
| `part-slices` | **03 Slices**. Three header plates (`a`, `b`, `c`) and two racks | 886,96 300×168 | Interactive |
| `locked-maps` | **Maps**, a dashed 2×4 of empty buckets | 1040,380 160×96 | Locked |
| `output` | Scenery, not a part. A small terminal, `$ ./main` / `3` | 1254,256 122×88 | Not focusable |

A source card (the file `func main(){ x := 1 + 2 … }`) feeds the inlet duct. A hatched chassis runs along the bottom, dimensioned `COMPILE TIME` / `RUN TIME`. The title block sits bottom right.

Locked groups are dashed, with a balloon and the words `NOT YET OPEN` in muted mono. No pill. They stay in the tab order; Enter does not zoom. They have no steps. When another part is hovered they, and the other open parts, drop to opacity .62.

### 3.1 How a part is drawn

**01 Parser / AST.** An inlet duct (sectioned, hatched wall) drops into a scanner disc drawn as a section: hatched half, centerlines, twelve radial marks. Tokens `x` `:=` `1` `+` `2` sit on a datum line. A two-link arm with pivots and a hatched ground reaches toward the tree. Idle: nothing here moves.

**02 Escape analysis.** A sectioned valve body and a gate drawn as a flat bar. The left port feeds a hatched stack column. The right port feeds a solid heap tank holding a few unlabeled allocations, so it reads as shared storage. The gate's rest angle points between the ports; hover does not move it. Selection, in the mock, is four cyan corner brackets around the whole assembly plus balloon ② in cyan. The GC head hangs off the tank and is not part of this group.

**03 Slices.** Header plate per slice: name, len, cap. `a` (len 3 cap 3) and `b` (len 3 cap 3) both arrow into one rack `[9 2 4]`, labeled SHARED. `c` (len 6 cap 6) arrows into a second rack `[9 2 4 5 6 7]`, labeled NEW ARRAY. This is the end state, shown on the overview so the two-array fact is legible before opening. The steps (§6.3) build up to it.

## 4. Overview

Top bar, 52px, 1px `--hair` bottom border, padding `0 28px`.

- Left: a 20px registration mark (ink ring, cyan core, four ticks) + "Go Museum", Plex Sans 15/500.
- Right: three 14×2 pips, `--hair-2` at 0 explored, then "**0 / 3** parts explored". Fraction ink/500, words muted. A visited part fills its pip ink. `aria-label="0 of 3 parts explored"`.

Under the bar: "The Go Engine" at 18/500, and the subtitle in §1. At the right, plain muted 13px: "Click any part to open it." No chip, no dot, no dismiss button.

Each part is named by its balloon and a mono label, always visible. Hover or focus adds cyan to that balloon, label, and a set of corner brackets, and dims everything else to .62. The callout is a flat `--panel` card, 1px `--hair-2`, radius 6, no shadow and no accent border:

- a 20px cyan balloon with the number, the name at 15/500, and "9 STEPS" in mono at the right
- one line, 13 muted
- footer: stack hatch and heap solid swatches (escape only), and "Open →" in ink/500

Copy is unchanged. Escape: "A sorting valve: each value stays on the stack or goes to the heap." Parser: "Source is chopped into tokens and assembled into a tree." Slices: "Headers point at cells. Append can move one slice to a new array."

The mock hovers **02**. Its callout sits in the empty lower-left, clear of the stack column and the valve, with a hairline leader to balloon ②. Zone numerals on the sheet frame are omitted; the hairline grid and edge ticks stay. Each open part's balloon label has a quiet muted underline; locked parts stay dashed with `NOT YET OPEN`.

Footer, 12 muted: a solid line "Open part", a dashed line "Not yet open", the hatch swatch "Stack", the solid swatch "Heap", and keys `Tab` next part · `Enter` open · `Esc` back.

## 5. Zoomed part

Click or Enter on an open part:

1. **0–650ms**, `cubic-bezier(.22,.8,.2,1)`. The camera translates and scales so that part's group fills the stage. This is a transform on a camera group wrapping the SVG, not a swap to a different illustration. Pipes and the other groups fade out over the first 300ms.
2. **180ms delay, 420ms**, same curve. The plaque slides in from the right (24px travel).
3. **260ms delay, 320ms**. The dock fades up 16px. The minimap fades in.

Esc or "← Engine" reverses it in **520ms**, plaque and dock leaving in the first 200ms. Reduced motion: no transform; a 150ms crossfade between overview and part view.

### 5.1 Chrome

Top bar, 52px, three columns. Left: "← Engine", 40px hit area, radius 6 (Esc). Center: "Go Engine / **02 Escape analysis**", the number in muted mono. Right: three 2px pips, ink through the current part, + "Part **2** of 3".

No side doorways. Previous/next is the minimap and `Shift+←` / `Shift+→`.

### 5.2 Stage, plaque, dock

Stage is the flexible column, 1px `--hair`, radius 8, with the same 10/50px grid and edge ticks. No spotlight. The diagram SVG is inset `46px 24px 112px 24px` so the dock never covers it. A mono tag at the top left reads "DETAIL 2 · ESCAPE VALVE · SECTION", plus the hatch and solid swatches.

Plaque, **380px** (332px at 1024–1279): `--panel`, 1px `--hair`, radius 8, padding 20. Contents, in order:

1. "PART 02" in mono, plus the stack and heap swatches. No colored chips.
2. Name, Plex Sans 22/500. One-line subtitle, 13.5 muted.
3. Step caption. Kicker "STEP 4 OF 9" in muted mono, no dot. Body 16/1.5 (15.5 under 820px tall). Identifiers sit in hairline mono chips. `aria-live="polite"`.
4. Code card, `--bg`, 1px `--hair`, radius 6. Header in mono. Lines 12.5px, line-height 21 (19.5 under 820px). Gutter numbers `#5a5f67`. Current line: 2px `#f2c46d` rule and a `rgba(242,196,109,.06)` tint. No glow. Other lines are muted rather than a second syntax rainbow; keywords may be `#a9b4c2` and strings `#c7c1b4`, nothing more. Max 14 lines.
5. Tooling block, mono 11.5. The command in ink, then only real output lines. The line for this step is ink with a `▸` marker; the others are muted. Nothing is paraphrased. A muted "Verbatim output, go1.24.4" sits under them and is not part of the output.
6. A "NEXT" teaser, one sentence. Hidden on step 9, and **dropped first** if the plaque cannot fit at 1280×800 (the 1280 mock has no teaser; the 1440 mock does).

The dock was restyled in v2.1; its controls and behavior were not. States: `mock-dock-states.png`.

Flat bar, 56px tall, `--panel`, 1px `--hair`, **radius 8**, shadow `0 8px 24px rgba(0,0,0,.35)`, centered 18px up. Icons are 1.3px monochrome strokes, not filled glyphs, except Play. Order: Reset (40, radius 6, Home) · Prev (40) · **Play/Pause (40 square, radius 6, cyan fill, `--bg` glyph)** · Next (40) · scrubber · `4 / 9` · speed `0.5× 1× 2×` (1× default, selected = `--raise` with a hairline, not cyan). The scrubber is nine ticks of 1×10px: passed ticks are ink, the current tick is **2×18px cyan**, future ticks are `#5a5f67`. There is no filled track and no halo. While playing, a 1px ink segment grows from the current tick toward the next one (the dwell); it is not cyan. End replaces Play with a cyan Replay key, radius 6, and disables Next (icon `--hair-2`). Hovering a tick (150ms) raises it and shows a 300px tooltip, radius 6, 1px `--hair-2`, no glow: "STEP N" / "CLICK TO JUMP" and the caption. Focus per §1. Dwell 8s / 4s / 2s at 0.5× / 1× / 2×. `role="toolbar"`. Ticks are buttons, the current one `aria-current="step"`. Hit areas ≥ 40px except the tick pitch, which is 24 wide by 40 tall. Under the dock, muted 11.5: `Space` play / pause · `←` `→` step · `⇧` `←` `→` part · `Esc` engine.

The part mock is Escape at **step 4, paused**.

### 5.3 Minimap

Top-right of the stage, 224px, `--panel`, 1px `--hair-2`, radius 6, no shadow. Header "ENGINE MAP" plus two 28px buttons. Body: the same SVG, `viewBox="60 60 1340 560"`, stroked about 5px. Open parts not current are `#5a5f67`. Locked parts stay dashed. The current part is cyan at 10% fill and a cyan stroke (both vessels, since escape is one part). Footer: `01` · **02 Escape** · `03`, current in ink. Clicking a part jumps with the same zoom. Each open part in the map has an `aria-label` ("Jump to 03 Slices").

### 5.4 Escape cutaway, step 4

The zoomed drawing is the same valve, enlarged, at the step-4 state:

- Inlet labeled "FROM ENGINE BUS", with a centerline.
- Valve Ø 148, drawn as a section (hatched rim, open bore, centerlines). The gate is a flat bar thrown toward the heap port. Indicator `H` is a filled square; `S` is an empty one. A plate reads "DECISION / &u outlives frame". Balloon ① "ESCAPE GATE" names the flap.
- **Stack column** (left, hatched `#6f8a7d`): `main()` with `p *User` awaiting; `newUser`, active, holding `name "Kenan"`, a dashed slot `u … moved →`, and an ink-outlined slot `ret *User &u`. Below, a dashed "FREE" tray. Balloon ② "FRAME" points at the active frame.
- **Heap tank** (right, solid `#221d1b`, outline `#9a6f5f`): two neighbors (`[]byte`, `map[…]`) and the `User` value mid-arrival, an ink-outlined card "USER / {Name: "Kenan"}" sitting above its dashed landing seat. A dimension line under the seat reads "16 B". Balloon ③ "OBJECT".
- An ink arrow from the `ret` slot to that card, with an `&u` chip on the shaft. Balloon ④ "POINTER". The arrow is the pointer; the card is the value. No gold anywhere on the drawing. The stack column, the valve, and the heap tank are separated by about 16px more air than v2.1, so the pointer crosses open space. The current code line is a 2px `#f2c46d` rule and a 7% tint, with no glow.

`aria-label` on the diagram SVG restates the step in one sentence. Internal text is `aria-hidden`.

## 6. Parts and steps

```ts
type Part = {
  id: "parser" | "escape" | "slices";
  groupId: "part-parser" | "part-escape" | "part-slices"; // the <g> in the one SVG
  number: "01" | "02" | "03";
  title: string;
  accent: string;
  file: string;
  lines: string[];                 // ≤ 14
  steps: {
    caption: string;
    codeLine: number;              // 1-based; 0 highlights nothing
    partState: string;             // key the part's group switches on
    hint?: string[];               // verbatim toolchain lines; omit if none
  }[];                            // length 9
};
```

One camera, one SVG. A part view sets `partState` on its group (opacity and transform of sub-elements only — no second SVG). `hint` is either omitted or copied from real output.

### 6.1 Parser / AST — `part-parser`

Snippet (`main.go`), and the only file this part parses:

```go
package main

func main() {
    x := 1 + 2
    println(x)
}
```

No `-m` output here. The tooling line names the node, e.g. `go/ast · AssignStmt`.

| # | partState | line | what moves | caption |
|---|---|---|---|---|
| 1 | `source` | 4 | Only the source card is lit; wheel still | The file arrives as a rune stream. The scanner has not run. |
| 2 | `tokens` | 4 | Five chips leave the wheel: `x`, `:=`, `1`, `+`, `2` | The scanner emits five tokens: `x`, `:=`, `1`, `+`, `2`. |
| 3 | `define` | 4 | The `:=` chip turns and seats | `:=` is a declaration, not an assignment. The parser opens a new name. |
| 4 | `literals` | 4 | Arm places two `BasicLit` nodes | `1` and `2` become `BasicLit` nodes. |
| 5 | `binary` | 4 | A `BinaryExpr` node closes over them | `+` becomes a `BinaryExpr` with those two nodes as children. |
| 6 | `assign` | 4 | The line becomes one `AssignStmt` | The line becomes an `AssignStmt` with token `:=`. |
| 7 | `call` | 5 | A second statement node, `CallExpr` | `println(x)` is an `ExprStmt` holding a `CallExpr`. |
| 8 | `block` | 3 | Both statements hang off one `BlockStmt` | Both statements hang off the `BlockStmt` of `FuncDecl main`. |
| 9 | `file` | 1 | The tree roots at `*ast.File`; wheel stops | `*ast.File` is the root. The type checker walks it from here. |

The node for the current step is ink at 1.5px; earlier nodes are hairline; later ones are dashed. No second color.

### 6.2 Escape analysis — `part-escape`

```go
package main

type User struct{ Name string }

//go:noinline
func newUser(name string) *User {
    u := User{Name: name}
    return &u
}

func main() {
    p := newUser("Kenan")
    println(p.Name)
}
```

`codeLine` for the step that shows the diagnostic is **8** (`return &u`), because that is the return the caption is about. The compiler itself reports the declaration, line 7. Both stay; do not move the highlight to 7 to "match" the message, and do not rewrite the message to mention line 8.

From step 4 on, `hint` is the three lines in §0, with `./main.go:7:2: moved to heap: u` marked current. Steps 1–3 show no hint. Step 9 keeps the same three lines — it does not grow a fourth.

| # | partState | line | what moves | caption |
|---|---|---|---|---|
| 1 | `call` | 12 | A second frame drops into the stack column | `main` calls `newUser`. A second frame is pushed on the goroutine stack. |
| 2 | `stackAlloc` | 7 | `u` appears, solid, in `newUser`'s frame. Gate centered | `u` is allocated in `newUser`'s frame. Nothing points at it yet, so the stack is enough. |
| 3 | `seeReturn` | 8 | Gate twitches toward the heap port; indicator H fills | The compiler sees `return &u`. The address outlives the frame that owns it. |
| 4 | `inTransit` | 8 | The mock. Gate open to the heap; `User` in the chute; `&u` drawn back to `ret` | `u` escapes: its address is returned, so the compiler moves it to the heap. |
| 5 | `landed` | 8 | Card seats in the tank; the ink pointer now ends there | The `User` now lives at a heap address. `ret` holds `&u`, a pointer into the heap. |
| 6 | `framePop` | 9 | `newUser`'s frame collapses into the free tray. Tank unchanged | `newUser` returns and its frame is popped. The `User` on the heap survives. |
| 7 | `received` | 12 | The ink outline moves to `p` in `main`; the pointer starts there | `main` receives the pointer in `p`. The stack keeps the pointer, not the value. |
| 8 | `deref` | 13 | Arrow continues to a `Name "Kenan"` readout on the card | `println(p.Name)` follows `p` into the heap. The string header is read from there. |
| 9 | `contrast` | 7 | A ghosted second column, stack-only, tagged "freed with its frame", beside the real tank | If `u`'s address had never left the function, the frame would have freed it. No heap, no GC. |

### 6.3 Slices — `part-slices`

```go
package main

func main() {
    a := []int{1, 2, 3}
    b := a[:2]
    b[0] = 9
    b = append(b, 4)
    c := append(b, 5, 6, 7)
}
```

No compiler diagnostic. Growth is the runtime's, and the numbers below are measured, not assumed.

| # | partState | line | racks | caption |
|---|---|---|---|---|
| 1 | `header` | 4 | One empty header plate, no rack | A slice value is three words: pointer, length, capacity. Not the array. |
| 2 | `backing` | 4 | `a` len 3 cap 3 → `[1 2 3]` | `a` points at a backing array `[1 2 3]`, len 3, cap 3. |
| 3 | `reslice` | 5 | `b` len 2 cap 3 joins `a`'s arrow into the same rack | `b := a[:2]` shares that array. Its header is len 2, cap 3. |
| 4 | `shared` | 6 | Cell 0 flips to 9. Both headers still on it: `[9 2 3]` | Two headers, one array. `b[0] = 9` is visible through `a`. |
| 5 | `appendFit` | 7 | The write lands in the spare cell. No new rack | `append(b, 4)` still fits in cap 3, so it writes in place. No allocation. |
| 6 | `overwrite` | 7 | Rack is `[9 2 4]`. `a` and `b` both len 3 cap 3, still sharing | The array is now `[9 2 4]`. `a` sees the write at index 2. |
| 7 | `overflow` | 8 | The three new values wait at the rack's edge and do not fit | Appending three more ints needs len 6. Cap 3 cannot hold it. |
| 8 | `grow` | 8 | A second rack appears, cap 6. `c`'s arrow moves to it. `b`'s arrow stays | The runtime allocates a new array, copies, and points `c` at it. `b` is not retargeted. |
| 9 | `diverged` | 8 | The overview's picture: `a` and `b` share `[9 2 4]` len 3 cap 3; `c` is `[9 2 4 5 6 7]` len 6 cap 6 | `a` and `b` still share the old array. `c` has its own. The headers have diverged. |

## 7. Keyboard

Overview tab order follows the machine: `part-parser`, `locked-scheduler`, `part-escape`, `locked-gc`, `part-slices`, `locked-maps`, then the hint's dismiss. Enter on an open part zooms. Enter on a locked part does nothing but announce "Coming soon". Arrow keys do nothing on the overview.

Part view, on `window`, swallowed so nothing scrolls:

| Key | Action |
|---|---|
| `Space` | Play / pause. On step 9, Replay |
| `←` / `→` | Previous / next step, then pause |
| `Shift+←` / `Shift+→` | Previous / next **open** part (skips locked). Enters at step 1, paused |
| `Home` | Step 1, paused |
| `End` | Step 9, paused |
| `1`–`9` | Jump to that step, paused |
| `Esc` | Zoom back to the engine |

## 8. Reduced motion

`prefers-reduced-motion: reduce`, read on load and on change. No in-app toggle in slice 1.

- The bus segment holds still. There is no other idle motion to disable.
- No autoplay. Play still advances, but the part crossfades in 150ms and nothing translates.
- Zoom in/out is a 150ms crossfade, not a camera move. Plaque and dock appear with it, no slide.
- Hover callout and tooltip appear instantly. The tooltip delay is skipped.

## 9. Small-viewport gate

Width < 1024 or height < 700. Full viewport, `--bg`, centered, max-width 420:

- The mark + "Go Museum".
- "Best on a laptop or desktop." Plex Sans 20/500.
- "This tour is drawn for a window at least 1280×800. Widen the window to walk through it." muted 15/1.5.

No machine, no dock, no scroll.

## 10. Accessibility

- Ink on `--bg` 13.5:1, muted on `--bg` 5.1:1, muted on `--panel` 4.8:1. Diagram labels ≥ 11px at 1280, and never in muted below that size.
- Every control is a `button` or `a`, named, ≥ 40×40. The part groups are buttons (role and tabindex in the overview SVG, real buttons in the DOM if the SVG is not the hit target — the DOM wins if both exist).
- Focus ring per §1 on parts, minimap entries, plaque has none (it is not interactive), dock controls.
- Only the caption is `aria-live="polite"`.
- Color is never the only signal: the current part is also the breadcrumb, the brackets, and the minimap footer; stack vs heap is the hatch, the label, and the word.

## 11. Out of scope (slice 1)

Mobile layout beyond the gate. Audio or narration. Accounts, saved progress, auth. Search. Deep links. The insides of Scheduler, GC, and Maps (they are drawn and locked). A free camera, pan, or zoom other than the one part zoom. Editing the snippet. Any backend. Localization. A second diagnostic mode (`-m=2`) and any compiler line not printed in §0.

## 12. Mock index

| File | What it fixes |
|---|---|
| `mock-engine-overview.html` | The whole machine, 02 hovered, 0/3 explored |
| `mock-engine-overview-1440x900.png`, `mock-engine-overview-1280x800.png` | |
| `mock-engine-part-escape.html` | Zoomed escape valve, step 4, paused, with minimap, plaque, dock |
| `mock-engine-part-escape-1440x900.png`, `mock-engine-part-escape-1280x800.png` | |
| `mock-dock-states.html`, `mock-dock-states.png` | Dock states, restyled in v2.1; behavior unchanged |

v1 is in `archive/`. The vivid v2 renders and their lock are in `archive/v2-vivid/`.
