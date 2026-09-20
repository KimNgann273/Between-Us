# Between Us: progress log

OART1033 A3.2 Code-Based Expression · due **Fri 2026-09-23, 11:59 PM**

Times are local (UTC+7). Newest entry first. For the full design see [docs/design.md](docs/design.md); for terms see [CONTEXT.md](CONTEXT.md).

## Status

| Part | State |
| --- | --- |
| Home screen | ✅ Rebuilt as the Instrument (v0.11): live world behind a ruled grid, stippled crosshair, live telemetry, title in mieszkanie9 |
| Drifting (`drifting.js`) | ✅ Working: spring-damped drift + cursor lean, scroll zoom, auto-zoom, captions, unlocks Receiving |
| Receiving (`receiving.js`) | ✅ Working: click to germinate, cursor leads hyphae, reserves run out short of the Nutrient, another network rescues and fuses, nutrients pulse across, First Spore revives |
| Giving (`giving.js`) | 🟡 v0.8 build works, now reaching through Cords (v0.10). Redesign agreed from the new board, not built yet: [docs/phase3-plan.md](docs/phase3-plan.md) |
| Outro | ✅ Five closing lines, played one at a time, Home under the last (v0.15) |
| Look (`render.js`) | 🟡 Glow sprites now cached per colour, which is what made Giving crawl (v0.14). Nutrient, junctions and pulses restyled off the starter visuals (v0.13). **Still not seen in motion** |
| Texture (`texture.js`) | ✅ Soil, drifting motes, vignette and film grain, all tunable from `TEXTURE` |
| Copy (`script.js`) | ✅ Board lines for all three phases in place, and the five closing lines written |
| Captions (`ui.js`) | ✅ Word-by-word reveal, ~2× faster than v0.8.3; click anywhere to finish the line. Resized, given a soft well so hyphae cannot eat the line, and hints split off into the Instrument's voice (v0.12) |
| Typography | ✅ All three faces embedded as data URIs and confirmed rendering; nothing is fetched (v0.13) |
| Sound | ⬜ Dropped for now (the Begin chime was considered and declined, v0.11) |
| Submission (journal PDF, Figma PDF + link, recording, screenshots, zip) | ⬜ Not started |

## Where to look

| To change | File |
| --- | --- |
| Phase 1 Drifting: cursor lean, wander, auto zoom-out | `drifting.js` |
| Phase 2 Receiving: the Nutrient, cursor steering, stalling, the rescue, nutrient flow (`RECEIVING` at the top) | `receiving.js` |
| The world every phase shares: spores, hyphae, growth, fusion, junctions, pulses (`WORLD`, `GROWTH`) | `receiving.js`, lower down |
| Phase 3 Giving: spreading, Cords, pulling the network, pulse waves (`GIVING` at the top) | `giving.js` |
| Loop, phase switching, mouse/scroll input, grab vs pan | `sketch.js` |
| Colours, glow, how anything looks | `render.js` |
| Grain, soil, vignette, dust motes (`TEXTURE` at the top) | `texture.js` |
| Camera: zoom, pan, world ↔ screen | `camera.js` |
| Everything the Narrator says | `script.js` |
| Captions, tabs, Home and Outro screens | `ui.js` |
| Home's Instrument: crosshair, stipple, telemetry, framing (`HOME_*`, `CROSS_*` at the top) | `landing.js` |
| Every face, embedded (mieszkanie9, Inter, IBM Plex Mono) | `fonts.css` |

## Log

### v0.15 · 2026-09-20 15:38 · The Outro plays its lines one at a time

`SCRIPT.closingLine` had grown from one line into five, but `UI.playOutro` still
treated it as one string. Two things came of that: `textContent = lines` on an
array renders it joined by commas, so all five sentences appeared at once as a
single run-on; and `outroHold(lines)` read `lines.length` as **5** — the number
of lines, not the number of characters — so the Home button arrived after 2.2
seconds regardless of how much there was to read.

`playOutro` now takes an array and plays it: each line fades in whole, rests for
its own length, fades out, and the next follows. The last one stays on screen
and the way back Home appears beneath it. A single string still works — it is
wrapped — so nothing else had to change.

**The beat was retuned for five lines, not one.** `outroHold` was 2000 + 40ms
per character, set when the Outro was one short line; at that rate the longest
of these sat for nearly six seconds. It is now 1400 + 28ms per character, with
`CLOSING_LAST_MS` giving the final line an extra 1.2s before Home arrives. The
`.closing-line` fade dropped 1.8s → 1s to match: at 1.8s each way between five
lines, most of the Outro was spent looking at nothing. All four values are named
constants at the top of `ui.js`, and `CLOSING_FADE_MS` must stay equal to the
`.closing-line` transition in `styles.css`.

Renamed `SCRIPT.closingLine` → `SCRIPT.closing`. Every other group in `SCRIPT`
is an array of lines named for its moment; this one was a singular name holding
five. Updated in `sketch.js`, and the Outro entry in [CONTEXT.md](CONTEXT.md)
no longer says "a single closing line".

Also gave `.closing-line` `text-wrap: balance` and 520 → 560px, because the
longest of the five was stranding "on." alone on a third row.

**Checked** by running the real `UI.playOutro` against the real `SCRIPT.closing`
on a fake clock and a fake DOM:

```
  2.4s  "You were helped."
  6.6s  "So you helped someone else."
 11.1s  "They helped another, and somewhere along the way, ..."
 17.5s  "No one stands alone anymore."
 22.0s  "You support the network, and the network supports you."   (stays up)
 27.1s  Home appears
```

And interrupted at 8s with Home: the sequence stops, lines three to five never
appear, and the Outro's own Home button never shows — the `outroToken` guard
holds. The Outro screen was also rasterized to check the type over black.


### v0.14 · 2026-09-20 15:12 · Why clicking a joined spore in Giving lagged

Reported after v0.13: in Giving, once everything is connected, clicking a spore
makes it crawl. Three causes, and **two of them were introduced by v0.13**.

**1. p5 does not cache tint(), and v0.13 tripled the number of tinted draws.**
This is the big one. `_getTintedImageCanvas` in p5 1.11.1 clears an offscreen
canvas the size of the sprite and redraws the sprite into it *four* times under
three composite modes, plus a `fillRect` — on every single tinted `image()`
call, even for a colour it just used. `Glow.draw` is one such call. Before
v0.13 the only glows were one per spore; v0.13 added one per junction and one
per pulse head, so in a connected Giving frame the count went from about 41 to
about 121 — roughly 605 offscreen canvas operations per frame.

`Glow` now bakes the colour into the sprite instead. Sprites are built on demand
and cached per hue (6° buckets) and saturation (10% buckets), and drawn with a
plain white tint, which is the one path p5 takes cheaply: set `globalAlpha`,
draw once. Same ~121 glows now cost ~121 canvas operations rather than 605 —
better than the piece was before v0.13, with three times as many glows in it.

**2. `pointAlong` walked the path from the start on every call.** O(points) per
sample, and it is sampled several times per pulse per frame. Now a binary search
over `cum`, which only ever increases. This was pre-existing, but v0.13's tail
made it hurt roughly nine times as much.

