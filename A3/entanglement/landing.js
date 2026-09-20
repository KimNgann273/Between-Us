// The Instrument: the apparatus drawn over Home.
//
// Home shows the real world — the spore in the crosshair is world.first — with
// a ruled grid, a crosshair and live telemetry laid over it. The grid, the type
// and the telemetry are DOM (index.html, styles.css). This file draws the marks
// that sit ON the specimen, in screen space on the canvas: the crosshair and the
// frame around the Begin button.
//
// Those marks are stippled on purpose. The title is set in a face whose letters
// are built from scattered dots, and a ruled mechanical frame next to it reads
// as two unrelated designs; drawing the Instrument's own marks out of the same
// particles is what joins them. The grid stays exact — it is the apparatus. Only
// what the apparatus lays on the specimen is made of the specimen's material.
//
// See docs/adr/0003-home-is-an-instrument-that-is-dismissed.md

const HOME_ZOOM_SCALE = 0.8;   // Home sits a little further out than Drifting, so Begin has somewhere to push in from
const HOME_SPORE_Y = 0.33;     // where down the screen the First Spore sits on Home; the title takes the rest
const LEAVE_MS = 1400;         // the dissolve at Begin: telemetry out, grid and type down, camera in

const CROSS_GAP = 34;          // clear space either side of the spore, in px
const CROSS_ARM = 40;          // how long each arm of the crosshair runs
const CROSS_BREATH = 3.5;      // how far the gap opens and closes as the specimen breathes
const BRACKET = 104;           // half-width of the loose box around the crosshair
const BRACKET_ARM = 26;
const DOT_STEP = 4.6;          // spacing of the stipple along a mark
const DOT_JITTER = 1.7;        // how far a dot strays off the line it belongs to

// Its own generator, so the stipple never touches p5's random stream — the
// world's layout is seeded from that and has to stay identical (ADR 0002).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Landing = {
  hover: false,
  jitter: [],      // fixed stipple offsets, so the marks don't crawl between frames
  lastTel: 0,

  init() {
    const rand = mulberry32(0x5EED);
    for (let i = 0; i < 512; i++) {
      this.jitter.push({
        off: (rand() - 0.5) * 2 * DOT_JITTER,
        along: (rand() - 0.5) * 2.2,
        size: 0.55 + rand() * 0.85,
        alpha: 0.45 + rand() * 0.55
      });
    }
    const button = document.getElementById('beginBtn');
    button.addEventListener('pointerenter', () => { this.hover = true; });
    button.addEventListener('pointerleave', () => { this.hover = false; });
  },

  // Where Home holds the camera: the First Spore a third of the way down, and
  // far enough out that Begin has a push left in it.
  framing() {
    const zoom = Camera.closeZoom() * HOME_ZOOM_SCALE;
    return {
      x: world.first.homeX,
      y: world.first.homeY - (HOME_SPORE_Y - 0.5) * height / zoom,
      zoom
    };
  },

  // ---- the marks ---------------------------------------------------------

  draw(time) {
    const spore = world.first;
    const sx = (spore.x - Camera.x) * Camera.zoom + width / 2;
    const sy = (spore.y - Camera.y) * Camera.zoom + height / 2;
    const breath = Math.sin(time * 0.55) * CROSS_BREATH;

    push();
    // renderWorld() leaves the mode it found, but the Instrument's colours are
    // plain RGB and should not depend on that being true.
    colorMode(RGB, 255);
    noStroke();
    let index = 0;
    const dot = (x, y, nx, ny, alpha) => {
      const j = this.jitter[index++ % this.jitter.length];
      fill(200, 226, 212, alpha * j.alpha * 255);
      circle(x + nx * j.off + ny * j.along, y + ny * j.off - nx * j.along, j.size * 2);
    };
    // A run of stipple from one point to another, the dots strewn either side.
    const run = (x0, y0, x1, y1, alpha) => {
      const dx = x1 - x0, dy = y1 - y0;
      const length = Math.hypot(dx, dy);
      const ux = dx / length, uy = dy / length;
      const steps = Math.max(2, Math.round(length / DOT_STEP));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        dot(x0 + dx * t, y0 + dy * t, -uy, ux, alpha);
      }
    };

    // Crosshair: four arms, holding off the spore by a gap that breathes with it.
    const gap = CROSS_GAP + breath;
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2;
      const cx = Math.cos(ang), cy = Math.sin(ang);
      run(sx + cx * gap, sy + cy * gap, sx + cx * (gap + CROSS_ARM), sy + cy * (gap + CROSS_ARM), 0.5);
    }

    // A loose bracketed box around it — corners only, the way a sight frames a
    // thing without enclosing it.
    for (const [ox, oy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const bx = sx + ox * BRACKET, by = sy + oy * BRACKET;
      run(bx, by, bx - ox * BRACKET_ARM, by, 0.34);
      run(bx, by, bx, by - oy * BRACKET_ARM, 0.34);
    }

    // The frame around Begin, stippled to match. Read from the DOM so it always
    // fits the button, whatever the type does at this screen size.
    const rect = document.getElementById('beginBtn').getBoundingClientRect();
    if (rect.width) {
      const p = 4;
      const x0 = rect.left - p, y0 = rect.top - p;
      const x1 = rect.right + p, y1 = rect.bottom + p;
      const alpha = this.hover ? 0.85 : 0.5;
      run(x0, y0, x1, y0, alpha);
      run(x1, y0, x1, y1, alpha);
      run(x1, y1, x0, y1, alpha);
      run(x0, y1, x0, y0, alpha);
    }
    pop();

    if (time - this.lastTel > 0.1) {
      this.lastTel = time;
      this.telemetry(time);
    }
  },

  // ---- telemetry ---------------------------------------------------------
  // Real values off the real world. The Instrument is only worth having if it
  // is actually measuring the thing behind it.

  telemetry(time) {
    const pad = (n, width, places) => {
      const s = Math.abs(n).toFixed(places);
      return (n < 0 ? '-' : '+') + s.padStart(width, '0');
    };
    const germinated = world.spores.filter((s) => s.germinated).length;

    document.getElementById('telCam').textContent =
      `CAM ${pad(Camera.x, 7, 1)} , ${pad(Camera.y, 7, 1)}   Z ${Camera.zoom.toFixed(3)}`;
    document.getElementById('telWorld').textContent =
      `SPORES ${String(world.spores.length).padStart(2, '0')}   ` +
      `GERMINATED ${String(germinated).padStart(2, '0')}   ` +
      `JUNCTIONS ${String(world.junctions.length).padStart(2, '0')}`;
    // Dormant means ungerminated — see CONTEXT.md. The First Spore has its
    // colour from the start and is dormant all the same.
    document.getElementById('telState').textContent =
      `STATE ${world.first.germinated ? 'GERMINATED' : 'DORMANT'}   T ${time.toFixed(1).padStart(5, '0')}`;
  }
};
