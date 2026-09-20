// How everything looks. This is a starter: restyle it however you like.
// Everything is drawn in world units inside Camera.apply().

const PALETTE = {
  background: '#06070c',
  nutrientHue: 38            // warm amber, so the Nutrient stands apart from the teal-blue living things
};

// One radial falloff, built once per colour it is asked for and drawn from a
// cache. Stacking a handful of flat circles was cheaper but left visible rings;
// this is a single continuous falloff, and one image() per glow rather than
// four circles.
//
// The colours are baked in here rather than left to p5's tint(), because p5
// does not cache tinting. Every tinted image() call runs
// _getTintedImageCanvas, which clears an offscreen canvas the size of the
// sprite and redraws the sprite into it FOUR times under three different
// composite modes, plus a fillRect — on every call, even for a colour it just
// used. With a glow on every spore, every junction and every pulse head, that
// was comfortably the most expensive thing in the frame. A sprite that is
// already the right colour can be drawn with a plain white tint, which is the
// one path p5 takes cheaply: set globalAlpha, draw once, done.
const Glow = {
  sprites: new Map(),
  resolution: 256,
  falloff: 2.6,              // higher = tighter core and a longer, fainter tail
  hueStep: 6,                // degrees of hue per cached sprite
  satStep: 10,               // ...and percent of saturation

  build() {
    this.sprites.clear();
    this.ready = true;
  },

  // HSB in, 0-255 RGB out. The sprites are pixel buffers, so the conversion
  // cannot go through p5's colour object.
  _rgb(hue, saturation) {
    const h = ((hue % 360) + 360) % 360, s = saturation / 100;
    const k = (n) => (n + h / 60) % 6;
    const f = (n) => 255 * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
    return [f(5), f(3), f(1)];
  },

  _sprite(hue, saturation) {
    const h = Math.round(hue / this.hueStep) * this.hueStep;
    const s = Math.round(saturation / this.satStep) * this.satStep;
    const key = h * 1000 + s;
    let sprite = this.sprites.get(key);
    if (sprite) return sprite;

    const size = this.resolution;
    const [r, g, b] = this._rgb(h, s);
    sprite = createGraphics(size, size);
    sprite.pixelDensity(1);
    sprite.loadPixels();
    const radius = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - radius, y - radius) / radius;
        const i = 4 * (y * size + x);
        sprite.pixels[i] = r;
        sprite.pixels[i + 1] = g;
        sprite.pixels[i + 2] = b;
        sprite.pixels[i + 3] = d >= 1 ? 0 : Math.pow(1 - d, this.falloff) * 255;
      }
    }
    sprite.updatePixels();
    this.sprites.set(key, sprite);
    return sprite;
  },

  // Colour is given in whatever colorMode is active, which is HSB here.
  draw(x, y, diameter, hue, saturation, alpha) {
    if (!this.ready || alpha <= 0) return;
    push();
    imageMode(CENTER);
    tint(0, 0, 100, alpha);    // white: the cheap path through p5's tinting
    image(this._sprite(hue, saturation), x, y, diameter, diameter);
    pop();
  }
};

function renderWorld(world, time) {
  background(PALETTE.background);
  if (!world) return;

  push();
  Camera.apply();
  colorMode(HSB, 360, 100, 100, 1);

  // The ground the world sits in (see texture.js), under everything living.
  Texture.ground(time);

  // Hyphae first, so they appear to come out from under the spore bodies.
  for (const spore of world.spores) {
    if (spore.hyphae.length) drawHyphae(spore);
  }

  noStroke();
  drawNutrient(world.nutrient, time);
  drawJunctions(world);
  for (const spore of world.spores) {
    if (!spore.isFirst) drawSpore(spore, time);
  }
  drawSpore(world.first, time); // always on top
  drawPulses(world);

  pop();

  // Vignette and film grain, in screen pixels, over the finished picture.
  Texture.overlay(time);
}

