// Phase 2 of the journey: Receiving.
// The First Spore grows toward a Nutrient it cannot reach, weakens just short
// of it, and is saved by another network that got there first. Their hyphae
// fuse, the nutrients flow across, and the First Spore grows again.
//
// This file also holds the world every phase shares (spores, hyphae, growth)
// and the three things Receiving introduces that Giving goes on to reuse:
// fusion, junctions and pulses. Loop and input: sketch.js. Drawing: render.js.

// ---- tunables ----------------------------------------------------------------

const RECEIVING = {
  nutrientAngle: 2.6,       // direction from the First Spore to the Nutrient, in radians (2.6 = down and to the left)
  nutrientDistance: 360,    // world units from the First Spore to the Nutrient
  shortfall: 110,           // however it grows, the First Spore's hyphae stop at least this far short of the Nutrient
  reserves: 9000,           // hypha length the First Spore can grow on its own before it weakens and stops
  neighbourDistance: 760,   // the spore that helps sits beyond the Nutrient, off screen at first
  cursorPull: 3,          // how hard hyphae already heading toward the cursor turn to follow it
  nutrientSense: 0.5,       // a faint pull toward the Nutrient, even when the cursor is elsewhere
  senseDistance: 190,       // a tip this close to the Nutrient makes the Narrator notice it
  giveUpAfter: 45,          // safety net: seconds of reaching before its reserves give out regardless
  rescueDelay: 2.5,         // seconds between stalling and the other network appearing
  rescueHyphae: 6,          // hyphae the other network sends toward the Nutrient
  rescueSpeed: 3,           //   ...growing this many times faster than yours
  touchNutrient: 18,        // a tip this close has reached the Nutrient
  meetAfter: 25,            // seconds before the fusion is forced, as a safety net
  flowPulses: 4,            // pulses of nutrient carried across the first fusion
  flowGap: 0.55,            // seconds between them
  reviveBudget: 9000,       // hypha length the First Spore gains when the nutrients arrive
  revivedReach: 300         // how far its hyphae can grow once revived
};

// ---- the phase -----------------------------------------------------------------
// The story runs through these stages, in order:
//   waiting    until the viewer clicks the First Spore
//   reaching   hyphae grow, the ones facing the cursor follow it, then weaken
//   stalled    every hypha has stopped; "But it's too far..."
//   rescuing   another network grows in from off screen toward the Nutrient
//   extending  it has the Nutrient and reaches for your nearest tip
//   flowing    the two have fused; pulses carry the Nutrient across to you
//   revived    your hyphae start growing again; Receiving is done