**3. v0.13's tail walked the path once per pass, five times over, for one
picture.** The tail is now sampled once, head first, and every pass reads the
same samples. `PULSE.samples` also dropped 16 → 10, which is not a compromise:
the hypha underneath only has a point every `GROWTH.segmentLength` (6) world
units, so sampling a 58-unit tail more than ~10 times just interpolates between
the same two points at a cost.

Measured with a counting harness that loads the real `render.js` and the real
`pointAlong`, at the `maxPulses` cap of 400:

| | pointAlong calls/frame | JS ms/frame |
| --- | --- | --- |
| v0.12 draw code | 2,400 | 1.6 |
| v0.13 as shipped | 22,800 | 8.7 |
| v0.13 fixed (this entry) | 4,400 | 4.6 |

The remaining gap to v0.12 is the look itself — five stroked passes and a glow
per pulse against six flat circles — and it is bought back several times over by
the glow cache, which the JS timing above does not capture.

**Checked:** re-rendered the Nutrient, junctions and a pulse through the
rasterizer after every change; the picture is unchanged from v0.13. All ten
scripts still parse as one shared scope.

**Not fixed, because it is a design call, not a bug:** one click sends a wave of
one pulse per spore (~27–40), and each wave lasts 20–30 seconds as it chains
outward. Clicking repeatedly stacks waves, and `GROWTH.maxPulses` lets 400 pile
up before it starts dropping them. Lowering that cap, or ignoring a click while
that spore's wave is still travelling, would both work — but both change how
Giving feels, so they are the student's call.


### v0.13 · 2026-09-20 14:41 · Fonts embedded, the world recedes to be heard, and the starter visuals are gone

**The fonts were the real risk, so they went first.** `index.html` fetched Inter
and IBM Plex Mono from Google's CDN, which means that opened offline from an
unzipped folder — how a marker opens it — the whole piece silently fell back to
system fonts: every caption, every tab, the telemetry, all of it. Both are now
embedded in `fonts.css` as data URIs beside mieszkanie9, and nothing is fetched
any more. Google's own latin subsets, taken as served: Inter is the variable
file, so one 48 KB face covers the 300 the body sets and the 400 the title falls
back to; IBM Plex Mono is 10 KB at the one weight the piece uses. Weights 200 and
italic 300 were being requested and are not set anywhere, so they are gone.

**Checked by eye** — Inter 300/400/700 render as three different weights, so the
variable axis works, and both faces are visibly not the system fallbacks. The
same render also confirms **mieszkanie9 loads from its data URI**, which had
been sitting unverified since v0.11.

**The world now steps back while the Narrator speaks.** The caption's well
(v0.12) only clears the ground directly behind the words; this is the wider
move. `body.is-narrating` fades a scrim over the canvas — uniform, with a little
more weight at the bottom — and releases it when the queue empties. It is the
piece quieting to be heard, and in Giving, where the mycelium fills the frame
and there is no empty ground left anywhere, it is what keeps the voice in front
of the picture instead of inside it. Between two lines the class stays on, so
the world does not breathe in and out per line.

**The Nutrient, junctions and pulses are off the starter visuals.** These were
the last three things drawn to "it works" rather than to anything, and next to a
First Spore with a wobbling body and a sprite glow they had started to show.

- **The Nutrient** was three stacked flat circles — the exact banding `Glow` was
  built to stop — around a disc, which is what every living thing here already
  is. It is now a cluster of grains under one warm glow: no lit centre per grain
  (that is spore grammar), each catching the light on its own beat so the
  cluster glitters instead of breathing. The grains are ordered outward and go
  out in order, so `amount` is legible without a number — the deposit is eaten
  from its edge and the last grain to go is the middle one. The scatter is a
  pure function of where the Nutrient sits, so it is identical every frame and
  in every re-run of the same world ([ADR 0002](docs/adr/0002-variation-fixed-at-world-creation.md)).
- **Junctions** were a dot inside a flat halo, which is also what a fork looks
  like — wrong for the one object that can be pulled and whose pull always
  reaches across more than one organism. A fusion is two organisms sharing one
  wall, so a junction is now a ring: a seam with the fused point inside it. When
  a pulse crosses, `flash` read backwards opens a second ring outward and fades
  it, so the joint answers rather than switching on.
- **Pulses** were five stacked circles that stepped straight across every curve
  and read as a caterpillar. The tail is now layered the way a hypha is — a long
  faint trace under progressively shorter, brighter ones — and follows the path
  the pulse is actually on.

**Three things only a render caught**, all of which the numbers agreed on:
1. My first tail stroked each segment with its own `line()`. Round caps overlap
   at every joint and double-blend, beading the tail. The real `traceHypha` uses
   one `beginShape()` and does not have this problem; the tail is now one
   continuous shape per pass for the same reason.
2. The tail was invisible. The hypha under it is already drawn at saturation 44
   and alpha 0.8, so a tail in the same colour simply disappears into it. What
   separates the two is heat, not brightness — the surge now runs whiter the
   closer it is to the head.
3. Where two passes ended at the same place, or one jumped far in brightness,
   its round cap showed as a notch part-way down the tail. Reaches are staggered
   and the alpha steps kept small.

**How it was checked.** `qlmanage -t` for everything in CSS. For the canvas, a
dependency-free rasterizer that loads the real `render.js` into a `vm` context
with stubbed p5 globals and calls the real `drawNutrient`, `drawJunctions` and
`drawPulses` — including `Glow.build()`, so the actual sprite falloff is used.
render.js itself is untouched by the harness. Rendered at `closeZoom` 3.0, the
zoom Receiving frames the Nutrient at: the Nutrient at four levels of `amount`,
junctions at four values of `flash`, and a pulse on a curved hypha.

**Still not verified:** p5's own `beginShape`/`vertex`/`endShape`, `tint` and
HSB colour — the stub reproduces their behaviour, not their code — and none of
it has been seen in motion. The tunables are `NUTRIENT`, `JUNCTION` and `PULSE`
at the top of each section in `render.js`.


### v0.12 · 2026-09-20 13:58 · The Narrator gets its own weight, and a browser at last

**A browser, sort of.** `qlmanage -t` rasterizes an HTML file through WebKit, so
the real stylesheet can finally be *looked at* instead of reasoned about. It runs
no JavaScript, so the p5 canvas is still unseen — but everything in `styles.css`
and `index.html` is now verifiable, which is most of the type in the piece.
Tested over a stand-in mycelium drawn in SVG with the piece's own colour rules
(hue 140–215, sat 55, bright line over a wide faint glow).

**The caption was too small and the hyphae ate it.** Confirmed by eye in Giving,
where the network fills the frame: at 16px in `--ink-dim`, bright hyphae ran
straight through the words and the end of a line was unreadable. Three changes:

- **Size.** `clamp(16px, 1.5vw, 20px)`, up from `clamp(14px, 1.5vw, 16px)`. The
  Narrator was set like chrome; it is a voice, and it now sits just under the
  Outro's closing line, which is the same voice saying the last thing it says.
- **A well, not a plate.** `.caption::before` is a feathered ellipse of the
  background with no edge to find, sized in percentages so it grows when the
  line wraps. It dims what is behind the words and nothing else. Each word also
  carries a tight background-coloured `text-shadow`, which is what handles the
  single bright hypha lying across a letter — no scrim reaches that.
