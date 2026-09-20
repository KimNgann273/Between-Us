# Between Us: agreed design

Settled in the design interview on 2026-09-11, and extended on 2026-09-20 in a second interview covering Home. Terms follow [CONTEXT.md](../CONTEXT.md). The world never resets between phases ([ADR 0001](adr/0001-one-continuous-world.md)); Home is an instrument that is dismissed ([ADR 0003](adr/0003-home-is-an-instrument-that-is-dismissed.md)).

The work is called **Between Us**. *Entanglement* is its guiding word for the brief, not its title.

## Flow

Home → Drifting → Receiving → Giving → Outro

| | Entry | Viewer can | Grows on its own | Done when |
|---|---|---|---|---|
| Home | Page load, and the Home button | Begin | The First Spore breathes; nothing grows | Begin clicked (the Instrument dissolves and the camera moves in to Drifting; nav hidden on Home) |
| Drifting | On the First Spore, close | Scroll zoom (slow auto-zoom if idle) | First Spore drifts on noise and leans toward the cursor | Zoom-out reaches the whole field |
| Receiving | Camera frames the First Spore and the Nutrient together | Click the First Spore to germinate it; move the cursor to lead its hyphae; scroll zoom; drag to pan | Hyphae facing the cursor follow it. The First Spore's reserves run out and every hypha weakens and stops just short of the Nutrient. Another network grows in from off screen, reaches the Nutrient first, then extends to your nearest tip and fuses; pulses carry the Nutrient across and the First Spore grows again | The nutrients arrive and the First Spore revives |
| Giving | Where Receiving left the camera; asks the viewer to zoom out (auto zoom-out once if they don't) | Drag a joined spore (the pull ripples through every junction, capped, springs back on release); click one to send a pulse through the whole network; scroll zoom; drag empty space to pan | The First Spore reaches for the nearest dormant spores; each joined spore glows, grows short hyphae, and reaches on for the next | A third of the spores have joined (the spread carries on after) |
| Outro | Next arrow on Giving | – | – | Black; closing line centred; then Home fades in below it |

## Rules

- **Progression:** a phase is locked until the previous one is done; the next arrow breathes when the current goal is met. Revisiting a phase brings back that phase's actions and never undoes growth. No skip key.
- **Home:** shows the real First Spore — dormant, breathing, alone — framed by the **Instrument**: a ruled grid, a stippled crosshair, and telemetry reading live camera and world values. Not a decorative background and not a second world: it is the world the viewer is about to enter, held a little further out than Drifting frames it. Arriving at Home always rebuilds the world, no confirmation.
- **The threshold:** Begin dismisses the Instrument in one gesture — telemetry retracts off its own edges, grid and type go down, the camera pushes in to Drifting's framing. Nothing cuts, so the world is continuous across it. The Instrument never returns, in any phase or on any revisit. The viewer starts at the distance an apparatus gives you, and Begin is the moment that distance is taken away.
- **Generative:** fixed layout every visit (world ≈ 3× the screen, ~40 spores). Variety comes from wander, branching and Nutrient steering reacting to the viewer.
- **Growth budget:** each spore has a total hypha length. As the last quarter is spent, all its hyphae slow and stop branching together, so growth reads as reserves running out. Exceptions: the spore that helps in Receiving grows freely until the first Fusion, and hyphae reaching for a spore in Giving are fed by the network.
- **Colour:** dark background. Dormant means ungerminated, not invisible: most dormant spores are faint and colourless, but the First Spore is dormant too and has had its colour from the start. Living things (spores, hyphae, pulses, junctions) glow bioluminescent; each spore has its own hue in a teal → green → blue band, and the First Spore is the most saturated. Junctions and pulses blend the hues they join.
- **Pulses** come from the viewer, with one exception: the nutrients carried across the first Fusion in Receiving.
- **Type:** the title is set in mieszkanie9 (wopi.art.pl, from DaFont), a hand-drawn face whose letters are built from scattered dots, in the spore's green carried most of the way back to the dark. Everything else on Home is IBM Plex Mono. Because a ruled mechanical frame beside that title reads as two unrelated designs, the Instrument's own marks — crosshair, brackets, the frame around Begin — are drawn as stipple in the same particulate vocabulary. The grid stays geometrically exact: it is the apparatus. Only what the apparatus lays on the specimen is made of the specimen's material.
- **Text:** a neutral Narrator in the bottom caption. Lines are triggered by moments, each followed by a short timed sequence. The Outro line is the one centred exception; the HUD hides during the Outro.
- **Platform:** desktop Chrome first, touch-friendly input. Under 720px Home keeps grid, crosshair, title, label and button, and collapses the telemetry from four corners to two centred lines. Reduced motion keeps the specimen's breath — the only sign the thing is alive — and drops the title's drift and the camera push.
- **Sound:** none. A chime on Begin was considered and declined: one sound effect in an otherwise silent piece reads as an accident rather than a choice. An ambient bed remains the better piece if there is ever time for it.

## Files

Plain `<script>` files (no modules) and a local p5, so the build works offline and when opened by double-click.

| File | Contents | Owner |
|---|---|---|
| `lib/p5.min.js` | p5.js 1.11.1 | – |
| `script.js` | Every caption line and the closing line | Student |
| `sketch.js` | setup/draw, phase flow, input (pan, grab), shared helpers | Student, with help |
| `drifting.js` | Phase 1 | Student, with help |
| `receiving.js` | Phase 2, plus the shared world: spores, hyphae, growth, fusion, junctions, pulses | Claude, with student |
| `giving.js` | Phase 3: spreading, flexing the network, pulse waves | Claude, with student |
| `render.js` | How spores, hyphae, the Nutrient, junctions and pulses look | Student |
| `camera.js` | Zoom, easing, pan, screen ↔ world coordinates | Claude |
| `ui.js` | Tabs, arrows, caption, Home and Outro screens | Claude |
| `landing.js` | Home's Instrument: crosshair, stipple, live telemetry, camera framing | Claude, with student |
| `fonts.css` | The title face, subset and embedded as a data URI so the build carries its own typography offline | Claude |