const Receiving = {
  pannable: true,
  enter(firstVisit) {
    receivingState();
    const first = world.first;
    const nutrient = world.nutrient;
    // Frame the First Spore and the Nutrient together, so the goal is in view.
    Camera.easeTo((first.homeX + nutrient.x) / 2, (first.homeY + nutrient.y) / 2, Camera.closeZoom());
    if (firstVisit) Caption.say(SCRIPT.receiving.enter);
  },

  update(dt) {
    settleFirstSpore(dt);
    const s = receivingState();
    s.stageTime += dt;
    const first = world.first;
    const neighbour = world.neighbour;
    const nutrient = world.nutrient;

    switch (s.stage) {
      case 'reaching':
        leadHyphae(first);
        if (!s.sensed && nearestTipDistance(first, nutrient) < RECEIVING.senseDistance) sense(s);
        if (s.stageTime > RECEIVING.giveUpAfter) first.budget = Math.min(first.budget, 0);
        if (first.hyphae.every((h) => !h.growing)) {
          if (!s.sensed) sense(s);
          Caption.say(SCRIPT.receiving.stalled);
          setStage(s, 'stalled');
        }
        break;

      case 'stalled':
        if (s.stageTime > RECEIVING.rescueDelay) {
          neighbour.reachLimit = Infinity;
          neighbour.budget = Infinity;
          neighbour.germinate({
            count: RECEIVING.rescueHyphae,
            aim: Math.atan2(nutrient.y - neighbour.homeY, nutrient.x - neighbour.homeX),
            speedScale: RECEIVING.rescueSpeed
          });
          setStage(s, 'rescuing');
        }
        break;

      case 'rescuing': {
        const carrier = neighbour.hyphae.find((h) =>
          h.growing && Math.hypot(h.tip().x - nutrient.x, h.tip().y - nutrient.y) < RECEIVING.touchNutrient);
        if (carrier) {
          // The one that got there carries on toward you; the rest have done their job.
          for (const h of neighbour.hyphae) if (h !== carrier && h.growing) stopHypha(h, 'rest');
          s.carrier = carrier;
          s.meet = meetingPoint(first, nutrient);
          carrier.lure = s.meet.point;
          carrier.lureStrength = 3;
          Caption.say(SCRIPT.receiving.gotThereFirst);
          setStage(s, 'extending');
        } else {
          for (const h of neighbour.hyphae) {
            if (!h.growing) continue;
            h.lure = nutrient;
            h.lureStrength = 1.8;
          }
        }
        break;
      }

      case 'extending': {
        let junction = junctionBetween(world, first, neighbour);
        if (!junction && s.stageTime > RECEIVING.meetAfter) {
          // Safety net: if the two never quite touch, join them where they came closest.
          const tip = s.carrier.lastPoint();
          stopHypha(s.carrier, 'fused');
          junction = addJunction(world, neighbour, first, s.carrier, s.carrier.points.length - 1,
            s.meet.hypha, s.meet.index, (tip.x + s.meet.point.x) / 2, (tip.y + s.meet.point.y) / 2);
        }
        if (junction) {
          neighbour.budget = 1500; // it keeps a little life of its own, then rests
          s.path = lifelinePath(junction);
          s.flowLeft = RECEIVING.flowPulses;
          s.flowTimer = 0.8;
          setStage(s, 'flowing');
        }
        break;
      }

      case 'flowing':
        s.flowTimer -= dt;
        if (s.flowLeft > 0 && s.flowTimer <= 0) {
          s.flowLeft--;
          s.flowTimer = RECEIVING.flowGap;
          nutrient.amount = s.flowLeft / RECEIVING.flowPulses;
          const last = s.flowLeft === 0;
          sendPulse(world, s.path, {
            hue: PALETTE.nutrientHue,
            onArrive: last ? () => revive(s) : null
          });
        }
        break;
    }
  },

  wheel(deltaY, at) {
    Camera.zoomBy(deltaY, at);
  },

  pointerDown(point) {
    if (hitsSpore(point, world.first)) this.germinateFirst();
  },

  germinateFirst() {
    const s = receivingState();
    if (s.stage !== 'waiting') return;
    world.first.budget = RECEIVING.reserves;
    world.first.germinate();
    Caption.clear();
    Caption.say(SCRIPT.receiving.germinated);
    setStage(s, 'reaching');
  }
};

// Receiving's progress belongs to the world, so a fresh world starts it over.
function receivingState() {
  if (!world.receiving) {
    world.receiving = {
      stage: 'waiting', stageTime: 0, sensed: false,
      carrier: null, meet: null, path: null, flowLeft: 0, flowTimer: 0
    };
  }
  return world.receiving;
}

function setStage(s, stage) {
  s.stage = stage;
  s.stageTime = 0;
}

function sense(s) {
  s.sensed = true;
  Caption.say(SCRIPT.receiving.sensed);
}

