// The spine of the piece: the p5 loop, which phase the viewer is in, the
// input that reaches the canvas, and the helpers the phases share.
//
// What each phase actually does lives in its own file, one per tab:
//   drifting.js  receiving.js  giving.js
// The world itself (spores, hyphae, growth, fusion, pulses) lives in
// receiving.js, drawing in render.js, page chrome in ui.js, and everything
// the Narrator says in script.js.

const SETTLE_SPRING = 7;    // the softer spring that brings it home in Receiving and Giving
const POINTER_EASE = 5;    // how fast the smoothed cursor catches up to the real one

let world;
let journey;
let mode = 'home';          // 'home' | 'journey' | 'outro'
let clock = 0;
// `x`/`y` are the raw cursor; `sx`/`sy` trail behind them, smoothed. Pointer
// events arrive in bursts that can jump several pixels, and the spore follows
// the smoothed pair so that jitter never reaches it.
const pointer = { x: 0, y: 0, sx: 0, sy: 0, moved: false };

// ---- p5 ------------------------------------------------------------------

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('stage');
  listenForInput(canvas.elt);

  UI.init({
    begin,
    home: goHome,
    goTo,
    prev: () => goTo(journey.current - 1),
    next
  });

  world = createWorld();
  journey = newJourney();
  Landing.init();
  snapToHome();
  Texture.build();
  Glow.build();
  UI.showHome();
}

function draw() {
  const dt = Math.min(deltaTime / 1000, 0.05);
  clock += dt;
  easePointer(dt);
  if (mode === 'journey') PHASES[journey.current].update(dt);
  if (mode !== 'home') growWorld(world, dt);
  Camera.update(dt);
  renderWorld(world, clock);
  if (mode === 'home') Landing.draw(clock);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  Texture.build();   // the vignette is cut to the canvas, so it is remade here
  // Home's framing is expressed as a fraction of the screen, so it has to be
  // worked out again whenever the screen changes.
  if (mode === 'home') snapToHome();
}

// ---- journey -------------------------------------------------------------

function newJourney() {
  return { current: 0, done: [false, false, false], seen: [false, false, false] };
}

// Home always holds a fresh world (setup() and goHome() both build one), so
// Begin has nothing to reset: it only dismisses the Instrument and moves in.
//
// The dissolve, in one gesture: the telemetry retracts off its own edges, the
// grid and the type go down, and the camera pushes from Home's wider framing
// in to Drifting's. Nothing cuts, so the world is continuous across the
// threshold and the Instrument simply stops being there.
function begin() {
  if (mode !== 'home') return;
  document.body.classList.add('is-leaving');
  if (prefersReducedMotion.matches) {
    Camera.snapTo(world.first.homeX, world.first.homeY, Camera.closeZoom());
  } else {
    Camera.easeTo(world.first.homeX, world.first.homeY, Camera.closeZoom());
  }
  setTimeout(() => {
    if (mode !== 'home') return;   // Home was pressed again mid-dissolve
    document.body.classList.remove('is-leaving');
    mode = 'journey';
    UI.hideHome();
    goTo(0);
  }, LEAVE_MS);
}

// Returning Home starts the piece over rather than rewinding it (ADR 0001),
// and Home's composition is one spore in a crosshair, which a grown mycelium
// behind it would contradict.
function goHome() {
  mode = 'home';
  document.body.classList.remove('is-leaving');
  Caption.clear();
  world = createWorld();
  journey = newJourney();
  snapToHome();
  refreshCursor();
  UI.showHome();
}

function snapToHome() {
  const view = Landing.framing();
  Camera.snapTo(view.x, view.y, view.zoom);
}

function goTo(index) {
  if (mode !== 'journey' || index < 0 || index >= PHASES.length || !isUnlocked(index)) return;
  const firstVisit = !journey.seen[index];
  journey.current = index;
  journey.seen[index] = true;
  Caption.clear();
  PHASES[index].enter(firstVisit);
  refreshCursor();
  refreshUI();
}

function next() {
  if (!journey.done[journey.current]) return;
  if (journey.current === PHASES.length - 1) startOutro();
  else goTo(journey.current + 1);
}

function startOutro() {
  mode = 'outro';
  Caption.clear();
  UI.playOutro(SCRIPT.closing);
}

// Marks a phase's goal as met. Returns true only the first time.
function complete(phase) {
  const index = PHASES.indexOf(phase);
  if (journey.done[index]) return false;
  journey.done[index] = true;
  refreshUI();
  return true;
}

function isUnlocked(index) {
  return index === 0 || journey.done[index - 1];
}

function refreshUI() {
  UI.refresh({ ...journey, unlocked: PHASES.map((_, i) => isUnlocked(i)) });
}