function drawHyphae(spore) {
  const saturation = spore.isFirst ? 85 : 55;
  const glow = spore.glow;
  // How far this spore has been pulled off home; its hyphae bend with it.
  const ox = spore.x - spore.homeX;
  const oy = spore.y - spore.homeY;
  strokeCap(ROUND);
  strokeJoin(ROUND);
  noFill();

  for (const hypha of spore.hyphae) {
    // Forks get thinner, and no two spores are drawn at quite the same weight.
    // The First Spore keeps weight 1: it is the reference the others vary from.
    const vary = spore.isFirst ? 1 : spore.variation.weight;
    const weight = Math.max(0.6, 1 - hypha.tier * 0.5) * vary;

    // Glow: a wide, faint stroke under a thin, bright one.
    stroke(spore.hue, saturation, 100, 0.12 * glow);
    strokeWeight(weight * 2);
    traceHypha(hypha, ox, oy);

    stroke(spore.hue, saturation * 0.8, 100, 0.8 * glow);
    strokeWeight(weight);
    traceHypha(hypha, ox, oy);

    // A bright bead on each tip that is still growing.
    if (hypha.growing) {
      const tip = hypha.tip();
      const w = flexWeight(hypha.lastPoint().d);
      noStroke();
      fill(spore.hue, saturation * 0.4, 100, 0.9 * glow);
      circle(tip.x + ox * w, tip.y + oy * w, weight * 2.2);
      noFill();
    }
  }
}

function traceHypha(hypha, ox, oy) {
  const flexing = Math.abs(ox) + Math.abs(oy) > 0.05;
  beginShape();
  for (const p of hypha.points) {
    if (flexing) {
      const w = flexWeight(p.d);
      vertex(p.x + ox * w, p.y + oy * w);
    } else {
      vertex(p.x, p.y);
    }
  }
  const tip = hypha.tip();
  const w = flexing ? flexWeight(hypha.lastPoint().d) : 0;
  vertex(tip.x + ox * w, tip.y + oy * w);
  endShape();
}

function drawSpore(spore, time) {
  const v = spore.variation;
  const glow = spore.glow;
  const wobble = spore.isFirst ? firstWobble(spore, time) : null;
  const breathe = wobble ? wobble.breathe : 1 + 0.08 * Math.sin(time * 1.6 + spore.offset);
  const x = spore.x + (wobble ? wobble.x : 0);
  const y = spore.y + (wobble ? wobble.y : 0);

  // Dormant: a faint halo with no colour in it at all, so a dormant spore reads
  // as something living rather than a grey placeholder, and germination is
  // still the moment colour arrives. Fades out as the spore comes alive.
  if (glow < 1) {
    const dim = 1 - glow;
    const body = 9 * v.size * breathe;
    Glow.draw(x, y, body * 6, 0, 0, 0.09 * dim);
    fill(0, 0, 100, 0.45 * dim);
    circle(x, y, body);
    if (glow <= 0) return;
  }

  const saturation = spore.isFirst ? 85 : 55;
  const base = spore.isFirst ? 22 : 14 * v.size;
  const size = base * breathe * (0.6 + 0.4 * glow) * (1 + 0.35 * spore.flash);

  // The glow carries the hierarchy: the First Spore is no bigger than the
  // largest of the others by much, but it is the most saturated and the widest lit.
  const lit = wobble ? wobble.brightness : 1;
  Glow.draw(x, y, size * (spore.isFirst ? 7 : 5.5), spore.hue, saturation,
            0.2 * glow * lit * (1 + 1.6 * spore.flash));

  if (wobble && WOBBLE.squish > 0) {
    drawWobblyBody(spore, x, y, size, saturation, glow, time, wobble);
    return;
  }

  fill(spore.hue, saturation, 100, 0.9 * glow);
  circle(x, y, size);
  fill(spore.hue, saturation * 0.3, 100, 0.9 * glow);
  circle(x, y, size * 0.45);
}