- **Ink.** New `--narrator` (#c3ccc6): brighter than `--ink-dim`, still quieter
  than the organisms.

**Hints are not the Narrator.** Lines in (brackets) are the piece telling the
viewer what to do, so they are now set in the Instrument's voice — IBM Plex Mono,
uppercase, letterspaced, in `--hint` (the spore's green stepped back). The piece
already says "you can act here" in that green: the step-nav's ready arrow and
Begin. `isHint()` in `ui.js` drives it; the same test already controlled how long
a hint lingers.

Also: caption width 620 → 680px, bottom 64–84 → 72–92px (clears the step-nav at
phone widths), and `text-wrap: balance` so a wrapped line does not leave one
word alone on the second row.

**Checked:** rendered against the real `styles.css` over a dense tangle — one
line, a wrapped two-line, and a hint — all legible, the well invisible as a
shape, the step-nav clear. **Not verified:** `text-wrap: balance` (Quick Look's
WebKit ignores it; Safari 17.4+ and Chrome 114+ honour it), and the caption over
the *live* canvas rather than a stand-in.


### v0.11 · 2026-09-20 11:05 · Home is an instrument, and the piece has a name

The work is now called **Between Us**. *Entanglement* stays the guiding word for the brief, but it is no longer the title — a piece named after its own prompt reads like a submission rather than a work. `CONTEXT.md`, `PROGRESS.md` and `<title>` all follow.

Home was rebuilt from the Figma Title board, then rebuilt again after the design changed under it. The board asked for a pulsing network behind the title; that would have meant a second world that is not the one you enter, contradicting [ADR 0001](docs/adr/0001-one-continuous-world.md) and showing Giving's ending before the viewer had started. What Home shows instead is the **real First Spore**, dormant and breathing, held in an **Instrument**: a ruled grid, a stippled crosshair, and telemetry reading live camera and world values. Begin dismisses it — telemetry retracts off its own edges, grid and type go down, the camera pushes from Home's wider framing in to Drifting's — and it never returns. The reasoning is in [ADR 0003](docs/adr/0003-home-is-an-instrument-that-is-dismissed.md).

- **New file `landing.js`.** The Instrument's canvas marks, in screen space over the finished render. Crosshair arms hold off the spore by a gap that breathes with it; four brackets frame it without enclosing it; the Begin frame is read off the button's own `getBoundingClientRect()` so it fits whatever the type does at that size. Telemetry updates at 10 Hz off real values — camera position and zoom, spore count, germinated count, junction count, clock.
- **The marks are stippled on purpose.** The title face is built from scattered dots, and a ruled mechanical frame beside it read as two unrelated designs. Drawing the Instrument's own marks out of the same particles is what joins them; the grid stays geometrically exact, because that is the apparatus. This was decided by rendering both options and looking, not by argument.
- **The stipple has its own PRNG** (`mulberry32`), so it never draws from p5's random stream — the world's layout is seeded from that and has to stay identical ([ADR 0002](docs/adr/0002-variation-fixed-at-world-creation.md)). Offsets are generated once at init, so the marks don't crawl between frames.
- **`colorMode(RGB, 255)` inside the Instrument's `push()`.** `renderWorld()` sets HSB inside its own push/pop so the mode is restored, but the Instrument should not depend on that staying true.
- **`goHome()` now rebuilds the world.** ADR 0001 already said returning Home starts the piece over; the code only set `mode` and showed the screen, so pressing Home during Giving put the crosshair over a fully grown mycelium. `begin()` correspondingly stopped rebuilding the world, since Home always holds a fresh one now.
- **`windowResized()` re-frames Home.** The framing is a fraction of the viewport, so it has to be recomputed when the viewport changes.
- **The title face is embedded, not linked.** mieszkanie9 (wopi.art.pl, © 2000, from DaFont), subset to Latin letters, digits and a little punctuation, and carried as a base64 woff2 data URI in the new `fonts.css` — 370 KB .otf down to 73 KB. A data URI rather than a font file because the piece has to run from an unzipped folder over `file://`, where a separate font request is an origin check waiting to fail.
- **Copy.** Title, a specimen label (`[ SPECIMEN 001 · MYCELIUM · OBLIGATE MUTUALISM ]`), one tagline — *Survival is not an individual condition.* — and `[ BEGIN OBSERVATION ]`. The old blurb is gone: it explained the piece before the viewer had felt it, which is the Narrator's job and done better in Drifting. The course credit moved into the edge telemetry. "Obligate **Network**" became "obligate **mutualism**" — the first is banned vocabulary, the second is the actual mycological term.
- **Glossary.** **Dormant** was widened to mean simply *ungerminated*; it used to bundle appearance into the definition ("faint, colourless"), which made the First Spore an exception to a term it should fit. **Home** and **Instrument** added.
- **Phone and reduced motion.** Under 720px the telemetry collapses to two stacked centre lines and the grid tightens to 40px. Reduced motion keeps the specimen's breath — it is the only sign the thing is alive — and drops the title's drift and the camera push.
- **Checked:** all files parse; the composition was solved for collisions between the crosshair bracket and the card at nine viewport sizes from 390×844 to 1680×1050 (tightest clearance 26px, smallest bottom margin 33px); and the page was rasterized with the real CSS values and the exact stipple algorithm to be looked at rather than reasoned about. **Still not seen in a real browser** — see Next up.

### v0.10.5 · 2026-09-19 20:58 · Actually looked at it, and softened the shape

There is no browser on this machine, so the last four changes to the First Spore's body were built without ever being seen. Wrote a dependency-free rasterizer instead (PNG out through Node's own `zlib`) that runs the same maths — including p5's quadratic-through-midpoints smoothing — so the shape could be looked at rather than reasoned about. Two things came out of it, and both were things the measurements could not have caught.

**1. The 29px scale warning in v0.10.3 was wrong.** `fitZoom()` is `min(width / 2400, height / 1500)`, which on a 1440x900 window is **0.6**, not the 0.265 assumed. `closeZoom` is therefore 3.0, and the First Spore is **66px** across at it, 99px at `maxZoom`. The wobble reads clearly at that size. The whole "it may be too subtle to see" worry was arithmetic, and wrong.

**2. The faithful port reads as knobbly, not soft.** At the prototype's own frequencies (1.7 for the body, 2.1 for the trailing layer) the outline carries eight to ten small lobes and looks like a potato. The orb gets away with it because it draws at about 340px behind a 40px-blurred halo, which hides the lobe count; at 66px with a crisp edge the same numbers read as crinkly rather than jelly-like.

Three changes, all judged from rendered images rather than from numbers:

- **Frequencies down** — body 1.7 → **0.9**, trailing layer 2.1 → **1.2**. Fewer, broader lobes: a soft squash instead of a crinkle. `WOBBLE_LAYERS` documents the originals for anyone who wants the prototype's literal shape back.
- **The aura is no longer one hard outline.** The prototype blurs its outer layer by 40px; a real blur is far too expensive per frame, so the softness is stacked out of seven rings of the body's own shape at 0.05 alpha each. Drawn hard, that layer read as a *dark rim* around the body rather than a glow — clearly visible in the render, and invisible to every measurement taken before it.
- **A stronger, closer sheen**, because the body was otherwise a flat area of one colour with no volume in it.

Amplitude stays at the prototype's `squish: 0.28`, which v0.10.4 confirmed is exact.

**Checked:** rendered at 66px and 99px, the sizes the piece actually draws at, next to ordinary spores for comparison. Still not seen in a real browser — the rasterizer shares the maths but not p5's drawing code, so `quadraticVertex`, `tint` and HSB remain unverified.

### v0.10.4 · 2026-09-19 20:41 · Fix: the ported wobble was running at half amplitude

The student sent the orb's own source (`wobleor2d-loll/`). Its drawing code is byte-identical to [prototype-orb/](prototype-orb/) — the two differ only in their themes and in the newer one replacing the dialogue system with sliders — so v0.10.3 was ported from the right code, but one line of it was read wrong.

**The bug.** The prototype's `hash2` returns `(perm[...] / 255) * 2 - 1`, so its value noise runs **−1..1**, centred on 0. p5's `noise()` runs **0..1**. Porting the formula without remapping each sample made `loopNoise` return 0..1, so v0.10.3 subtracted 0.5 to centre it — and that halved the amplitude. `wobble: 0.28` means ±28% of the radius in the prototype; the port was doing ±14%. The note in v0.10.3 about the prototype's outline being "one-sided" was simply a misreading of that same line.

**The fix.** Each p5 sample is remapped to −1..1 before the octaves are combined, and `blob()` no longer subtracts 0.5. Measured against the prototype's own noise, on identical maths:

| | typical | peak |
| --- | --- | --- |
| prototype | 1.20 | 1.34 |
| port, corrected | **1.20** | **1.34** |
| port, as shipped in v0.10.3 | 1.09 | 1.16 |

The reference GIF frame measures about 1.22 wide-to-tall, which lands on the prototype's *typical* 1.20 — so the frame, the source and the port now all agree, which is the first time any two of the three have.

- `steps` 36 → **72**. The prototype uses 160 outline samples; at a sixth the screen size 72 is smooth enough and a third the cost.
- Seam mismatch 0.010%, minimum radius 0.762 of base, so the outline never inverts even at full amplitude.
- **Not ported:** the orb reseeds its noise permutation from `Math.random()` on every load, so it is a different blob each time. The First Spore stays on `noiseSeed(WORLD.seed)`, per [ADR 0002](docs/adr/0002-variation-fixed-at-world-creation.md).
- The scale caveat in v0.10.3 still stands, but is now half as pressing: the wobble is twice what it was.

### v0.10.3 · 2026-09-19 20:24 · The First Spore's body ported from the orb prototype

Took the wobble straight from [prototype-orb/](prototype-orb/) rather than inventing a second one, so the two directions share a technique instead of diverging. Three things came across that v0.10.2 was missing, and they are what the look was actually made of:

- **Two octaves of loop noise**, not one. A broad squash with a finer octave at 2.3× on top at half weight. One octave alone reads as a plain ellipse.
- **Three stacked outlines**, each at its own frequency *and* its own phase: an aura at 1.12× radius, a trailing layer at 0.94× that shows only where it bulges past the body, and the body at 1.0×. Different phases are what make them slide against each other rather than wobble as one rigid shape. Measured: the trailing layer is visible in **146 of 151** sampled moments, so it earns its draw.
- **Quadratic curves through the midpoints** between points (the prototype's `tracePath`) instead of `curveVertex`, which overshoots its points and bulges the corners.

Also ported: the very slow rock (about a two-minute period, so it never reads as spinning), and an off-centre sheen — drawn with the glow sprite so it has a gradient falloff, where a flat circle read as a disc.

**Changed from the prototype:** ~~its outline is one-sided — the body is never smaller than its radius and averages 14% larger, so centring it on 0.5 gives the identical shape variation without inflating the spore.~~ **This was wrong. See v0.10.4** — the prototype's noise is already centred, and this "correction" halved the wobble.

**Measured** (widest/narrowest across the body, sampled over 150 moments):

| squish | typical | peak |
| --- | --- | --- |
| 0.18 | 1.07 | 1.12 |
| **0.28** (the prototype's own value) | **1.11** | **1.19** |
| 0.34 | 1.13 | 1.24 |
| 0.42 | 1.17 | 1.30 |

Left at the prototype's **0.28**. Seam mismatch 0.037%, and the outline never inverts (minimum radius 0.91 of base).

**The caveat that matters: scale.** ~~The First Spore is about 29px across at the closest zoom, and the fine octave may vanish.~~ **The 29px was a miscalculation — see v0.10.5.** `fitZoom` is 0.6 on a 1440x900 window, so `closeZoom` is 3.0 and the First Spore is **66px** across, 99px at `maxZoom`. The wobble reads fine at that size.

**Checked:** seam continuity, outline never inverting, the deformation range, and that the trailing layer is visible — all measured in Node. Not seen in a browser.

### v0.10.2 · 2026-09-19 20:09 · The First Spore's outline deforms

- Reversed the Q2 decision on the strength of a reference GIF: the First Spore's body is no longer a circle. `blob()` in [render.js](render.js) draws a closed outline whose radius is pushed in and out by noise, so it squashes and rolls rather than only drifting and breathing. Every other spore stays a circle — cheap, and it makes the First Spore the only thing in the world that moves like that.
- **The outline has no crease.** Sampling `noise(angle)` would jump between `2*PI` and `0` and leave a seam down one side; the radius is sampled around a *circle in noise space* instead, which closes on itself. Measured seam mismatch: **0.003%**.
- **Tuned against the reference**, which measures about 1.22 wide-to-tall. Measured widest/narrowest across the blob over 80 sampled moments:

  | squish | lobes | typical | peak |
  | --- | --- | --- | --- |
  | 0.08 | 1.1 | 1.05 | 1.11 |
  | 0.12 | 1.1 | 1.08 | 1.18 |
  | 0.18 | 1.8 | ~1.15 | ~1.35 |
  | 0.24 | 2.0 | 1.23 | 1.53 |

  Set to **squish 0.18, lobes 1.8**. `lobes` is the character knob: low is a squashed ellipse, high goes knobbly. `squish: 0` restores a plain circle.
- The bright centre now leans with the drift instead of sitting dead centre, so the body stops reading as a flat disc.
- **Known mismatch:** the glow behind it is still a circular sprite, so at peak deformation it won't hug the body exactly. It is soft and seven times the body's size, so the gap should not read — worth a look, and fixable by deforming the glow too if it does.
- **Checked:** seam continuity and the deformation range measured in Node against 3D value noise. Not seen in a browser.

### v0.10.1 · 2026-09-19 19:58 · The First Spore wobbles more

- Drift 1.5 → **3.5** world units and body swell ±10% → **±16%**, so the wobble is actually visible rather than something you take on trust. Brightness variation unchanged.
- All four numbers are now one `WOBBLE` block at the bottom of [render.js](render.js), with `speed` to pace the whole thing at once.
- **Fixed while in there:** the horizontal drift and the glow brightness were reading from the same noise stream, so the spore brightened every time it leaned the same way. They have their own streams now, four in total.
- **Drift has a ceiling.** Hyphae are drawn from the spore's home position, so once drift approaches the body's radius (11 at rest) the body slides out from over its own threads. 3.5 is comfortably clear; much past 6 will start to show in Receiving and Giving, where the First Spore has hyphae. Noted in the code.
- Still colour and motion only — the outline stays a circle (Q2 option (c), deforming the body, was considered and passed on).

### v0.10 · 2026-09-19 19:47 · Three pieces of visual feedback, worked through and built

Design interview first (`/grill-with-docs`, nine questions over three rounds), then the build. Two decisions came out of it that the feedback itself didn't ask for: **Cord** is now in [CONTEXT.md](CONTEXT.md), and [ADR 0002](docs/adr/0002-variation-fixed-at-world-creation.md) records why variation is fixed at world creation.

**1. The spores.** The glow was four flat circles at 0.05 alpha, which banded. It is now one white radial-falloff sprite (`Glow` in [render.js](render.js)), built once and tinted per spore — a single continuous falloff, and one `image()` where there were four circles.

Dormant spores were flat grey dots and read as placeholders. They now carry a faint halo **with no colour in it**: the glossary defines Dormant as *colourless* and Germination as the moment colour arrives, so brightness is all they get. That keeps germination's payoff intact — it is still the moment a spore gains its hue.

The First Spore breathes on `noise()` instead of a sine, on three separate streams: body swell, glow brightness and a 1.5-unit drift off centre. **All of it is applied at draw time only.** `spore.x`/`y` are simulated — `springToward` carries velocity through them and Giving's `flex` drags the whole mycelium through them — so wobbling them there would travel out through every junction and shake the network.

**2. Every spore was the same stamp.** Every spore joined in Giving got `reachLimit 90`, `budget 900`, exactly 5 hyphae, and drew at radius 14. Each spore now carries a `variation`: body size (0.8–1.25×), hypha weight (0.8–1.3×), and how many hyphae it grows, how far they reach and how much they curl. The First Spore is exempt from the size and weight variation, so it stays the reference the others vary from.

These are derived from a **hash of the spore's own position**, not from `random()`, so rolling them takes nothing out of the seeded stream — the layout of seed 11 is byte-for-byte what it was. That is the claim [ADR 0002](docs/adr/0002-variation-fixed-at-world-creation.md) makes and the test below checks.

**3. The straight lines.** The feedback asked for the links to be drawn like the growth hyphae. They already were — there is no link-drawing code; the threads in Giving are real Hyphae grown by the same `steer`/`laySegment` as everything else. They came out straight because `sendReacher` set `wanderScale = 0.35` (the only place in the piece wander was ever suppressed) against a constant `lureStrength` of 3.5.

Two changes. **Wander goes back to 1**, matching every free-growing hypha. And a lure can now **ramp**: `hypha.lureRamp` fades it with distance from what it wants, so a strand barely feels the pull far out and only commits near the end. It has to be a curve — a linear fade still corrects the heading the whole way and grows a ruler.

`sendReacher` became **`sendCord`**: two or three real strands leave for the same spore, each with its own wander, so they drift apart and converge at the far end. The first to arrive makes the Junction; the rest keep growing so the Cord closes around it, and each stops as it arrives (`'bundled'`). A strand is fed by the network, so nothing stops it on its own — a stray one would circle its spore forever, which is the v0.8.2 bug again — so `cordSettle` stops whatever is still out three seconds after the Cord lands.

We chose real strands over drawing one path three times with offsets, so strands can genuinely cross and separate. Sag was considered and rejected: sag is gravity, and it reads as cable, not mycelium.

**Measured**, against the piece's own free-growing hyphae as the benchmark (straightness = end-to-end distance over length grown; 1.0 is a ruler):

| | straightness | |
| --- | --- | --- |
| free hyphae | 0.810 | the benchmark |
| cord strands, before | 0.962 | reads as a diagram |
| cord strands, now | 0.832 | |

`reachCommit` is the dial: 2 → 0.917, 3 → 0.895, 4 → 0.861, 5 → 0.832, 6 → 0.829. It sits at **5**, matching free hyphae. Higher also means more strands wander off and die at the world edge (4 at commit 4, 9 at commit 5, 14 at commit 6); drop it to 4 if the strays look untidy. `strandSpeed` went 2.2 → 3.2 to hold Giving's pacing against the extra wandering — time to done is 15.7s, unchanged.

**Checked:** `receiving.js` and `giving.js` run against a stub p5 in Node, with smooth value noise (a white-noise stand-in cancels itself out and makes every hypha come out straight, which hid the problem on the first run). Confirmed: the 40-spore layout is identical with and without variation; all five variation axes spread across their ranges; Giving reaches its 14-spore threshold in 15.7s; and after a further 100 seconds **zero** strands are still growing and zero Cords are in flight — nothing circles.

**Not verified in a browser.** There is no Playwright here, so the glow sprite, the halos and the wobble have been reasoned about and their maths checked, but not looked at.

### v0.9 · 2026-09-19 19:13 · Texture: soil, motes, vignette and film grain

- **Why:** the picture was clean vector shapes on flat `#06070c`, which reads as a diagram rather than something underground. Nothing in the frame had any surface.
- **New file [texture.js](texture.js)**, three layers, all generated once and only drawn each frame:
  - **Soil** — two scales of Perlin noise (broad patches with a finer mottle inside them) baked into one 538 × 336 image and scaled up over the world, so it stays soft. Seeded with `WORLD.seed`, so the ground is the same every visit, like the spore layout. Its alpha fades out near its own edges and it is drawn 12% larger than the world, so no rectangle of texture shows when the whole field is in view.
  - **Motes** — 90 specks of dust wandering on `noise()` in world units, deliberately dim and neutral grey so they never read as Spores. They are sub-pixel when the whole world is in view and only show up close.
  - **Vignette + film grain** — over the finished picture, in screen pixels. The grain is 3 pre-made 512 px speckle tiles, repeated across the canvas and swapped 24 times a second, each step shifted by a different amount so the repeat never settles into a pattern. Alpha is squared when the tiles are made, so most pixels are nearly clear and a few are bright: grain, not television static.
- **Cost per frame:** 13 `image()` calls and 90 circles. All the pixel work happens once, in `Texture.build()`.
- **All tunable from `TEXTURE` at the top of the file** — `grain`, `soil`, `vignette`, `motes` and the rest. Any of them set to `0` turns that layer off.
- Wired in: [render.js](render.js) calls `Texture.ground()` inside the camera and `Texture.overlay()` after it; [sketch.js](sketch.js) builds the layers in `setup()` and remakes the vignette on resize (it is cut to the canvas).
- **Checked:** `texture.js` run against a stub p5 in Node — the soil's corner alpha is 0 and its centre is not, `noiseDetail` is put back to p5's default so the phases' own `noise()` is untouched, the grain lands on 6 different offsets over 6 steps, and a resize rebuilds only the vignette (and disposes of the old one) while the soil and tiles are reused.

### v0.8.4 · 2026-09-18 17:05 · Captions run at about twice the speed, a word at a time

- **Why:** the narration was too slow to sit through. A line crossfaded in whole, then held for `2000 + chars * 40` ms, so Drifting's opening five lines took 21 seconds before the viewer could do anything.
- **Now:** `Caption` in [ui.js](ui.js) rebuilds each line as one `<span class="word">` per word and lets them rise in one at a time — a ~50 ms beat, a little more for a long word, a breath after a comma and a longer one after a full stop. Because the reveal already does most of the reading, the rest after the last word is only `700 + chars * 14` ms, and the crossfade between lines drops from 900 ms to 350 ms.
- **Click once to finish the line.** For readers faster than the Narrator, a click anywhere fills in the rest of the words at once. It deliberately does **not** skip to the next line: clicks are also how the viewer plays with the world, and the narration should not race ahead every time they touch a spore. The listener neither stops nor cancels the event, so the same click still reaches the canvas.
- **Hints still linger.** A line in (brackets) is telling the viewer what to do, so `readingTime()` gives it an extra 1600 ms — otherwise "(scroll to look around)" would have vanished a second after appearing.
- The Outro keeps its old, slower beat (`outroHold()`); the ending should not be hurried. `prefers-reduced-motion` reveals the whole line at once.
- **Measured:** all thirteen narration blocks total 121 s → 57 s (2.1×). Drifting's opening: 21.3 s → 10.4 s, or 7.3 s if the viewer clicks through.
- **Checked:** the real `Caption` run against a stub DOM and a virtual clock — word order and punctuation pauses, `skip()` mid-line and with nothing playing, and `clear()` on a phase change (pending timers all cancelled, `onDone` suppressed).

### v0.8.3 · 2026-09-17 23:25 · Phase 3 redesign agreed (not built)

- Went through the updated Phase 3 and Phase 4 sections of the FigJam board in a three-round design interview. Every question is answered, and the result is saved in [docs/phase3-plan.md](docs/phase3-plan.md).
- **In short:**
  - 27 spores, and all of them join.
  - The viewer starts the spread by clicking a dormant spore within reach.
  - Junctions are what you click (a Pulse) and drag (a pull through the whole network).
  - A fast cursor sweep makes nearby Junctions **Shimmer**.
  - "You moved one. The other moves too." is cut.
  - The Outro plays the board's Phase 4 lines one at a time.
- Still waiting for the student's final go. No code, CONTEXT.md or design.md changes yet.

### v0.8.2 · 2026-09-17 19:07 · Fix: revived hyphae circled in Giving

- **Symptom:** once the nutrients reached the First Spore, some of its hyphae grew round and round in tight circles instead of reaching outward. It showed in Giving, but the cause was in Receiving.
- **Cause:** while the hyphae reach, `leadHyphae()` gives each one a lure (the cursor, or the Nutrient) every frame. It stops running after the stall, and nothing cleared the lures, so on revival each hypha kept steering toward a fixed point. When that point was inside the new 300-unit reach (e.g. where the viewer had left the cursor, guiding toward the Nutrient), the hypha reached it and orbited it, and a strong lure also cancels the outward push. With the cursor held 280 units out toward the Nutrient, 11 hyphae never stopped and the worst turned 13 full circles, spending the revive budget on the spot.
- **Fix:** `revive()` in `receiving.js` now clears every First Spore hypha's `lure` and `lureStrength` before resuming them.
- **Checked:** headless with p5's globals in place, cursor held in five places during Receiving (up to 360 units out, on the Nutrient, and on the opposite side). No revived hypha turns more than a third of a circle; they grow out and stop at the reach limit, and Giving still joins all 40 spores.

### v0.8.1 · 2026-09-17 16:30 · Fix: Giving froze at the first join

- **Symptom:** in the browser, Giving stopped right after "So you reach back." Nothing moved any more, and scrolling no longer zoomed.
- **Cause:** `giving.js` had a top-level function named `join`. p5 has a global `join(list, separator)`, and in global mode p5 copies its functions onto `window` when the page loads, replacing ours. When the first reaching hypha arrived, `join(s, r)` called p5's version, which threw `TypeError: e.join is not a function` inside `draw()`. p5 only schedules the next frame after `draw()` returns, so the loop died. The camera never updated again, which is why zoom looked broken.
- **Fix:** renamed it to `joinNetwork`. No behaviour changed.
- **Why the v0.8 checks missed it:** the headless runs stubbed p5 and didn't install p5's globals, so our `join` was never replaced. The harness now overrides the same names p5 would. Checked all 72 top-level function names in the project against p5's globals: `join` was the only clash. Don't name a top-level function after a p5 function (`join`, `split`, `select`, `map`, `color`, `random`…).
- **Checked:** headless with p5's `join` in place, through a played Receiving and through the skip button. Giving joins all 40 spores and completes, with scroll, click-pulses and drags firing throughout, no errors, and no non-finite coordinates drawn.

### v0.8 · 2026-09-15 · Receiving and Giving, built from the Figma board

Built Phases 2 and 3 from the board (A3-WIP, Phase 2 and 3 sections) and the concept statement. `growth.js` had been merged into `receiving.js` and `mycelium.js` deleted by hand; kept that layout, so Receiving's story and the shared world live in `receiving.js`, Giving's in `giving.js`.

**Receiving** runs as a story in seven stages (waiting → reaching → stalled → rescuing → extending → flowing → revived):
- A fixed Nutrient sits 360 units from the First Spore. Clicking the spore germinates it; hyphae already facing the cursor turn to follow it, the rest grow steadily outward.
- The First Spore now grows on its own **reserves** (9000). As the last quarter is spent, every hypha slows together and stops branching, then all stop: "But it's too far...". A reach cap guarantees it stops 110 units short.
- The neighbouring spore now sits beyond the Nutrient (760 units out, off screen at first). It germinates, grows in fast, reaches the Nutrient ("Someone got there first."), then extends to your nearest tip and fuses.
- Five pulses carry the Nutrient along the real hyphae (Nutrient → their hypha → the junction → yours → the First Spore), shrinking it as they go. When the last arrives the First Spore gets new budget and reach, its stopped hyphae resume, and Receiving completes.

**Giving**:
- The First Spore sends reaching hyphae to the three nearest dormant spores; each spore joined glows in, grows five short hyphae, and after a moment sends two reachers on. Reachers pass through other hyphae, leaving junctions.
- Drag a joined spore: it follows the cursor up to 150 units, and every other spore moves 60% as far as the one a junction nearer. On release all spring home. Click a spore: a pulse wave travels out through every junction to every joined spore.
- Asks the viewer to zoom out and, if they never scroll, zooms out once by itself. Completes when a third of the spores have joined; the spread carries on.

**Shared pieces** (in `receiving.js`): fusion via a spatial grid, junctions (one per pair of spores per 50 units), pulses along real hypha paths (hyphae now remember their parent fork), a glow fade-in for newly germinated spores. `render.js` draws the Nutrient (amber), junctions, pulses and the fade-in, and bends hyphae with a pulled spore. `sketch.js` lets a phase `grab` what's under the cursor before a press becomes a pan; the TEMP skip button now fast-forwards a phase's story instead of just ticking it off, so Giving opens on a real network.

**Copy:** `script.js` restructured around the board's moments. Receiving splits the old `germinated` group into `germinated` / `sensed` / `stalled` and adds `gotThereFirst` and `revived`; Giving uses all nine board lines across `enter`, `firstJoin`, `handedOn`, `firstPull` and `done`. Added hints "(click the spore)", "(scroll to zoom out)" and "(drag a glowing spore, or click one)". Dropped, as not on the board: "One thread becomes another… and another.", "Look! Something else stirs in the dark beside you.", "You are not alone.", "As your paths weave together, isolation gives way.", "Bound to another, you are no longer fragile — you are a system.", "Something moved through you…", "Try pulling something.", "What began as a single spore is now an inescapable collective."

**Also:** removed the `index.html` tag for the deleted `mycelium.js`. The spore layout differs from before, because the neighbour's position and the Nutrient now shape where the other spores can go.

**Checked** headlessly, loading every script in `index.html` order with p5 stubbed:
- Receiving completes in ~37 s with no cursor, with the cursor on the Nutrient, and with it held on the opposite side. The stall happens on its own at ~20 s (the 45 s safety net never fires) and fusion is natural every time. The lifeline path's longest single step is ≤ 13 units, so pulses never jump.
- The cursor measurably steers: holding it in one direction puts 27% of all growth within ±30° of it, against 8% without.
- Giving joins all 40 spores by ~45 s and completes at ~19 s, with 85 junctions. Update and growth cost ~2 ms per frame at p95 with the whole network grown.
- Pulling a spore 650 units away moves it 150; neighbours move 90 / 54 / 32 and 12 at five junctions away. It settles back within 4 s. A click's wave reaches all 40 spores.
- Revisiting Receiving doesn't restart it; Home + Begin starts both stories over. No non-finite coordinate was ever drawn.
- Two problems the first pass had, both fixed before the numbers above: the stall only ever came from the safety net (38 hyphae still crawling at 28 s), and a pull barely moved spores two junctions away.


### v0.7.1 · 2026-09-14 · One file per phase

- Each phase now lives in its own file, so there is one obvious place to look when fixing a phase: `drifting.js` (67 lines), `receiving.js` (33), `giving.js` (24). Drifting's tunables (`AUTO_ZOOM_AFTER`, `DRIFT_RANGE`, `LEAN_MAX`, `LEAN_FALLOFF`, `DRIFT_SPRING`) moved with it.
- `sketch.js` drops 373 → 269 lines and is now just the spine: the p5 loop, journey state, canvas input, and the helpers the phases share (`springToward`, `easePointer`, `settleFirstSpore`, `hitsSpore`). `SETTLE_SPRING` and `POINTER_EASE` stay there because more than one phase uses them.
- The three files are loaded **before** `sketch.js` in `index.html`, because `const PHASES = [Drifting, Receiving, Giving]` is evaluated as `sketch.js` loads. Loading them after would throw a ReferenceError.
- Pure move: no behaviour changed, nothing renamed.
- Checked: all ten scripts parse; loading them in the exact order `index.html` declares raises no redeclaration or temporal-dead-zone error; `PHASES` resolves in order and every phase still has `enter`/`update`; an 8-second headless run of Drifting followed by germination in Receiving grew 23 hyphae as before.


### v0.7 · 2026-09-14 · Phases renamed: Drifting, Receiving, Giving

- The three phases are now **Drifting**, **Receiving** and **Giving** (were Drift, Reach, Web). The new names frame the arc as exchange rather than structure: the spore takes before it gives.
- Renamed across the phase objects and `PHASES` in `sketch.js`, the `SCRIPT` keys in `script.js`, the tab labels in `index.html`, the glossary in [CONTEXT.md](CONTEXT.md), [docs/design.md](docs/design.md) and [ADR 0001](docs/adr/0001-one-continuous-world.md). The old names are recorded in each glossary entry's `_Avoid_` line.
- No files moved and no behaviour changed. The layout is still by concern (camera, growth, render, ui), not by phase, so there are no per-phase files to rename.
- Deliberately left alone, because the words are ordinary English there and not the phase names: `const reach` (the click radius in `hitsSpore`), `drift` and `GROWTH.wander` (the hypha steering physics), `DRIFT_RANGE` / `DRIFT_SPRING` / `driftFirstSpore` (they describe the spore drifting, the motion), the Narrator's lines "you reach out" and "A spore drifts alone", and "Wood Wide Web" in the Mycelium entry.
- Log entries below this one still say Drift / Reach / Web, since they record what was true when written.
- Checked: all seven scripts parse, `PHASES` resolves in order Drifting → Receiving → Giving, and all 5 `SCRIPT.*` references resolve against the renamed keys.

### v0.6.1 · 2026-09-14 · Faster cursor following

- Retuned two constants in `sketch.js`: `DRIFT_SPRING` 3.2 → 7 (the spore chases the cursor about twice as eagerly) and `POINTER_EASE` 8 → 16 (the smoothed cursor trails the real one half as far behind).
- Still critically damped, so it arrives without wobbling: the simulation shows zero overshoot even at a 20 fps frame hitch.
- Trade-off measured: peak acceleration with a flung cursor is still 90% below the old first-order code, but with a deliberately jittery cursor the improvement drops from 51% to 15% — following faster necessarily lets more of the cursor's own jitter through.

### v0.6 · 2026-09-14 · Smoother cursor following in Drift

- The First Spore now moves on a critically damped spring (`springToward`) instead of a plain lerp, so it carries momentum and can no longer change direction inside a single frame. `settleFirstSpore` uses the same spring, which makes the handover from Drift into Reach continuous.
- Four causes of the jerkiness, all fixed: `driftFirstSpore` used raw unclamped `deltaTime`, bypassing the 0.05 s clamp in `draw()`, so a frame hitch threw the spore; the lean ramped then hit a hard `Math.min` cap, putting a corner in the pull; it followed the raw cursor, which arrives in bursts several pixels wide; and first-order easing has no velocity to carry.
- The lean now eases up to `LEAN_MAX` over `LEAN_FALLOFF` (120 units) on an exponential curve, and follows a smoothed cursor (`pointer.sx/sy`, eased at `POINTER_EASE`) rather than the raw one.
- New tunables at the top of `sketch.js`: `LEAN_FALLOFF`, `DRIFT_SPRING`, `SETTLE_SPRING`, `POINTER_EASE`. Spores carry `vx`/`vy` for the spring — the Web phase's pulls can reuse it.
- Checked in simulation: peak acceleration down 94% with a cursor flung around and stopped dead, 51% with a jittery cursor; the spring settles exactly on target with zero overshoot even at a 20 fps frame hitch.

### v0.5 · 2026-09-14 · Free look: drag to pan

- Left-click and drag now moves the camera around the world, in Reach and Web. A phase opts in with `pannable: true`, so Drift keeps its scripted zoom-out and cannot be dragged off the First Spore.
- Scroll zoom toward the cursor was already in both phases; it now clamps too, so zooming cannot push the view off the world either.
- `Camera.panBy()` moves the eased position as well as the target, so the world tracks the cursor exactly instead of lagging behind it. `Camera.clamp()` keeps the world edge at the screen edge, and pins an axis to the middle once the view is wider than the world.
- Clicks survive: a press only counts as a pan after 4 px of travel, and a phase's `pointerDown` now fires on release, so clicking the First Spore in Reach still germinates it.
- The canvas shows a grab cursor only where dragging does something.
- Checked: both files parse, and a Node simulation confirmed the pan distance, the clamping at all zoom levels, and the centre pin at fit zoom.

### v0.4.2 · 2026-09-11 16:17 · Temporary skip button

- Added a red **Skip ›** button (bottom left) for testing. It completes the current phase and moves to the next: Drift snaps to full zoom-out, Reach germinates the First Spore, Web goes to the Outro.
- All its code is one block marked `TEMP` in `sketch.js`, plus one call in `setup()`. **Remove before submitting** (the design has no skip).
- Growth values in `GROWTH` were retuned by hand (speed 20, budget 12000, 20 starting hyphae, max tier 9).

### v0.4.1 · 2026-09-11 16:08 · Project moved into its own folder

- All project files now live in `A3/entanglement/`: the web build, `lib/`, docs, the orb prototype and the Figma board export.
- Claude skill files (`.agents/`, `.claude/`, `skills-lock.json`) stay outside, in `A3/`, so they never end up in the submission.
- No code changes. All links and script paths are relative, so everything still works.

### v0.4 · 2026-09-11 16:05 · Hyphae emerge from the First Spore

- Fixed: clicking the First Spore in Reach marked it germinated but nothing grew, because growth didn't exist yet.
- Germination now sends 3 hyphae out from the spore. Each tip creeps forward slowly (about 10 world units per second), wanders on noise, keeps radiating outward and sometimes forks. Forks are thinner and slower.
- Each spore has a growth budget of 3000 units of hypha. Tuned in simulation: growth lasts about a minute and reaches about 450 units, past the neighbouring spore at 280. The first settings ran out in 22 s at 182 units.
- Growth runs every frame in every phase, so hyphae keep growing if you switch tabs.
- Starter hypha look in `render.js`: glow stroke under a thin bright line, a bead on each growing tip.
- Tunable values are in `GROWTH` at the top of `growth.js`.

### v0.3 · 2026-09-11 15:54 · Build step 1: scaffold and Drift

- Rebuilt `index.html` with three phase tabs (Drift / Reach / Web), a Narrator caption and an Outro screen.
- Copied p5.js 1.11.1 into `lib/` so the piece runs without internet.
- Split the code into plain script files: `script.js`, `growth.js`, `mycelium.js`, `camera.js`, `render.js`, `ui.js`, `sketch.js`.
- World: fixed layout of 40 spores in a 2400 × 1500 world, First Spore at the centre, its neighbour 280 units away.
- Camera: eased zoom, zoom toward cursor, screen ↔ world conversion.
- Drift working end to end. Reach partly started.
- Locked progression, revisiting phases, Home reset and Outro sequence wired up.
- Caption restyled for readability. Fixed two typos in the board lines.
- Checked: all scripts parse, and a Node simulation confirmed Drift completes and unlocks Reach.

### v0.2 · 2026-09-11 15:30 · Design interview

- Settled the design over four rounds of questions: 3 phases + Outro, one continuous world, junctions only where different spores fuse, bioluminescent colour for living things, locked progression, no skip key.
- Wrote [docs/design.md](docs/design.md), the glossary [CONTEXT.md](CONTEXT.md) and [ADR 0001: one continuous world](docs/adr/0001-one-continuous-world.md).

### v0.1 · 2026-09-11 14:58 · Concept and Figma board

- Chose **Entanglement** as the anchor word: fungal spores → hyphae → mycelial network ("Wood Wide Web").
- Concept statement, moodboard, brainstorm mind map, Phase 1–3 wireframes and draft dialogue on the Figma board (export saved at [reference/figma-board.png](reference/figma-board.png)).

### v0.0 · 2026-09-05 → 09-06 · Orb dialogue prototype (earlier direction)

- Branching-dialogue piece: a lone orb reacts to the viewer's replies with mood colours, a noise-wobbled blob and a glitch effect.
- Dropped in favour of the fungal network concept, but kept in [prototype-orb/](prototype-orb/) as iteration evidence for the process journal.

## Next up

1. **Open it in a browser.** Much less is unseen than it was: `qlmanage -t` covers all the CSS, and the Node rasterizer covers the canvas maths (v0.13). What neither can reach, and what a browser would settle in a minute: anything in **motion** (the Begin dissolve, the caption's word-by-word reveal, the narration scrim fading in and out, a pulse actually travelling), the stippled marks at real device pixel ratios, whether the Home scrim leaves the First Spore bright enough to read through it, and p5's own `beginShape`, `quadraticVertex`, `tint` and HSB colour, which the stub reproduces but does not run.
2. **Three loose ends from v0.11.**
   - `spore.dormant` in the code still means *faint and colourless*, while `CONTEXT.md` now defines Dormant as *ungerminated*. The telemetry reads `germinated` so it tells the truth, but the flag wants renaming (it is used in `render.js` and `growWorld`) — left alone for now because it touches the renderer.
   - The Figma Title board still says *Beneath the surface* and shows the old network background. The board is a graded deliverable with a public link, so it needs to match the build. A custom font will not render for anyone opening that link, so outline the title text in Figma or the marker sees a fallback.
   - **mieszkanie9's embedding bit is `fsType = 4`** — "Preview & Print", which is the designer restricting embedding — and the DaFont zip ships no licence file. Fine to keep for a graded assignment, and the decision to keep it was made knowingly, but credit **wopi.art.pl** in the process journal.
3. **Old item 1 — everything before v0.11.** There is no browser on the build machine, so everything since the texture layer was verified by maths and by an offline rasterizer, never by looking. Specifically unverified: p5's `quadraticVertex`, `tint` and HSB colour in the First Spore's body; the glow sprite and dormant halos; the soil, motes, vignette and grain; and Cords in Giving. Also still open from before: Giving runs past "So you reach back", zoom works, revived hyphae don't circle.
4. **Then tune by eye.** Every dial that was set from a number rather than from looking:
   - `WOBBLE.squish` (0.28) and `WOBBLE.speed` (1) — how wobbly and how fast the First Spore is, [render.js](render.js).
   - `WOBBLE_LAYERS[].freq` (0.9 / 1.2) — the lobe count. The orb prototype's own values are 1.7 / 2.1, which read knobbly at this size; swap back for its literal shape.
   - `GIVING.reachCommit` (5) — how late a Cord's strands commit. 4 is calmer and strays less.
   - `TEXTURE.grain` / `soil` / `vignette` / `motes` — any set to 0 turns that layer off.
   - `Glow.falloff` (2.6) — the shape of every glow in the piece.
5. **Phase 3 redesign** ([docs/phase3-plan.md](docs/phase3-plan.md)): every question answered; waiting for the student's go. Then update CONTEXT.md and design.md, and build it: 27 spores, click a spore to start, Junctions clicked and pulled, Shimmer, all join.
6. Polish, then sound if there's time.
7. Remove the temporary skip button (`TEMP` block in `sketch.js`).
8. Submission materials. Note the world is deterministic ([ADR 0002](docs/adr/0002-variation-fixed-at-world-creation.md)), so screenshots and the recording can be retaken and will match.
9. Decide what happens to `wobleor2d-loll/` at the repo root — the orb source the First Spore's body was ported from. It is reference, not part of the piece; either move it next to [prototype-orb/](prototype-orb/) as iteration evidence, or leave it out of the submission zip.

<!-- To log new work: add a "### vX.Y · YYYY-MM-DD HH:MM · title" entry at the top of the Log and update the Status table. -->
