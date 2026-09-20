# Phase 3 (Giving) redesign: agreed plan, not built yet

Settled in a design interview on 2026-09-17, against the Phase 3 and Phase 4 sections of the FigJam board ([A3-WIP](https://www.figma.com/board/53zrCcC6QVK1OPe7Uv7uZr/A3-WIP?node-id=0-1)). Terms follow [CONTEXT.md](../CONTEXT.md).

**Status:** every question is answered, but the student has not yet given the final go-ahead. Once they do: update CONTEXT.md and design.md first, then build. Until then, [design.md](design.md) still describes Giving as it was built in v0.8.

## Decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | Keep drag-to-pull? The board dropped it | **Keep it**, and add the board's sweep and click. The pull is the only moment that shows "can't escape", and the concept statement depends on it. It is already built and cheap to run. |
| 2 | What is "the initial connection" on the board? | **A new viewer action** at the start of Giving; everything after it spreads by itself |
| 3 | What does "node" on the board mean? | **Junctions** |
| 4 | What does a fast cursor sweep do? | Junctions near the cursor **glow brighter for a moment**. Nothing travels and no spore particles drop. |
| 5 / 7 | How many spores, and does everyone join? | **About 27 spores** (down from 40), and **all of them join** |
| 6 | Phase 4 or Outro? | **Outro**: no tab, not a phase |
| 8 | What does the viewer drag to pull? | **Junctions for everything**: a quick click sends a Pulse, a drag pulls |
| 9 | The viewer's first action | **Click a dormant spore**; nothing starts until they do |
| 10 | "You moved one. The other moves too." | **Cut**; the first pull plays only "You're maintaining it." |
| 11 | Name for the sweep glow | **Shimmer** |
| 12 | Which dormant spores can be clicked to start | **Only those within reach** of the First Spore, and they breathe faintly |
| 13 | Hint order | Click a spore → zoom out → click/drag a knot (see flow below) |
| 14 | When Giving is done | **All 27 have joined**. If the viewer never pulled, "You're maintaining it." plays first. |
| 15 | Outro | The board's lines one at a time (below), about 3.5 s each |

## How Giving plays

1. **Arriving.** The camera stays where Receiving left it. The Narrator says "You remember the feeling. / Someone reached you when you couldn't reach far enough. / So you reach back.", then **(click a faint spore nearby)**.
2. **Choosing.** Dormant spores within reach of the First Spore breathe faintly. Clicking one sends the First Spore's hypha to it. Nothing spreads until the viewer does this.
3. **First join.** "One connection becomes another. / You give what you have. / They grow.", then **(scroll to zoom out)**. The camera zooms out by itself once, only if the viewer doesn't scroll, counted from this point.
4. **Spreading by itself.** Each spore that joins glows, grows short hyphae and reaches on for the next, including the First Spore's other reaching hyphae. The first time a helped spore helps another: "And because they grow, someone else can reach farther.", then **(click a bright knot to send light through it, or drag it)**.
5. **Pulling.** Dragging a Junction pulls its two spores. The pull passes through the whole network, is capped, and springs back on release. The first pull plays "You're maintaining it."
6. **Click.** A quick click on a Junction sends a Pulse outward from it through the whole network.
7. **Shimmer.** Moving the cursor fast, with no button held, makes nearby Junctions glow briefly.
8. **Done** when all 27 spores have joined. If the viewer never pulled, "You're maintaining it." plays first. Then "At some point, helping stops feeling like a choice. / Someone is always reaching, and now you're close enough to reach them." plays and the next arrow breathes.

**Assumptions:**
- The Junction from Receiving's fusion can be clicked or pulled before the viewer's first choice. It just isn't hinted yet.
- Revisiting Giving keeps the network and all its actions.
- Cursor speed and glow length for Shimmer are tuned by eye.

## Outro

Centred on black, one line at a time, about 3.5 s each:

1. You were helped.
2. So you helped someone else.
3. They helped another,
4. and somewhere along the way, help became something everyone depended on.
5. No one stands alone anymore.
6. You support the network, and the network supports you.
7. *(about 3 s of silence)*
8. Where does helping end, when everyone is connected?

The last line stays on screen, then Home fades in below it.

## What changes where

- **Code:**
  - `giving.js`: all of Giving. Pulling a Junction works by moving its two spores, so `render.js` doesn't change.
  - `receiving.js`: `WORLD.sporeCount` 40 → 27.
  - `script.js`: Giving hints, cut line, Outro lines.
  - `ui.js`: Outro plays several lines.
  - Retune `GIVING.reachDistance` so the spread crosses the wider gaps.
- **CONTEXT.md:**
  - Add **Shimmer**.
  - Update **Giving**: the viewer starts the spread, and Junctions are pulled.
  - Note that "node" (on the board) and "knot" (in hints) mean Junction.
- **design.md:** update the Giving and Outro rows. The rule "one centred line" becomes a sequence of lines.