// The First Spore only. Every other spore stays a circle, which is cheap and
// leaves this the one thing in the world that moves like this.
function drawWobblyBody(spore, x, y, size, saturation, glow, time, wobble) {
  push();
  // A very slow rock, on top of everything else. Its period is about two
  // minutes, so it never reads as spinning, only as never quite settling.
  translate(x, y);
  rotate(Math.sin(time * 0.05 * WOBBLE.speed) * WOBBLE.rock);
  translate(-x, -y);

  // The aura, in the body's own shape so it hugs the wobble.
  const body = WOBBLE_LAYERS[WOBBLE_LAYERS.length - 1];
  fill(spore.hue, saturation, 100, WOBBLE_AURA.alpha * glow);
  for (let ring = WOBBLE_AURA.rings; ring >= 1; ring--) {
    const spread = 1 + (WOBBLE_AURA.to - 1) * (ring / WOBBLE_AURA.rings);
    blob(x, y, (size / 2) * spread, body.freq, time * body.rate * WOBBLE.speed,
         WOBBLE.squish * WOBBLE_AURA.amp);
  }

  for (const layer of WOBBLE_LAYERS) {
    fill(spore.hue, saturation * layer.saturation, 100, layer.alpha * glow);
    blob(x, y, (size / 2) * layer.radius,
         layer.freq, time * layer.rate * WOBBLE.speed + layer.offset,
         WOBBLE.squish * layer.amp);
  }

  // A soft sheen off the middle, leaning the way the body leans. Reusing the
  // glow sprite gives it a gradient falloff; a flat circle here read as a disc,
  // and without it the body is a flat area of one colour.
  Glow.draw(x + wobble.x * 0.6 - size * 0.13, y + wobble.y * 0.6 - size * 0.15,
            size * 0.95, spore.hue, saturation * 0.15, 0.62 * glow);
  pop();
}

// Two octaves of noise sampled around a circle, as the orb prototype does it.
// Sampling a full circle is what keeps the result periodic in `angle`: reading
// noise straight off the angle would jump between 2*PI and 0 and leave a crease
// down one side of the body. The second octave is the fine detail on top of the
// broad squash, and is what stops it reading as a plain ellipse.
const NOISE_ORIGIN = 50; // keeps every sample positive: p5 mirrors noise across 0, which would crease the outline too

// Returns -1..1, centred on 0, exactly as the prototype's does. Its own value
// noise is built on a hash that returns -1..1, where p5's noise() returns
// 0..1 — so each sample has to be remapped, or the outline wobbles at half
// the amplitude the prototype's numbers describe.
function loopNoise(angle, freq, phase) {
  const cx = Math.cos(angle);
  const cy = Math.sin(angle);
  const broad = noise(cx * freq + phase + NOISE_ORIGIN,
                      cy * freq + phase + NOISE_ORIGIN) * 2 - 1;
  const fine = (noise(cx * freq * 2.3 + phase * 1.7 + NOISE_ORIGIN + 40,
                      cy * freq * 2.3 + phase * 1.7 + NOISE_ORIGIN + 40) * 2 - 1) * 0.5;
  return (broad + fine) / 1.5;
}