function revive(s) {
  const first = world.first;
  first.budget += RECEIVING.reviveBudget;
  first.fullBudget = first.budget;
  first.reachLimit = RECEIVING.revivedReach;
  for (const h of first.hyphae) {
    // Let go of where the cursor or the Nutrient last pulled them. leadHyphae()
    // no longer runs, so a leftover lure would never move and a hypha would
    // circle that point for ever.
    h.lure = null;
    h.lureStrength = 0;
    if (h.stop !== 'limit' && h.stop !== 'budget') continue;
    h.maxReach = RECEIVING.revivedReach;
    h.growing = true;
    h.stop = null;
  }
  Caption.say(SCRIPT.receiving.revived);
  setStage(s, 'revived');
  complete(Receiving);
}

// Each growing hypha turns toward the cursor or the Nutrient, whichever pulls
// harder. Only hyphae already heading roughly that way feel it, so a few follow
// the cursor while the rest keep growing steadily outward.
function leadHyphae(spore) {
  const cursor = pointer.moved && !fastForwarding ? Camera.screenToWorld(pointer.sx, pointer.sy) : null;
  for (const hypha of spore.hyphae) {
    if (!hypha.growing) continue;
    const toNutrient = facingPull(hypha, world.nutrient, RECEIVING.nutrientSense);
    const toCursor = cursor ? facingPull(hypha, cursor, RECEIVING.cursorPull) : 0;
    hypha.lure = toCursor > toNutrient ? cursor : world.nutrient;
    hypha.lureStrength = Math.max(toCursor, toNutrient);
  }
}

function facingPull(hypha, target, strength) {
  const tip = hypha.lastPoint();
  const toward = Math.atan2(target.y - tip.y, target.x - tip.x);
  const facing = Math.cos(angleBetween(hypha.heading, toward)); // 1 when already heading straight there
  return Math.max(0, facing) ** 2 * strength;
}

function nearestTipDistance(spore, point) {
  let nearest = Infinity;
  for (const h of spore.hyphae) {
    const tip = h.tip();
    nearest = Math.min(nearest, Math.hypot(tip.x - point.x, tip.y - point.y));
  }
  return nearest;
}

// The end of whichever hypha got closest to the Nutrient: where help arrives.
function meetingPoint(spore, point) {
  let best = null;
  for (const hypha of spore.hyphae) {
    const index = hypha.points.length - 1;
    const p = hypha.points[index];
    const gap = Math.hypot(p.x - point.x, p.y - point.y);
    if (!best || gap < best.gap) best = { hypha, index, point: p, gap };
  }
  return best;
}

// The route the nutrients take: from the Nutrient, along the helping network's
// hypha to the junction, then back along yours to the First Spore.
function lifelinePath(junction) {
  const first = world.first;
  const nutrient = world.nutrient;
  const firstIsA = junction.a === first;
  const helper = firstIsA ? junction.b : junction.a;
  const helperSide = firstIsA
    ? sideChain(junction.hyphaB, junction.indexB, junction.b)
    : sideChain(junction.hyphaA, junction.indexA, junction.a);
  const firstSide = firstIsA
    ? sideChain(junction.hyphaA, junction.indexA, junction.a)
    : sideChain(junction.hyphaB, junction.indexB, junction.b);

  // helperSide runs from the junction back to the helper's home. Keep only the
  // stretch between the point nearest the Nutrient and the junction.
  let nearest = 0;
  helperSide.forEach((p, i) => {
    const gap = Math.hypot(p.x - nutrient.x, p.y - nutrient.y);
    const best = Math.hypot(helperSide[nearest].x - nutrient.x, helperSide[nearest].y - nutrient.y);
    if (gap < best) nearest = i;
  });
  const toJunction = helperSide.slice(0, nearest + 1).reverse();
  const start = { x: nutrient.x, y: nutrient.y, d: toJunction[0].d, spore: helper };
  return { points: [start, ...toJunction, ...firstSide], junction, junctionAt: toJunction.length };
}

// ---- the world ---------------------------------------------------------------

const WORLD = {
  w: 2400,                 // world units; roughly 3x a laptop screen
  h: 1500,
  seed: 11,                // fixed so the layout is the same every visit
  sporeCount: 40,
  minGap: 200,             // closest two spores may sit
  hueMin: 140,             // bioluminescent band in HSB degrees:
  hueMax: 215,             // green → teal → blue
  firstHue: 165
};