// ---- input ---------------------------------------------------------------
// Pointer events cover mouse and touch. Each phase handles only the gestures
// it defines, which is how revisiting a phase brings its actions back.
// A phase opts into drag-panning with `pannable: true`. A phase can also claim
// a press for something under the cursor with `grab(point)`; it then gets
// `dragTo(point)` as the pointer moves and `release(point, dragged)` at the end.

// How far the pointer may travel before a press counts as a drag rather than
// a click. Without this, a shaky click would pan instead of hitting a spore.
const DRAG_SLOP = 4;

const drag = { panning: false, holding: false, travelled: 0, x: 0, y: 0 };

function currentPhase() {
  return mode === 'journey' ? PHASES[journey.current] : null;
}

function listenForInput(canvas) {
  window.addEventListener('pointermove', (e) => {
    if (!pointer.moved) {
      // Start the smoothed cursor where the real one is, or the spore lurches
      // across the screen chasing it from the top-left corner.
      pointer.sx = e.clientX;
      pointer.sy = e.clientY;
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.moved = true;
    if (!drag.panning && !drag.holding) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.travelled += Math.hypot(dx, dy);
    if (drag.holding) {
      const phase = currentPhase();
      if (phase && phase.dragTo) phase.dragTo(Camera.screenToWorld(e.clientX, e.clientY));
    } else if (drag.travelled > DRAG_SLOP) {
      Camera.panBy(dx, dy);
    }
  }, { passive: true });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const phase = currentPhase();
    if (phase && phase.wheel) phase.wheel(constrain(e.deltaY, -120, 120), { x: e.clientX, y: e.clientY });
  }, { passive: false });

  // Left button only. The press goes to the phase first (it may grab something);
  // otherwise it starts a possible pan. Release decides whether it was a drag
  // or a click, and only then hands the click to the phase.
  canvas.addEventListener('pointerdown', (e) => {
    const phase = currentPhase();
    if (!phase || e.button !== 0) return;
    drag.travelled = 0;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.holding = Boolean(phase.grab && phase.grab(Camera.screenToWorld(e.clientX, e.clientY)));
    drag.panning = !drag.holding && Boolean(phase.pannable);
    if (drag.holding || drag.panning) {
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;
    const dragged = drag.travelled > DRAG_SLOP;
    const held = drag.holding;
    const panned = drag.panning && dragged;
    endDrag();
    const phase = currentPhase();
    if (!phase) return;
    const point = Camera.screenToWorld(e.clientX, e.clientY);
    if (held) {
      if (phase.release) phase.release(point, dragged);
    } else if (phase.pointerDown && !panned) {
      phase.pointerDown(point, e);
    }
  });

  canvas.addEventListener('pointercancel', () => {
    const phase = currentPhase();
    if (drag.holding && phase && phase.release) phase.release(null, true);
    endDrag();
  });
}

function endDrag() {
  drag.panning = false;
  drag.holding = false;
  refreshCursor();
}

// The canvas shows an open hand only where dragging actually does something.
function refreshCursor() {
  const phase = currentPhase();
  const canvas = document.querySelector('#stage canvas');
  if (canvas) canvas.style.cursor = phase && phase.pannable ? 'grab' : '';
}

// ---- helpers ---------------------------------------------------------------

function easePointer(dt) {
  if (!pointer.moved) return;
  const k = 1 - Math.exp(-dt * POINTER_EASE);
  pointer.sx += (pointer.x - pointer.sx) * k;
  pointer.sy += (pointer.y - pointer.sy) * k;
}

// A critically damped spring: it carries velocity, so the thing keeps a little
// momentum and can never change direction within a single frame. That is what
// makes it read as something alive drifting, rather than a value being lerped.
// Critical damping (2 * sqrt(stiffness)) is the point where it arrives as fast
// as possible without overshooting into a wobble.
function springToward(thing, x, y, dt, stiffness) {
  const damping = 2 * Math.sqrt(stiffness);
  thing.vx += ((x - thing.x) * stiffness - thing.vx * damping) * dt;
  thing.vy += ((y - thing.y) * stiffness - thing.vy * damping) * dt;
  thing.x += thing.vx * dt;
  thing.y += thing.vy * dt;
}

function settleFirstSpore(dt) {
  const first = world.first;
  springToward(first, first.homeX, first.homeY, dt, SETTLE_SPRING);
}

function hitsSpore(point, spore) {
  const reach = Math.max(30, 24 / Camera.zoom); // stays clickable when zoomed out
  return Math.hypot(point.x - spore.x, point.y - spore.y) < reach;
}

// ---- the phases ------------------------------------------------------------
// Each phase lives in its own file, loaded before this one (see index.html):
//   1. Drifting  -> drifting.js
//   2. Receiving -> receiving.js
//   3. Giving    -> giving.js

const PHASES = [Drifting, Receiving, Giving];