// One closed outline, traced as quadratic curves through the midpoints between
// points. That is the prototype's tracePath: it stays inside the points it is
// given, where curveVertex overshoots them and bulges the corners.
function blob(x, y, radius, freq, phase, amp) {
  const steps = WOBBLE.steps;
  const points = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const r = radius * (1 + amp * loopNoise(angle, freq, phase));
    points.push({ x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r });
  }

  const last = points[steps - 1];
  beginShape();
  vertex((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
  for (let i = 0; i < steps; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % steps];
    quadraticVertex(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  }
  endShape(CLOSE);
}

// The First Spore breathes on noise rather than on a sine, so it never falls
// into an obvious repeat: its body swells, its glow brightens and it drifts a
// hair off centre, all on separate, slow noise streams.
//
// All of this is applied when drawing and nowhere else. `spore.x`/`y` are
// simulated — springToward carries velocity through them, and Giving's flex
// drags the whole mycelium through them — so nudging them here would travel
// out through every junction and shake the network.
const WOBBLE = {
  drift: 3.5,       // world units it wanders off centre. Keep this well under the
                    // body's radius (11 at rest): past that the body slides out
                    // from over the hyphae, which are drawn from its home position.
  swell: 0.16,      // how much the body size varies, either side of 1
  brightness: 0.3,  // how much the glow brightens and dims
  speed: 0.3,         // pace of every stream at once
  squish: 0.28,     // how far the outline travels off a circle. 0 = a plain circle again
  rock: 0.15,       // radians the whole body rocks back and forth
  steps: 72         // points around the outline (the prototype uses 160, at six times the size)
};

// The body: a trailing layer that shows only where it bulges past the body,
// then the body itself. Each runs at its own frequency and its own phase,
// which is what makes them slide against each other rather than wobble as one
// rigid shape.
//
// The frequencies are lower than the orb prototype's (1.7 and 2.1). The orb
// draws at about 340px behind a 40px-blurred halo, which hides how many lobes
// it has; the First Spore is 66px with a crisp edge, where the same numbers
// read as knobbly rather than soft. For the prototype's literal shape, set
// freq back to 1.7 and 2.1.
const WOBBLE_LAYERS = [
  { radius: 0.94, freq: 1.2, rate: 0.8, offset: 12, amp: 0.85, alpha: 0.3,  saturation: 0.7 },
  { radius: 1,    freq: 0.9, rate: 1,   offset: 0,  amp: 1,    alpha: 0.92, saturation: 1 }
];

// The prototype's outer glow is one outline blurred by 40px. A real blur is far
// too expensive per frame, so the same softness is stacked out of rings of the
// body's own shape, each barely visible. Drawn hard, that layer reads as a dark
// rim around the body rather than a glow.
const WOBBLE_AURA = { rings: 7, to: 1.38, alpha: 0.05, amp: 0.8 };

function firstWobble(spore, time) {
  // Four separate streams, so nothing moves in step with anything else: if the
  // drift and the brightness share one, the spore visibly brightens every time
  // it leans the same way.
  const swell = noise(spore.offset, time * 0.35 * WOBBLE.speed);
  const lit = noise(spore.offset + 40, time * 0.5 * WOBBLE.speed);
  const swayX = noise(spore.offset + 80, time * 0.6 * WOBBLE.speed);
  const swayY = noise(spore.offset + 120, time * 0.55 * WOBBLE.speed);
  return {
    breathe: 1 + WOBBLE.swell * (swell - 0.5) * 2,
    brightness: 1 - WOBBLE.brightness / 2 + WOBBLE.brightness * lit,
    x: (swayX - 0.5) * 2 * WOBBLE.drift,
    y: (swayY - 0.5) * 2 * WOBBLE.drift
  };
}

// ---- the Nutrient ------------------------------------------------------------
// It must not read as alive. No breath, no wobble, none of the bioluminescent
// band the organisms are drawn from — it is a deposit of food in the soil, the
// one warm thing in a cold world, and the only thing in Receiving the First
// Spore reaches for and cannot have.
//
// Drawn as a cluster of grains rather than one disc, for two reasons. A disc is
// what every living thing here already is, so a disc would make the Nutrient
// look like another spore. And grains can go out one at a time as the nutrients
// are carried away, which makes `amount` legible without a number: the cluster
// is eaten from the outside in, and the last grain to go is the middle one.
const NUTRIENT = {
  grains: 14,
  spread: 0.52,        // how far across the radius the grains scatter
  grainSize: 0.19,     // ...and how big each one is, against that same radius
  halo: 4.2,           // the glow over the whole cluster, as a multiple of it
  jitter: 0.34,        // how far off the even spiral each grain sits
  dim: 0.45,           // how much grain-to-grain brightness varies
  twinkle: 0.12,       // per-grain brightness wobble
  twinkleRate: 2.3
};

// A tiny deterministic generator seeded from a position: the same place gives
// the same scatter, this frame and every frame, and in every re-run of the same
// world (ADR 0002). p5's random() would re-roll each frame and the cluster
// would boil.
function scatterAt(x, y) {
  let seed = (Math.floor(Math.abs(x) * 73856093) ^ Math.floor(Math.abs(y) * 19349663)) % 2147483647;
  if (seed <= 0) seed += 2147483646;
  return () => (seed = (seed * 48271) % 2147483647) / 2147483647;
}

function drawNutrient(nutrient, time) {
  if (!nutrient || nutrient.amount <= 0) return;
  push();
  noStroke();

  const amount = nutrient.amount;
  const cluster = nutrient.radius * NUTRIENT.spread;
  const grain = nutrient.radius * NUTRIENT.grainSize;

  // One warm glow over the whole cluster, from the same sprite everything else
  // glows with. It is what holds the grains together as a single deposit; the
  // three stacked flat circles this replaces left visible rings, which is the
  // thing Glow was built to stop.
  Glow.draw(nutrient.x, nutrient.y, cluster * NUTRIENT.halo,
            PALETTE.nutrientHue, 70, 0.38 * (0.35 + 0.65 * amount));

  const next = scatterAt(nutrient.x, nutrient.y);
  for (let i = 0; i < NUTRIENT.grains; i++) {
    // A sunflower spiral: evenly spread without looking laid out, and ordered
    // outward, so extinguishing them in order eats the cluster from its edge.
    const t = (i + 0.5) / NUTRIENT.grains;
    const radius = cluster * Math.sqrt(t);
    const angle = i * 2.39996 + (next() - 0.5) * NUTRIENT.jitter;
    const wide = 1 + (next() - 0.5) * NUTRIENT.jitter;
    const depth = 1 - NUTRIENT.dim * next();   // some grains sit further down
    const scale = 0.7 + 0.6 * next();
    const lit = constrain((amount - t) * NUTRIENT.grains, 0, 1);
    if (lit <= 0) continue;

    const gx = nutrient.x + Math.cos(angle) * radius * wide;
    const gy = nutrient.y + Math.sin(angle) * radius * wide;
    // Each grain catches the light on its own beat, so the cluster glitters
    // rather than breathing as one body — the surest way it is not a spore.
    // And no bright centre: a lit core is what the spores have, and a grain
    // with one reads as a small spore rather than a crumb of food.
    const catches = 1 + NUTRIENT.twinkle * Math.sin(time * NUTRIENT.twinkleRate + i * 1.7);
    const size = grain * scale * catches;

    Glow.draw(gx, gy, size * 4, PALETTE.nutrientHue, 80, 0.13 * lit * depth);
    fill(PALETTE.nutrientHue, 62, 100, 0.9 * lit * depth);
    circle(gx, gy, size);
  }
  pop();
}

// ---- junctions ---------------------------------------------------------------
// Where two spores' hyphae have fused. A junction is the most loaded object in
// the piece — it is the only thing that can be pulled, and a pull always reaches
// across more than one organism — so it should not look like a dot, which is
// also what a fork looks like. A fusion is two organisms sharing one wall, so a
// junction is drawn as a ring: a seam, with the fused point inside it.
const JUNCTION = {
  core: 4.4,
  seam: 2.5,           // the resting ring, as a multiple of the core
  seamWeight: 1.0,
  ripple: 1.8,         // how far the ring opens when a pulse crosses
  halo: 6
};

function drawJunctions(world) {
  push();
  strokeCap(ROUND);
  for (const junction of world.junctions) {
    const p = junctionPosition(junction);
    const flash = junction.flash;
    const core = JUNCTION.core * (1 + 0.45 * flash);

    noStroke();
    Glow.draw(p.x, p.y, core * JUNCTION.halo * (1 + 0.45 * flash),
              junction.hue, 40, 0.15 + 0.34 * flash);

    // The seam at rest.
    noFill();
    stroke(junction.hue, 38, 100, 0.42 + 0.30 * flash);
    strokeWeight(JUNCTION.seamWeight);
    circle(p.x, p.y, core * JUNCTION.seam);

    // ...and the seam reacting. `flash` is set to 1 the moment a pulse crosses
    // and decays away, so reading it backwards opens a ring outward and fades
    // it: the joint itself answering, rather than a light switching on.
    if (flash > 0) {
      const opened = 1 - flash;
      stroke(junction.hue, 25, 100, 0.55 * flash);
      strokeWeight(JUNCTION.seamWeight * (0.4 + 0.6 * flash));
      circle(p.x, p.y, core * JUNCTION.seam * (1 + JUNCTION.ripple * opened));
    }

    // The fused point.
    noStroke();
    fill(junction.hue, 22, 100, 0.95);
    circle(p.x, p.y, core);
  }
  pop();
}

// ---- pulses ------------------------------------------------------------------
// A travelling surge of light. The tail is stroked along the path the pulse is
// actually on, so it bends with the hypha; the five stacked circles this
// replaces stepped straight across every curve and read as a caterpillar.
const PULSE = {
  tail: 58,            // world units of tail behind the head
  // The hypha under the tail only has a point every GROWTH.segmentLength (6)
  // world units, so ~10 samples over 58 units is all the shape there is to
  // find. Sampling finer than the path's own resolution just interpolates
  // between the same two points at a cost.
  samples: 10,
  head: 5.5,
  halo: 5,
  // Layered the way a hypha is — a long faint trace under a short bright one —
  // rather than tapered segment by segment. Each pass is ONE continuous shape:
  // separate line() calls overlap at their round caps and double-blend, which
  // beads the tail instead of smoothing it.
  // The hypha under it is already drawn at saturation 44 and alpha 0.8, so a
  // tail in the same colour simply disappears into it. What separates the two
  // is heat, not brightness: the surge runs whiter the closer it is to the head.
  // Reaches are staggered and the alpha steps kept small: where two passes end
  // at the same place, or one jumps far in brightness, its round cap shows as a
  // notch part-way down the tail.
  passes: [
    { reach: 1.00, weight: 5.0, saturation: 50, alpha: 0.18 },   // the envelope
    { reach: 1.00, weight: 1.8, saturation: 28, alpha: 0.45 },
    { reach: 0.66, weight: 2.3, saturation: 20, alpha: 0.55 },
    { reach: 0.38, weight: 2.9, saturation: 12, alpha: 0.72 },
    { reach: 0.15, weight: 3.8, saturation: 4,  alpha: 0.95 }
  ]
};

function drawPulses(world) {
  push();
  strokeCap(ROUND);
  strokeJoin(ROUND);
  noFill();

  for (const pulse of world.pulses) {
    if (pulse.delay > 0 || pulse.at <= 0) continue;

    // Walk the tail once, head first, and let every pass read the same samples.
    // Each pass walking it for itself cost five times as much for one picture.
    const trace = [];
    for (let i = 0; i <= PULSE.samples; i++) {
      const at = pulse.at - (i / PULSE.samples) * PULSE.tail;
      if (at < 0) break;
      trace.push(flexed(pointAlong(pulse, at)));
    }

    if (trace.length > 1) {
      for (const pass of PULSE.passes) {
        // trace[0] is the head, so the pass covers its first `reach` of the tail.
        const span = Math.min(trace.length, Math.round(pass.reach * PULSE.samples) + 1);
        if (span < 2) continue;
        stroke(pulse.hue, pass.saturation, 100, pass.alpha);
        strokeWeight(pass.weight);
        beginShape();
        for (let i = span - 1; i >= 0; i--) vertex(trace[i].x, trace[i].y);
        endShape();
      }
    }

    // The head: hotter and whiter than anything the hypha itself is drawn in,
    // so it reads as light travelling along the thread rather than a bright
    // stretch of the thread.
    const head = trace.length ? trace[0] : flexed(pointAlong(pulse, pulse.at));
    noStroke();
    Glow.draw(head.x, head.y, PULSE.head * PULSE.halo, pulse.hue, 45, 0.55);
    fill(pulse.hue, 10, 100, 0.95);
    circle(head.x, head.y, PULSE.head);
    noFill();
  }
  pop();
}