const GROWTH = {
  speed: 20,               // world units per second at each tip; kept slow on purpose
  segmentLength: 6,        // spacing of the points along a hypha
  budget: 9000,            // total hypha length one spore can grow (~1 min of growth, ~450 units of reach)
  startingHyphae: 12,       // how many emerge from a spore when it germinates
  branchChance: 0.03,      // chance of a fork each time a segment is laid; more forks spend the budget faster
  branchAngle: [0.35, 0.8],// radians either side of the parent's heading
  maxTier: 9,              // forks of forks of forks...
  wander: 1.6,             // how much the heading drifts (radians per second)
  outward: 0.5,            // how strongly hyphae keep pointing away from their spore
  sideReach: 60,           // how far a fork off an unlimited hypha may wander from where it forked
  fuseDistance: 6,         // a tip this close to another spore's hypha fuses with it
  junctionSpacing: 50,     // two junctions between the same pair of spores sit at least this far apart
  cellSize: 16,            // spatial grid used to find fusions quickly
  weakenRange: 60,         // over the last this-many units of its reach, a hypha slows down
  weakenShare: 0.25,       // once a spore has this share of its budget left, all its hyphae slow down
  glowTime: 2.5,           // seconds a newly germinated spore takes to glow fully
  pulseSpeed: 150,         // world units per second
  maxPulses: 400
};

class Spore {
  constructor(x, y, hue, isFirst = false) {
    this.homeX = x;
    this.homeY = y;
    this.x = x;
    this.y = y;
    this.vx = 0;               // carried by springToward(), so motion has momentum
    this.vy = 0;
    this.hue = hue;
    this.isFirst = isFirst;
    this.dormant = !isFirst;   // the First Spore has its colour from the start
    this.germinated = false;   // true once it has started growing hyphae
    this.hyphae = [];
    this.budget = GROWTH.budget;
    this.fullBudget = GROWTH.budget; // the budget it started growing with, to tell when it's running low
    this.reachLimit = Infinity; // how far from home its hyphae may grow
    this.glow = isFirst ? 1 : 0; // 0 dormant, 1 fully alive; fades up after germination
    this.flash = 0;            // brief brightening when a pulse arrives
    this.offset = random(Math.PI * 2); // so spores don't breathe in sync
    this.variation = sporeVariation(x, y); // what makes this spore not a copy of the others
  }

  // By default hyphae emerge all the way around. With `aim` they fan out
  // toward one direction instead, `spread` radians wide.
  germinate({ count = GROWTH.startingHyphae, aim = null, spread = 0.9, speedScale = 1 } = {}) {
    if (this.germinated) return;
    this.dormant = false;
    this.germinated = true;
    this.fullBudget = this.budget;

    const start = random(Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const heading = aim === null
        ? start + (i / count) * Math.PI * 2 + random(-0.3, 0.3)
        : aim + (count > 1 ? i / (count - 1) - 0.5 : 0) * spread + random(-0.15, 0.15);
      const hypha = new Hypha(this.homeX, this.homeY, heading, 0, this);
      hypha.speed *= speedScale;
      this.hyphae.push(hypha);
    }
  }
}

// What stops every spore being the same stamp: multipliers on its body size,
// on how heavy its hyphae are drawn, and on the hyphae it grows when it joins
// the mycelium in Giving.
//
// These come from a hash of the spore's own position rather than from
// random(), so rolling them takes nothing out of the seeded stream that places
// the spores, and the layout of seed 11 is untouched. Fixed here, at world
// creation, rather than at join time: see docs/adr/0002.
function sporeVariation(x, y) {
  const roll = (salt) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
    return n - Math.floor(n);
  };
  const between = (salt, lo, hi) => lo + roll(salt) * (hi - lo);
  return {
    size: between(1, 0.8, 1.25),    // body radius
    weight: between(2, 0.8, 1.3),   // how heavy its hyphae are drawn
    count: between(3, 0.6, 1.4),    // how many hyphae it grows when it joins
    reach: between(4, 0.7, 1.4),    //   ...and how far they go
    curl: between(5, 0.7, 1.5),     //   ...and how much they wander on the way
    strands: roll(6)                // 2 or 3 strands in a Cord reaching for it
  };
}

// One thread growing from its tip. `points` are the laid-down path; the tip
// creeps forward between points so growth looks continuous, not stepped.
// Each point remembers `d`, its distance from the spore, which is how far a
// pulled spore's movement carries along it (see flexWeight in giving.js).
class Hypha {
  constructor(x, y, heading, tier, spore) {
    this.spore = spore;
    this.points = [{ x, y, d: Math.hypot(x - spore.homeX, y - spore.homeY) }];
    this.heading = heading;
    this.tier = tier;          // 0 = grew straight out of the spore
    this.growing = true;
    this.stop = null;          // why it stopped: 'limit' 'budget' 'edge' 'fused' 'joined' 'rest'
    this.progress = 0;         // distance grown past the last point
    this.age = 0;
    this.speed = GROWTH.speed * random(0.75, 1.1) * Math.pow(0.85, tier);
    this.noiseOffset = random(1000);
    this.maxReach = spore.reachLimit; // how far from its spore it may grow
    this.parent = null;        // the hypha this one forked from, and at which point
    this.parentIndex = 0;
    this.lure = null;          // a point it turns toward, and how hard (set by the phases)
    this.lureStrength = 0;
    this.lureRamp = null;      // optional { near, far }: the lure fades with distance from it
    this.wanderScale = 1;
    this.target = null;        // Giving: the spore this hypha is reaching for
  }

  lastPoint() {
    return this.points[this.points.length - 1];
  }

  // Where the tip is right now, including the part not yet laid down.
  tip() {
    const last = this.lastPoint();
    if (!this.growing) return last;
    return {
      x: last.x + Math.cos(this.heading) * this.progress,
      y: last.y + Math.sin(this.heading) * this.progress
    };
  }
}

function createWorld() {
  randomSeed(WORLD.seed);
  noiseSeed(WORLD.seed);

  const first = new Spore(0, 50, WORLD.firstHue, true);

  // Receiving's layout: the Nutrient just beyond the First Spore's reach, and
  // the spore that helps sitting further out in the same direction.
  const along = (distance) => ({
    x: first.homeX + Math.cos(RECEIVING.nutrientAngle) * distance,
    y: first.homeY + Math.sin(RECEIVING.nutrientAngle) * distance
  });
  const nutrient = { ...along(RECEIVING.nutrientDistance), radius: 16, amount: 1 };
  first.reachLimit = RECEIVING.nutrientDistance - RECEIVING.shortfall;
  const home = along(RECEIVING.neighbourDistance);
  const neighbour = new Spore(home.x, home.y, randomHue());

  const spores = [first, neighbour];
  const margin = 60;
  for (let tries = 0; tries < 5000 && spores.length < WORLD.sporeCount; tries++) {
    const x = random(-WORLD.w / 2 + margin, WORLD.w / 2 - margin);
    const y = random(-WORLD.h / 2 + margin, WORLD.h / 2 - margin);
    const clear = spores.every((s) => Math.hypot(x - s.homeX, y - s.homeY) >= WORLD.minGap)
      && Math.hypot(x - nutrient.x, y - nutrient.y) >= WORLD.minGap;
    if (clear) spores.push(new Spore(x, y, randomHue()));
  }

  return { spores, first, neighbour, nutrient, junctions: [], pulses: [], grid: new Map() };
}

function randomHue() {
  return random(WORLD.hueMin, WORLD.hueMax);
}

// ---- growth ----------------------------------------------------------------

// Call once per frame. Every germinated spore keeps growing in every phase,
// because the world is continuous.
function growWorld(world, dt) {
  for (const spore of world.spores) {
    if (spore.germinated) growSpore(world, spore, dt);
    if (!spore.dormant && spore.glow < 1) spore.glow = Math.min(1, spore.glow + dt / GROWTH.glowTime);
    spore.flash = Math.max(0, spore.flash - dt * 1.5);
  }
  for (const junction of world.junctions) junction.flash = Math.max(0, junction.flash - dt * 2);
  updatePulses(world, dt);
}

function growSpore(world, spore, dt) {
  const forks = [];
  for (const hypha of spore.hyphae) {
    if (!hypha.growing) continue;
    if (spore.budget <= 0 && !hypha.target) {
      stopHypha(hypha, 'budget');
      continue;
    }
    hypha.age += dt;
    steer(hypha, spore, dt);
    hypha.progress += hypha.speed * (0.25 + 0.75 * strength(hypha)) * dt;
    while (hypha.growing && hypha.progress >= GROWTH.segmentLength) {
      hypha.progress -= GROWTH.segmentLength;
      laySegment(world, hypha, spore, forks);
    }
  }
  spore.hyphae.push(...forks); // new forks start growing next frame
}

// How much strength a hypha has left, from 1 (full) down to 0. It fades as its
// spore's budget runs low, which slows every hypha together, and as it nears
// the edge of its reach. So growth reads as reserves running out rather than
// hitting a wall. Hyphae reaching for a spore in Giving are fed by the network.
function strength(hypha) {
  if (hypha.target) return 1;
  let left = 1;
  const low = hypha.spore.fullBudget * GROWTH.weakenShare;
  if (low > 0 && low !== Infinity) left = Math.min(left, constrain(hypha.spore.budget / low, 0, 1));
  if (hypha.maxReach !== Infinity) left = Math.min(left, constrain((hypha.maxReach - hypha.lastPoint().d) / GROWTH.weakenRange, 0, 1));
  return left;
}

function steer(hypha, spore, dt) {
  // Wander: smooth noise, different for every hypha.
  const drift = noise(hypha.noiseOffset, hypha.age * 0.5) - 0.5;
  hypha.heading += drift * 2 * GROWTH.wander * hypha.wanderScale * dt;

  const last = hypha.lastPoint();
  let lure = hypha.lure ? hypha.lureStrength : 0;
  // With a ramp, a hypha only commits to what it wants once it is close: far
  // out it barely feels the pull and wanders, so the path explores before it
  // aims. Without one the pull is constant, which grows a straight line.
  if (lure > 0 && hypha.lureRamp) {
    const gap = Math.hypot(hypha.lure.x - last.x, hypha.lure.y - last.y);
    const { near, far, power = 1 } = hypha.lureRamp;
    const closeness = constrain(1 - (gap - near) / (far - near), 0, 1);
    // A curve, not a line. A lure that falls off linearly still corrects the
    // heading the whole way and grows a ruler; raising closeness to a power
    // leaves the first half of the journey almost free.
    lure *= Math.max(0.04, Math.pow(closeness, power));
  }
  if (lure > 0) {
    const toward = Math.atan2(hypha.lure.y - last.y, hypha.lure.x - last.x);
    hypha.heading += angleBetween(hypha.heading, toward) * lure * dt;
  }

  // Keep radiating away from the spore instead of curling back into it. A
  // strong lure overrides this, so a hypha can bend toward what it wants.
  const outward = GROWTH.outward * (1 - Math.min(1, lure));
  const dx = last.x - spore.homeX;
  const dy = last.y - spore.homeY;
  if (outward > 0 && Math.hypot(dx, dy) > 10) {
    const away = Math.atan2(dy, dx);
    hypha.heading += angleBetween(hypha.heading, away) * outward * dt;
  }
}

function laySegment(world, hypha, spore, forks) {
  const last = hypha.lastPoint();
  const x = last.x + Math.cos(hypha.heading) * GROWTH.segmentLength;
  const y = last.y + Math.sin(hypha.heading) * GROWTH.segmentLength;

  if (Math.abs(x) > WORLD.w / 2 || Math.abs(y) > WORLD.h / 2) {
    stopHypha(hypha, 'edge');
    return;
  }
  const d = Math.hypot(x - spore.homeX, y - spore.homeY);
  if (d > hypha.maxReach) {
    stopHypha(hypha, 'limit');
    return;
  }

  hypha.points.push({ x, y, d });
  if (!hypha.target) spore.budget -= GROWTH.segmentLength;
  const index = hypha.points.length - 1;

  // Fusion: this tip has met a hypha from a different spore. A tip that makes
  // a new junction stops there, joined; one reaching for a particular spore
  // carries on through.
  const other = findFusion(world, hypha, x, y);
  if (other) {
    const junction = addJunction(world, spore, other.hypha.spore, hypha, index, other.hypha, other.index, x, y);
    if (junction && !hypha.target) {
      stopHypha(hypha, 'fused');
      addToGrid(world, hypha, index);
      return;
    }
  }
  addToGrid(world, hypha, index);

  // A weakening hypha doesn't branch.
  const canFork = hypha.tier < GROWTH.maxTier && hypha.points.length > 4 && strength(hypha) === 1;
  if (canFork && random() < GROWTH.branchChance) {
    const side = random() < 0.5 ? -1 : 1;
    const angle = random(GROWTH.branchAngle[0], GROWTH.branchAngle[1]);
    const fork = new Hypha(x, y, hypha.heading + side * angle, hypha.tier + 1, spore);
    fork.parent = hypha;
    fork.parentIndex = index;
    fork.maxReach = hypha.maxReach === Infinity ? d + GROWTH.sideReach : hypha.maxReach;
    forks.push(fork);
    hypha.heading -= side * 0.15; // the parent leans away from its new fork
  }
}

function stopHypha(hypha, why) {
  hypha.growing = false;
  hypha.stop = why;
}

// Signed smallest turn from angle `from` to angle `to`, in (-PI, PI].
function angleBetween(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// ---- fusion and junctions ----------------------------------------------------
// Every laid point goes into a coarse grid, so a growing tip only has to check
// the few points around it rather than every hypha in the world.

function addToGrid(world, hypha, index) {
  const p = hypha.points[index];
  const key = Math.floor(p.x / GROWTH.cellSize) + ',' + Math.floor(p.y / GROWTH.cellSize);
  let cell = world.grid.get(key);
  if (!cell) world.grid.set(key, (cell = []));
  cell.push({ hypha, index });
}

function findFusion(world, hypha, x, y) {
  const cx = Math.floor(x / GROWTH.cellSize);
  const cy = Math.floor(y / GROWTH.cellSize);
  let best = null;
  let bestGap = GROWTH.fuseDistance;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const cell = world.grid.get((cx + i) + ',' + (cy + j));
      if (!cell) continue;
      for (const entry of cell) {
        if (entry.hypha.spore === hypha.spore) continue;
        const p = entry.hypha.points[entry.index];
        const gap = Math.hypot(p.x - x, p.y - y);
        if (gap < bestGap) {
          bestGap = gap;
          best = entry;
        }
      }
    }
  }
  return best;
}

// A junction joins spores `a` and `b`. Either hypha may be null when the join
// is onto a spore itself rather than one of its hyphae (Giving does this).
// Returns null if the pair already has a junction close by.
function addJunction(world, a, b, hyphaA, indexA, hyphaB, indexB, x, y) {
  for (const j of world.junctions) {
    const samePair = (j.a === a && j.b === b) || (j.a === b && j.b === a);
    if (samePair && Math.hypot(j.x - x, j.y - y) < GROWTH.junctionSpacing) return null;
  }
  const junction = {
    x, y, a, b, hyphaA, indexA, hyphaB, indexB,
    dA: hyphaA ? hyphaA.points[indexA].d : 0,
    dB: hyphaB ? hyphaB.points[indexB].d : 0,
    hue: (a.hue + b.hue) / 2,  // junctions blend the hues they join
    flash: 1
  };
  world.junctions.push(junction);
  return junction;
}

function junctionBetween(world, a, b) {
  return world.junctions.find((j) => (j.a === a && j.b === b) || (j.a === b && j.b === a)) || null;
}

// ---- pulses ------------------------------------------------------------------
// A pulse is a bead of light travelling a path of points. Paths follow real
// hyphae: from a place on a hypha, back through its forks to the spore.

function chainToHome(hypha, index) {
  const path = [];
  let h = hypha;
  let i = index;
  while (h) {
    for (let k = i; k >= 0; k--) {
      const p = h.points[k];
      path.push({ x: p.x, y: p.y, d: p.d, spore: h.spore });
    }
    i = h.parentIndex;
    h = h.parent;
  }
  return path;
}

// From a junction back to one side's spore. A join onto the spore itself is
// just the spore's home.
function sideChain(hypha, index, spore) {
  return hypha ? chainToHome(hypha, index) : [{ x: spore.homeX, y: spore.homeY, d: 0, spore }];
}

// Spore to spore across one junction: out along `from`'s hypha, over, and
// home along the other's.
function pathThrough(junction, from) {
  const fromA = junction.a === from;
  const near = fromA
    ? sideChain(junction.hyphaA, junction.indexA, junction.a)
    : sideChain(junction.hyphaB, junction.indexB, junction.b);
  const far = fromA
    ? sideChain(junction.hyphaB, junction.indexB, junction.b)
    : sideChain(junction.hyphaA, junction.indexA, junction.a);
  return { points: near.reverse().concat(far), junction, junctionAt: near.length - 1 };
}

function sendPulse(world, path, { hue, delay = 0, onArrive = null }) {
  if (world.pulses.length >= GROWTH.maxPulses) return null;
  const cum = [0];
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1];
    const b = path.points[i];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const pulse = {
    points: path.points, cum, length: cum[cum.length - 1], at: 0, delay, hue, onArrive,
    junction: path.junction, junctionAt: path.junction ? cum[path.junctionAt] : Infinity, passed: false
  };
  world.pulses.push(pulse);
  return pulse;
}

function updatePulses(world, dt) {
  const arrived = [];
  world.pulses = world.pulses.filter((pulse) => {
    if (pulse.delay > 0) {
      pulse.delay -= dt;
      return true;
    }
    pulse.at += GROWTH.pulseSpeed * dt;
    if (!pulse.passed && pulse.at >= pulse.junctionAt) {
      pulse.passed = true;
      pulse.junction.flash = 1;
    }
    if (pulse.at < pulse.length) return true;
    arrived.push(pulse);
    return false;
  });
  // After the filter, so an arrival can safely send pulses of its own.
  for (const pulse of arrived) {
    pulse.points[pulse.points.length - 1].spore.flash = 1;
    if (pulse.onArrive) pulse.onArrive();
  }
}

// Where along its path a pulse is, `at` world units from the start.
// `cum` only ever increases, so this binary-searches it. It used to walk from
// the start on every call, which is O(points) per sample: with a few hundred
// pulses alive, each sampled several times a frame to draw its tail, that alone
// was over a million comparisons a frame.
function pointAlong(pulse, at) {
  const { points, cum } = pulse;
  if (points.length === 1) return points[0];
  // The lowest i in [1, cum.length - 1] with cum[i] >= at, or the last index.
  let lo = 1;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < at) lo = mid + 1; else hi = mid;
  }
  const i = lo;
  const a = points[i - 1];
  const b = points[i];
  const t = constrain((at - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), 0, 1);
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), d: lerp(a.d, b.d, t), spore: t < 0.5 ? a.spore : b.spore };
}