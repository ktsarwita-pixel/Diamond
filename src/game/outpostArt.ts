/* ================================================================== *
 *  OUTPOST BUILDINGS — hand-structured pixel art (no images, no text AA)
 *
 *  Rules every building follows:
 *   • Every part is mounted on something: stacks have collars on roofs,
 *     pipes run wall-to-wall with brackets, signs sit on walls, lamps have
 *     arms, hoists hang from beams, legs reach the slab.
 *   • Integer pixels only (no fractional scaling) and a bitmap pixel font.
 *   • Light comes from the upper-left: top/left faces lit, right/bottom dark.
 *   • Animated overlays stay attached to their parent (plumes start inside
 *     the stack mouth, cables run continuously to their loads).
 * ================================================================== */
import { clamp, hash, mix, shade } from './cutsceneArt';
import { makeCanvas } from './cineKit';
import { pixelLine, polygon, type Point } from './pixelCraft';
import { cacheGet, cacheSet } from './spriteCache';

export type BuildingKind = 'refinery' | 'forge' | 'repair' | 'shaft' | 'habitat';
export interface BuildingOptions {
  scale?: number;
  tier?: number;
  active?: boolean;
  door?: number;
  lite?: boolean;
  /** Stable instance key so animation state survives interaction-zone changes. */
  id?: string;
}

interface MotionState {
  lastT: number;
  attention: number;
  door: number;
  lift: number;
  heat: number;
  initialized: boolean;
}
const motion = new Map<string, MotionState>();
function motionState(id: string, t: number, active: boolean, doorTarget: number) {
  let s = motion.get(id);
  if (!s) {
    s = { lastT: t, attention: active ? 1 : 0, door: doorTarget, lift: 0.5, heat: 0.78, initialized: false };
    motion.set(id, s);
  }
  // Story seeking/replay can move time backwards: re-seat state instead of integrating negative dt.
  if (s.initialized && t < s.lastT - 0.5) {
    s.door = doorTarget;
    s.lift = 0.5;
    s.heat = active ? 1.04 : 0.78;
    s.attention = active ? 1 : 0;
  }
  const dt = s.initialized ? clamp(t - s.lastT, 0, 0.12) : 0;
  s.initialized = true;
  s.lastT = t;
  const easeTo = (value: number, target: number, rate: number) => value + (target - value) * (1 - Math.exp(-rate * dt));
  s.attention = easeTo(s.attention, active ? 1 : 0, 5);
  s.door = easeTo(s.door, doorTarget, 3.2);
  s.heat = easeTo(s.heat, active ? 1.04 : 0.78, 2.4);
  return { s, dt, easeTo };
}
/** Footprint used by the engine to cull off-screen buildings before animating them. */
export const HABITAT_OPENING = { left: 50, top: -58, width: 36, height: 58 } as const;

export const BUILDING_BOUNDS: Record<BuildingKind, { left: number; right: number; top: number }> = {
  refinery: { left: -32, right: 164, top: -176 },
  forge: { left: -24, right: 152, top: -120 },
  repair: { left: -4, right: 114, top: -90 },
  shaft: { left: -4, right: 170, top: -170 },
  habitat: { left: -10, right: 176, top: -104 },
};

type Ramp = readonly [string, string, string, string, string];
const INK = '#0b0f16';
const STEEL: Ramp = ['#1b232b', '#2c3943', '#41505b', '#5c6e78', '#8a9ba1'];
const RUST: Ramp = ['#2f1d17', '#4d2e22', '#6b412d', '#8a5638', '#ad7650'];
const CONC: Ramp = ['#2a2926', '#42403a', '#5a574e', '#747064', '#938e7d'];
const BRICK: Ramp = ['#2e1a14', '#4a2a1e', '#653826', '#7f4930', '#9c6444'];
const TEAL: Ramp = ['#17242a', '#24363d', '#344d55', '#4a6870', '#73939a'];
const SAGE: Ramp = ['#1a2621', '#283a32', '#3a5045', '#52695c', '#7c9583'];
const GLASS: Ramp = ['#0f1b23', '#18303d', '#25495a', '#3f7180', '#9cc6c2'];
const WARM: Ramp = ['#6e3f18', '#b9772e', '#eab35a', '#ffdc96', '#fff6da'];
const RED = '#a33a2a';
const CREAM = '#d9d0bb';
const YELLOW = '#d8a634';

/** Canvas anchor: building origin (x=0 at its left wall, y=0 at ground). */
const AX = 40;
const AY = 200;
const CANVAS_W = 260;
const CANVAS_H = 360; // tall enough for the shaft guides that run into the hole

/* ------------------------------------------------------------------ */
/*  Primitive helpers                                                  */
/* ------------------------------------------------------------------ */
function R(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  const left = Math.round(x), top = Math.round(y);
  w = Math.round(x + w) - left; h = Math.round(y + h) - top;
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(left, top, w, h);
}

/** Ink outline + bevelled fill. */
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Ramp) {
  R(ctx, x - 1, y - 1, w + 2, h + 2, INK);
  R(ctx, x, y, w, h, r[2]);
  R(ctx, x, y, w, 1, r[4]);
  R(ctx, x, y + 1, 1, h - 1, r[3]);
  R(ctx, x + w - 1, y + 1, 1, h - 1, r[1]);
  R(ctx, x + 1, y + h - 1, w - 2, 1, r[1]);
}

function ellipseFill(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string) {
  for (let yy = -Math.floor(ry); yy <= Math.floor(ry); yy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))));
    R(ctx, cx - half, cy + yy, half * 2 + 1, 1, c);
  }
}

function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, thick: number, c: string) {
  for (let yy = -r; yy <= r; yy++) {
    for (let xx = -r; xx <= r; xx++) {
      const d = Math.sqrt(xx * xx + yy * yy);
      if (d <= r + 0.4 && d >= r - thick + 0.4) R(ctx, cx + xx, cy + yy, 1, 1, c);
    }
  }
}

/* ---------------------------- pixel font ---------------------------- */
const FONT: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'], M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], '0': ['###', '#.#', '#.#', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'], ' ': ['..', '..', '..', '..', '..'],
};
function textWidth(s: string) {
  let w = 0;
  for (const ch of s) w += (FONT[ch]?.[0].length ?? 3) + 1;
  return w - 1;
}
function pixelText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, c: string) {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch];
    if (!g) { cx += 4; continue; }
    g.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') R(ctx, cx + rx, y + ry, 1, 1, c);
    });
    cx += g[0].length + 1;
  }
}

/** Wall-mounted sign plate. Returns its outer width. */
function signPlate(ctx: CanvasRenderingContext2D, x: number, y: number, s: string, bg: string, fg: string) {
  const w = textWidth(s) + 8;
  const h = 11;
  R(ctx, x - 1, y - 1, w + 2, h + 2, INK);
  R(ctx, x, y, w, h, bg);
  R(ctx, x, y, w, 1, shade(bg, 0.35));
  R(ctx, x, y + h - 1, w, 1, shade(bg, -0.4));
  R(ctx, x + 1, y + 2, 1, 1, shade(bg, 0.5)); // bolt heads
  R(ctx, x + w - 2, y + 2, 1, 1, shade(bg, 0.5));
  R(ctx, x + 1, y + h - 3, 1, 1, shade(bg, 0.5));
  R(ctx, x + w - 2, y + h - 3, 1, 1, shade(bg, 0.5));
  pixelText(ctx, s, x + 4, y + 4, shade(bg, -0.6));
  pixelText(ctx, s, x + 4, y + 3, fg);
  return w;
}

/* ---------------------------- materials ---------------------------- */
function corrugated(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Ramp, seed: number) {
  R(ctx, x - 1, y - 1, w + 2, h + 2, INK);
  const cols = [r[3], r[2], r[2], r[1]];
  for (let i = 0; i < w; i++) R(ctx, x + i, y, 1, h, cols[i % 4]);
  R(ctx, x, y, w, 1, r[4]);
  // horizontal sheet laps with run-off grime beneath each lap
  for (let sy = y + 18; sy < y + h - 4; sy += 18) {
    R(ctx, x, sy, w, 1, r[0]);
    R(ctx, x, sy + 1, w, 1, r[3]);
    for (let i = 0; i < w; i++) {
      const k = hash(seed + i * 3.7 + sy);
      if (k > 0.78) R(ctx, x + i, sy + 2, 1, 2 + Math.floor(k * 7), r[1]);
    }
  }
  // fastener rows
  for (let sy = y + 3; sy < y + h - 2; sy += 18) for (let i = 2; i < w - 1; i += 8) R(ctx, x + i, sy, 1, 1, r[4]);
  // rust blooms
  for (let i = 0; i < (w * h) / 140; i++) {
    const rx = x + 1 + Math.floor(hash(seed + i * 9.1) * (w - 4));
    const ry = y + 2 + Math.floor(hash(seed + i * 5.3) * (h - 6));
    R(ctx, rx, ry, 2, 1, RUST[3]);
    R(ctx, rx, ry + 1, 1, 2 + Math.floor(hash(i) * 3), RUST[2]);
  }
  R(ctx, x, y + h - 2, w, 2, r[1]); // base grime
}

function brickWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Ramp, seed: number) {
  R(ctx, x - 1, y - 1, w + 2, h + 2, INK);
  R(ctx, x, y, w, h, r[1]);
  for (let row = 0; row * 4 < h; row++) {
    const by = y + row * 4;
    const off = row % 2 ? 4 : 0;
    for (let bx = x - off; bx < x + w; bx += 8) {
      const l = Math.max(x, bx);
      const rgt = Math.min(x + w, bx + 7);
      const k = hash(seed + bx * 1.3 + row * 7.9);
      R(ctx, l, by, rgt - l, Math.min(3, y + h - by), k > 0.82 ? r[3] : k < 0.15 ? r[1] : r[2]);
      if (k > 0.4) R(ctx, l, by, rgt - l, 1, shade(k > 0.82 ? r[3] : r[2], 0.12));
    }
  }
  R(ctx, x, y, w, 1, r[4]);
  R(ctx, x + w - 1, y, 1, h, r[0]);
}

function concreteWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  R(ctx, x - 1, y - 1, w + 2, h + 2, INK);
  R(ctx, x, y, w, h, CONC[2]);
  R(ctx, x, y, w, 1, CONC[4]);
  R(ctx, x, y + 1, 1, h - 1, CONC[3]);
  R(ctx, x + w - 1, y + 1, 1, h - 1, CONC[1]);
  for (let fy = y + 8; fy < y + h - 1; fy += 8) R(ctx, x + 1, fy, w - 2, 1, CONC[1]); // formwork lines
  for (let i = 0; i < (w * h) / 30; i++) {
    R(ctx, x + 1 + hash(seed + i * 2.1) * (w - 3), y + 2 + hash(seed + i * 4.7) * (h - 4), 1, 1, i % 3 ? CONC[1] : CONC[3]);
  }
}

function panelWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Ramp) {
  R(ctx, x - 1, y - 1, w + 2, h + 2, INK);
  R(ctx, x, y, w, h, r[2]);
  R(ctx, x, y, w, 1, r[4]);
  for (let px = x + 16; px < x + w - 2; px += 16) {
    R(ctx, px, y + 1, 1, h - 1, r[0]);
    R(ctx, px + 1, y + 1, 1, h - 1, r[3]);
  }
  const mid = y + Math.floor(h / 2);
  R(ctx, x, mid, w, 1, r[0]);
  R(ctx, x, mid + 1, w, 1, r[3]);
  R(ctx, x + w - 1, y, 1, h, r[1]);
}

/** Concrete slab the building stands on (rows -6..-1). */
function slab(ctx: CanvasRenderingContext2D, x0: number, x1: number) {
  const w = x1 - x0;
  R(ctx, x0 - 1, -7, w + 2, 7, INK);
  R(ctx, x0, -6, w, 6, CONC[2]);
  R(ctx, x0, -6, w, 1, CONC[4]);
  R(ctx, x0, -5, w, 1, CONC[3]);
  R(ctx, x0, -1, w, 1, CONC[1]);
  for (let jx = x0 + 28; jx < x1 - 4; jx += 28) R(ctx, jx, -4, 1, 3, CONC[1]);
}

function windowPane(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lit: boolean) {
  R(ctx, x - 1, y - 1, w + 2, h + 2, INK);
  R(ctx, x, y, w, h, STEEL[3]);
  R(ctx, x + w - 1, y, 1, h, STEEL[1]);
  const gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2;
  for (let r = 0; r < gh; r++) {
    const k = r / Math.max(1, gh - 1);
    R(ctx, gx, gy + r, gw, 1, lit ? mix(WARM[3], WARM[1], k * 0.8) : mix(GLASS[2], GLASS[1], k));
  }
  if (lit) {
    R(ctx, gx, gy + gh - 3, gw, 3, WARM[0]); // interior counter silhouette
    R(ctx, gx + 2, gy + gh - 6, 3, 3, WARM[0]);
  } else {
    for (let d = 0; d < Math.min(gw, gh); d++) R(ctx, gx + gw - 3 - d, gy + d, 2, 1, GLASS[4]);
  }
  if (w > 11) R(ctx, x + Math.floor(w / 2), gy, 1, gh, STEEL[2]);
  if (h > 11) R(ctx, gx, y + Math.floor(h / 2), gw, 1, STEEL[2]);
  R(ctx, x - 2, y + h, w + 4, 2, INK); // sill
  R(ctx, x - 1, y + h, w + 2, 1, CONC[4]);
}

/* ---------------------------- piping ---------------------------- */
function pipeH(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, d: number, r: Ramp) {
  const l = Math.min(x0, x1), w = Math.abs(x1 - x0);
  R(ctx, l, y - 1, w, d + 2, INK);
  R(ctx, l, y, w, d, r[2]);
  R(ctx, l, y, w, 1, r[4]);
  R(ctx, l, y + d - 1, w, 1, r[1]);
  for (let fx = l + 14; fx < l + w - 3; fx += 18) {
    R(ctx, fx, y - 2, 2, d + 4, INK);
    R(ctx, fx, y - 1, 1, d + 2, r[3]);
  }
}
function pipeV(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, d: number, r: Ramp) {
  const t = Math.min(y0, y1), h = Math.abs(y1 - y0);
  R(ctx, x - 1, t, d + 2, h, INK);
  R(ctx, x, t, d, h, r[2]);
  R(ctx, x, t, 1, h, r[4]);
  R(ctx, x + d - 1, t, 1, h, r[1]);
  for (let fy = t + 14; fy < t + h - 3; fy += 18) {
    R(ctx, x - 2, fy, d + 4, 2, INK);
    R(ctx, x - 1, fy, d + 2, 1, r[3]);
  }
}
/** Orthogonal pipe run through the given corner points (top-left of the bore). */
function pipeRun(ctx: CanvasRenderingContext2D, pts: Point[], d: number, r: Ramp) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    if (ay === by) pipeH(ctx, ax, bx + (bx > ax ? d : 0), ay, d, r);
    else pipeV(ctx, ax, ay, by + (by > ay ? d : 0), d, r);
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    R(ctx, x - 1, y - 1, d + 2, d + 2, INK);
    R(ctx, x, y, d, d, r[2]);
    R(ctx, x, y, 1, 1, r[4]);
  }
}
/** Small clamp bracket connecting a pipe/beam to the wall behind it. */
function clampBand(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  R(ctx, x - 1, y - 1, w + 2, h + 2, INK);
  R(ctx, x, y, w, h, STEEL[3]);
}

function ladder(ctx: CanvasRenderingContext2D, x: number, yTop: number, yBot: number) {
  R(ctx, x, yTop, 1, yBot - yTop, INK);
  R(ctx, x + 4, yTop, 1, yBot - yTop, INK);
  for (let y = yTop + 1; y < yBot; y += 3) R(ctx, x + 1, y, 3, 1, STEEL[3]);
}

/** Guard rail standing on a deck whose top surface row is y. */
function railing(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  R(ctx, x, y - 8, w, 2, INK);
  R(ctx, x, y - 8, w, 1, STEEL[4]);
  R(ctx, x, y - 4, w, 1, STEEL[2]);
  for (let px = x; px < x + w; px += 7) R(ctx, px, y - 7, 1, 7, INK);
  R(ctx, x + w - 1, y - 7, 1, 7, INK);
}

/** Cylindrical chimney/stack rising from a roof (collar sits on yBase). */
function stack(ctx: CanvasRenderingContext2D, x: number, yBase: number, w: number, h: number, r: Ramp, bands = 0) {
  const top = yBase - h;
  R(ctx, x - 1, top, w + 2, h, INK);
  for (let i = 0; i < w; i++) {
    const k = (i + 0.5) / w;
    const idx = k < 0.14 ? 3 : k < 0.36 ? 4 : k < 0.62 ? 3 : k < 0.84 ? 2 : 1;
    R(ctx, x + i, top, 1, h, r[idx]);
    for (let b = 0; b < bands; b++) {
      R(ctx, x + i, top + 4 + b * 5, 1, 5, shade(b % 2 ? CREAM : RED, [-0.1, 0.12, 0, -0.2, -0.45][idx === 4 ? 1 : idx === 3 ? 2 : idx === 2 ? 3 : 4]));
    }
  }
  // soot staining at the mouth
  for (let row = 0; row < 7; row++) for (let i = 0; i < w; i++) {
    if (hash(x * 3 + i * 7.3 + row * 1.9) > row / 7) R(ctx, x + i, top + row, 1, 1, '#1f1a18');
  }
  for (let ry = top + 4 + bands * 5 + 6; ry < yBase - 6; ry += 14) {
    R(ctx, x - 2, ry, w + 4, 3, INK);
    R(ctx, x - 1, ry + 1, w + 2, 1, r[3]);
  }
  R(ctx, x - 2, top - 3, w + 4, 4, INK); // lip
  R(ctx, x - 1, top - 2, w + 2, 1, r[4]);
  R(ctx, x - 1, top - 1, w + 2, 1, r[2]);
  R(ctx, x + 1, top - 3, w - 2, 1, '#140f0e'); // dark bore
  R(ctx, x - 3, yBase - 5, w + 6, 6, INK); // collar on roof
  R(ctx, x - 2, yBase - 4, w + 4, 2, CONC[4]);
  R(ctx, x - 2, yBase - 2, w + 4, 1, CONC[2]);
}

/** Wall lamp: arm from (x, y) on the wall toward dir, shade + bulb. Returns bulb point. */
function wallLamp(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1): Point {
  const ax = dir === 1 ? x : x - 6;
  R(ctx, ax, y, 7, 2, INK);
  R(ctx, ax, y, 7, 1, STEEL[3]);
  const sx = dir === 1 ? x + 4 : x - 9;
  R(ctx, sx, y + 1, 6, 3, INK);
  R(ctx, sx + 1, y + 1, 4, 1, STEEL[4]);
  R(ctx, sx + 1, y + 4, 4, 1, WARM[4]);
  R(ctx, sx, y + 4, 1, 1, INK);
  R(ctx, sx + 5, y + 4, 1, 1, INK);
  return [sx + 3, y + 5];
}

/* ------------------------------------------------------------------ */
/*  Building builders (static, cached per tier)                        */
/* ------------------------------------------------------------------ */
function buildRefinery(ctx: CanvasRenderingContext2D, tier: number) {
  slab(ctx, -28, 162);
  // ---- ore hopper on braced stilts, feeding the hall through a chute ----
  for (const lx of [-26, -8]) {
    R(ctx, lx - 1, -47, 4, 41, INK);
    R(ctx, lx, -47, 2, 41, STEEL[2]);
    R(ctx, lx, -47, 1, 41, STEEL[3]);
    R(ctx, lx - 2, -9, 6, 3, INK); // base plates on the slab
    R(ctx, lx - 1, -8, 4, 1, STEEL[3]);
  }
  pixelLine(ctx, [-24, -26], [-8, -9], STEEL[1], 2);
  pixelLine(ctx, [-8, -26], [-24, -9], STEEL[1], 2);
  R(ctx, -24, -27, 16, 2, STEEL[1]);
  R(ctx, -31, -32, 34, 9, INK); // chute into the wall
  R(ctx, -30, -31, 30, 7, STEEL[2]);
  R(ctx, -30, -31, 30, 1, STEEL[4]);
  R(ctx, -30, -25, 30, 1, STEEL[1]);
  polygon(ctx, [[-30, -50], [-2, -50], [-11, -31], [-21, -31]], INK);
  polygon(ctx, [[-29, -49], [-3, -49], [-12, -32], [-20, -32]], RUST[2]);
  polygon(ctx, [[-29, -49], [-20, -49], [-17, -32], [-20, -32]], RUST[3]);
  polygon(ctx, [[-9, -49], [-3, -49], [-12, -32], [-14, -32]], RUST[1]);
  for (let yy = -46; yy < -33; yy += 4) R(ctx, -26 + (yy + 46) / 3, yy, 18 - ((yy + 46) * 2) / 3, 1, RUST[1]);
  R(ctx, -31, -51, 30, 2, INK);
  R(ctx, -30, -51, 28, 1, RUST[4]);
  polygon(ctx, [[-28, -51], [-5, -51], [-9, -55], [-15, -58], [-23, -55]], '#3a302b'); // ore heap
  for (let i = 0; i < 18; i++) {
    const ox = -26 + Math.floor(hash(i * 3.1) * 19);
    const oy = -52 - Math.floor(hash(i * 7.7) * 4);
    R(ctx, ox, oy, 2, 1, ['#d97236', '#e6d825', '#6d7587', '#9b8b7a'][i % 4]);
  }

  // ---- main smelting hall ----
  concreteWall(ctx, 0, -26, 98, 20, 11);
  corrugated(ctx, 0, -70, 98, 44, RUST, 17);
  R(ctx, -1, -27, 100, 2, INK);
  R(ctx, 0, -27, 98, 1, STEEL[3]);
  // roof plane (side elevation of a low pitch roof) + eave shadow on the wall
  polygon(ctx, [[-5, -70], [103, -70], [99, -79], [-1, -79]], INK);
  polygon(ctx, [[-4, -71], [102, -71], [98, -78], [0, -78]], STEEL[2]);
  R(ctx, 0, -78, 98, 1, STEEL[4]);
  for (let sx = 2; sx < 98; sx += 6) R(ctx, sx, -77, 1, 6, STEEL[1]);
  R(ctx, 0, -69, 98, 2, RUST[0]);
  // ventilating roof monitor with louvres
  R(ctx, 27, -89, 53, 11, INK);
  R(ctx, 28, -88, 51, 10, STEEL[1]);
  for (let ly = -87; ly < -79; ly += 2) R(ctx, 29, ly, 49, 1, STEEL[3]);
  for (let lx = 40; lx < 78; lx += 12) R(ctx, lx, -88, 1, 10, STEEL[0]);
  polygon(ctx, [[23, -89], [84, -89], [80, -93], [27, -93]], INK);
  polygon(ctx, [[24, -90], [83, -90], [79, -92], [28, -92]], STEEL[3]);
  // stacks (A with aviation bands and a service platform; B smaller)
  stack(ctx, 6, -78, 12, 80, STEEL, 4);
  stack(ctx, 86, -78, 9, 54, STEEL, 0);
  ladder(ctx, 19, -150, -78);
  R(ctx, 0, -124, 25, 4, INK); // platform grating cantilevered off the stack
  R(ctx, 1, -123, 23, 1, STEEL[4]);
  R(ctx, 1, -122, 23, 1, STEEL[1]);
  railing(ctx, 0, -124, 25);
  pixelLine(ctx, [1, -120], [6, -112], INK, 2); // knee braces under the platform
  pixelLine(ctx, [23, -120], [18, -112], INK, 2);
  // downspout fixed to the wall corner
  pipeV(ctx, 1, -70, -6, 3, STEEL);
  for (const cy of [-60, -40, -18]) clampBand(ctx, 0, cy, 5, 1);
  R(ctx, -1, -9, 6, 3, INK);
  R(ctx, 0, -8, 4, 1, STEEL[3]);

  // ---- furnace bay with steel portal frame ----
  R(ctx, 7, -47, 41, 41, INK);
  R(ctx, 10, -44, 35, 38, '#160e0b');
  brickWall(ctx, 11, -43, 33, 37, BRICK, 31);
  R(ctx, 11, -43, 33, 37, 'rgba(10,6,5,0.55)');
  R(ctx, 8, -46, 3, 40, STEEL[3]); // portal columns
  R(ctx, 44, -46, 3, 40, STEEL[1]);
  R(ctx, 8, -46, 39, 3, STEEL[4]);
  for (let ry = -43; ry < -8; ry += 6) { R(ctx, 9, ry, 1, 1, STEEL[4]); R(ctx, 45, ry, 1, 1, STEEL[4]); }
  // furnace vessel standing inside the bay
  R(ctx, 16, -36, 24, 30, INK);
  R(ctx, 17, -35, 22, 29, STEEL[1]);
  R(ctx, 17, -35, 22, 2, STEEL[3]);
  R(ctx, 17, -35, 2, 29, STEEL[2]);
  for (const by of [-29, -12]) R(ctx, 17, by, 22, 1, STEEL[0]);
  R(ctx, 21, -26, 14, 10, INK); // furnace mouth (lit at runtime)
  R(ctx, 22, -25, 12, 8, '#3a160c');
  // extraction hood + duct to the roof
  polygon(ctx, [[5, -55], [50, -55], [46, -46], [9, -46]], INK);
  polygon(ctx, [[6, -54], [49, -54], [45, -47], [10, -47]], STEEL[2]);
  R(ctx, 6, -54, 43, 1, STEEL[4]);
  pipeV(ctx, 24, -70, -54, 7, STEEL);

  // ---- overhead monorail + casting conveyor ----
  R(ctx, 47, -49, 51, 4, INK);
  R(ctx, 48, -48, 49, 1, STEEL[4]);
  R(ctx, 48, -47, 49, 1, STEEL[1]);
  for (const bx of [52, 74, 94]) { R(ctx, bx - 1, -53, 4, 5, INK); R(ctx, bx, -52, 2, 3, STEEL[3]); }
  R(ctx, 47, -16, 52, 4, INK);
  R(ctx, 48, -15, 50, 2, STEEL[2]);
  R(ctx, 48, -15, 50, 1, STEEL[3]);
  for (const lx of [50, 72, 95]) { R(ctx, lx - 1, -12, 4, 6, INK); R(ctx, lx, -12, 2, 6, STEEL[2]); }

  signPlate(ctx, 52, -66, 'REFINERY', '#24323a', '#f2c46a');

  // ---- control annex ----
  brickWall(ctx, 98, -52, 54, 46, BRICK, 41);
  R(ctx, 97, -56, 56, 5, INK);
  R(ctx, 98, -55, 54, 2, CONC[4]);
  R(ctx, 98, -53, 54, 1, CONC[2]);
  windowPane(ctx, 104, -45, 17, 14, true);
  windowPane(ctx, 125, -45, 11, 14, true);
  R(ctx, 139, -28, 11, 22, INK); // door
  R(ctx, 140, -27, 9, 21, STEEL[2]);
  R(ctx, 140, -27, 9, 1, STEEL[4]);
  R(ctx, 141, -25, 7, 5, GLASS[2]);
  R(ctx, 141, -18, 7, 1, STEEL[1]);
  R(ctx, 147, -15, 1, 2, YELLOW);
  R(ctx, 136, -32, 17, 3, INK); // canopy with brackets
  R(ctx, 137, -31, 15, 1, STEEL[4]);
  pixelLine(ctx, [138, -29], [140, -27], INK);
  pixelLine(ctx, [150, -29], [148, -27], INK);
  wallLamp(ctx, 138, -24, -1);
  // rooftop HVAC unit standing on the parapet
  box(ctx, 104, -66, 20, 10, STEEL);
  R(ctx, 106, -57, 2, 1, INK);
  R(ctx, 120, -57, 2, 1, INK);
  ring(ctx, 114, -61, 4, 1, INK);
  // radio mast with base plate and guy wire
  R(ctx, 141, -86, 2, 31, INK);
  R(ctx, 141, -86, 1, 31, STEEL[4]);
  R(ctx, 138, -57, 8, 2, INK);
  for (const cy of [-82, -72]) { R(ctx, 138, cy, 8, 1, INK); }
  pixelLine(ctx, [142, -85], [151, -57], STEEL[1]);
  R(ctx, 140, -88, 4, 2, INK);
  // process steam main: hall wall -> over the annex -> down to a valve pit
  pipeRun(ctx, [[97, -63], [154, -63], [154, -12]], 3, STEEL);
  R(ctx, 128, -60, 3, 5, INK); // pipe stand on the annex roof
  R(ctx, 129, -60, 1, 5, STEEL[3]);
  ring(ctx, 155, -38, 4, 1, RED); // valve hand-wheel on the riser
  R(ctx, 155, -38, 1, 1, INK);
  box(ctx, 149, -13, 13, 7, CONC);

  if (tier >= 1) { // turbine roof ventilator on the monitor cap
    R(ctx, 49, -98, 9, 6, INK);
    R(ctx, 50, -97, 7, 4, STEEL[3]);
    ellipseFill(ctx, 53, -99, 5, 3, INK);
    ellipseFill(ctx, 53, -99, 4, 2, STEEL[4]);
  }
  if (tier >= 2) { // heat-exchanger loop teed off the steam main
    pipeRun(ctx, [[126, -63], [126, -71], [136, -71], [136, -63]], 2, RUST);
    box(ctx, 128, -74, 7, 4, RUST);
  }
}

function buildForge(ctx: CanvasRenderingContext2D, tier: number) {
  slab(ctx, -20, 150);
  // ---- raised loading dock with rubber bumpers ----
  concreteWall(ctx, -18, -16, 18, 10, 61);
  R(ctx, -19, -17, 20, 1, INK);
  R(ctx, -18, -17, 18, 1, YELLOW);
  R(ctx, -2, -14, 2, 5, '#1a1a1a');
  // ---- main shop (gable end) ----
  concreteWall(ctx, 0, -16, 104, 10, 63);
  corrugated(ctx, 0, -60, 104, 44, TEAL, 67);
  polygon(ctx, [[0, -60], [52, -84], [104, -60]], INK);
  polygon(ctx, [[1, -60], [52, -83], [103, -60]], TEAL[2]);
  for (let gx = 4; gx < 102; gx += 4) {
    const half = 52 - Math.abs(gx - 52);
    R(ctx, gx, -60 - Math.floor((half * 23) / 52) + 1, 1, Math.floor((half * 23) / 52) - 1, TEAL[gx % 8 === 0 ? 3 : 1]);
  }
  pixelLine(ctx, [-4, -58], [52, -86], INK, 3); // fascia boards
  pixelLine(ctx, [52, -86], [108, -58], INK, 3);
  pixelLine(ctx, [-3, -59], [52, -86], STEEL[4]);
  pixelLine(ctx, [52, -86], [107, -59], STEEL[2]);
  box(ctx, 47, -80, 10, 6, TEAL); // gable louvre
  for (let ly = -79; ly < -75; ly += 2) R(ctx, 48, ly, 8, 1, TEAL[0]);
  signPlate(ctx, 29, -72, 'DRILL FORGE', '#1d2b30', '#9fd3d4');
  // ---- roll-up door opening & visible workshop interior ----
  R(ctx, 11, -55, 54, 49, INK);
  R(ctx, 14, -48, 48, 42, '#121719');
  R(ctx, 14, -48, 48, 1, '#1c2427');
  // workbench with vice and tools against the back wall
  R(ctx, 17, -24, 26, 3, INK);
  R(ctx, 18, -23, 24, 1, '#7a5a3a');
  R(ctx, 19, -21, 2, 15, INK);
  R(ctx, 39, -21, 2, 15, INK);
  R(ctx, 22, -28, 5, 4, STEEL[2]);
  R(ctx, 34, -27, 7, 3, '#9a8152');
  R(ctx, 18, -40, 24, 10, '#1b2124'); // pegboard
  for (const [tx, tc] of [[20, '#8b93a5'], [25, '#c78c3a'], [30, '#8b93a5'], [36, '#6f7889']] as const) R(ctx, tx, -38, 2, 6, tc);
  // brick hearth with hood rising into the ceiling
  R(ctx, 46, -24, 14, 18, INK);
  brickWall(ctx, 47, -23, 12, 17, BRICK, 71);
  R(ctx, 49, -16, 8, 6, '#2a0f08');
  polygon(ctx, [[45, -30], [61, -30], [57, -24], [49, -24]], STEEL[1]);
  R(ctx, 51, -48, 4, 18, STEEL[1]);
  // welding robot pedestal (arm animated at runtime)
  R(ctx, 25, -12, 9, 6, INK);
  R(ctx, 26, -11, 7, 5, YELLOW);
  R(ctx, 26, -11, 7, 1, '#f0cf6e');
  // jambs, header and roll-box
  R(ctx, 11, -49, 3, 43, STEEL[3]);
  R(ctx, 62, -49, 3, 43, STEEL[1]);
  R(ctx, 11, -55, 54, 6, STEEL[2]);
  R(ctx, 11, -55, 54, 1, STEEL[4]);
  R(ctx, 11, -50, 54, 1, STEEL[0]);
  for (let hy = -45; hy < -8; hy += 8) { R(ctx, 11, hy, 3, 2, YELLOW); R(ctx, 62, hy, 3, 2, YELLOW); }
  // ---- cantilever hoist beam with knee brace ----
  R(ctx, -22, -59, 26, 4, INK);
  R(ctx, -21, -58, 24, 1, STEEL[4]);
  R(ctx, -21, -57, 24, 1, STEEL[1]);
  R(ctx, -23, -61, 3, 8, INK); // end stop
  pixelLine(ctx, [0, -44], [-14, -56], INK, 3);
  pixelLine(ctx, [-1, -45], [-13, -56], STEEL[3]);
  R(ctx, -1, -60, 4, 18, INK); // wall plate
  R(ctx, 0, -59, 2, 16, STEEL[3]);
  // ---- air compressor on the slab with pipe into the wall ----
  R(ctx, 70, -9, 4, 3, INK); R(ctx, 90, -9, 4, 3, INK); // saddle feet
  R(ctx, 67, -18, 30, 10, INK);
  for (let r = 0; r < 8; r++) R(ctx, 68, -17 + r, 28, 1, [STEEL[4], STEEL[3], STEEL[3], STEEL[2], STEEL[2], STEEL[1], STEEL[1], STEEL[0]][r]);
  R(ctx, 96, -16, 2, 6, INK);
  box(ctx, 71, -25, 10, 7, TEAL); // electric motor
  for (let fy = -24; fy < -19; fy += 2) R(ctx, 72, fy, 8, 1, TEAL[1]);
  box(ctx, 86, -28, 8, 10, STEEL); // compressor head
  for (let fy = -27; fy < -19; fy += 2) R(ctx, 87, fy, 6, 1, STEEL[1]);
  ring(ctx, 95, -22, 4, 1, INK); // flywheel rim (spokes at runtime)
  ring(ctx, 95, -22, 3, 1, STEEL[3]);
  R(ctx, 79, -22, 2, 2, INK); // motor pulley
  pixelLine(ctx, [80, -24], [95, -26], INK); // drive belt
  pixelLine(ctx, [80, -20], [95, -18], INK);
  wallLamp(ctx, 66, -47, -1);
  pipeRun(ctx, [[88, -29], [88, -40], [66, -40]], 2, STEEL);
  clampBand(ctx, 76, -42, 1, 5);
  // ---- smithy lean-to with brick chimney ----
  brickWall(ctx, 104, -54, 44, 48, BRICK, 79);
  polygon(ctx, [[102, -55], [104, -61], [150, -51], [150, -48]], INK);
  polygon(ctx, [[103, -56], [104, -59], [149, -50], [149, -49]], STEEL[3]);
  R(ctx, 104, -54, 44, 2, BRICK[0]);
  windowPane(ctx, 112, -42, 22, 15, true);
  brickWall(ctx, 125, -104, 10, 52, BRICK, 83);
  R(ctx, 123, -107, 14, 4, INK);
  R(ctx, 124, -106, 12, 1, CONC[4]);
  R(ctx, 124, -105, 12, 1, CONC[2]);
  R(ctx, 126, -113, 8, 6, INK); // spark-arrestor cage
  for (let mx = 127; mx < 133; mx += 2) R(ctx, mx, -112, 1, 5, STEEL[3]);
  R(ctx, 124, -115, 12, 2, INK);
  R(ctx, 125, -115, 10, 1, STEEL[3]);
  // drill-bit rack: posts on the slab, bits hung from the top rail
  for (const px of [110, 140]) { R(ctx, px - 1, -24, 3, 18, INK); R(ctx, px, -24, 1, 18, STEEL[3]); }
  R(ctx, 109, -25, 33, 2, INK);
  R(ctx, 110, -25, 31, 1, STEEL[4]);
  R(ctx, 109, -14, 33, 2, INK);
  [[116, '#c3ccd9'], [125, '#e0b04c'], [134, '#7fc6c3']].forEach(([bx, bc]) => {
    const x = bx as number;
    R(ctx, x - 1, -23, 3, 2, INK);
    polygon(ctx, [[x - 3, -21], [x + 3, -21], [x, -9]], INK);
    polygon(ctx, [[x - 2, -21], [x + 2, -21], [x, -11]], bc as string);
    for (let s = -20; s < -12; s += 3) R(ctx, x - 1, s, 2, 1, shade(bc as string, -0.35));
  });
  if (tier >= 1) { // ridge exhaust fan housing seated on the gable apex
    R(ctx, 47, -94, 11, 9, INK);
    R(ctx, 48, -93, 9, 7, STEEL[2]);
    R(ctx, 48, -93, 9, 1, STEEL[4]);
    R(ctx, 46, -96, 13, 3, INK);
    R(ctx, 47, -95, 11, 1, STEEL[3]);
  }
  if (tier >= 2) { // second receiver tank strapped to the compressor
    R(ctx, 66, -32, 7, 14, INK);
    R(ctx, 67, -31, 5, 13, STEEL[3]);
    R(ctx, 67, -31, 1, 13, STEEL[4]);
  }
}

function buildRepair(ctx: CanvasRenderingContext2D, tier: number) {
  slab(ctx, -2, 112);
  panelWall(ctx, 0, -58, 98, 52, SAGE);
  R(ctx, -1, -62, 100, 5, INK);
  R(ctx, 0, -61, 98, 2, CONC[4]);
  R(ctx, 0, -59, 98, 1, CONC[2]);
  R(ctx, 52, -31, 46, 3, INK); // company stripe
  R(ctx, 52, -30, 46, 1, '#5fb47c');
  // ---- open service bay with lift pit, pegboard and tool chest ----
  R(ctx, 5, -44, 46, 38, INK);
  R(ctx, 7, -42, 42, 36, '#141c18');
  R(ctx, 10, -38, 20, 12, '#1d2723');
  for (let hx = 12; hx < 29; hx += 3) for (let hy = -36; hy < -27; hy += 3) R(ctx, hx, hy, 1, 1, '#0d1310');
  R(ctx, 13, -36, 2, 7, '#8b93a5');
  R(ctx, 18, -35, 5, 2, '#8b93a5');
  R(ctx, 19, -33, 1, 4, '#8b93a5');
  R(ctx, 25, -36, 2, 6, '#d08a3a');
  R(ctx, 38, -21, 10, 15, INK); // red roll cab
  R(ctx, 39, -20, 8, 14, '#9c3b2c');
  for (let dy = -17; dy < -7; dy += 3) R(ctx, 39, dy, 8, 1, '#5e2018');
  R(ctx, 12, -42, 26, 2, INK); // fluorescent fixture on the header
  R(ctx, 14, -40, 22, 2, INK);
  R(ctx, 15, -40, 20, 1, '#e8f4e6');
  R(ctx, 12, -10, 26, 4, INK); // lift base in the floor
  R(ctx, 13, -9, 24, 2, STEEL[2]);
  R(ctx, 13, -9, 24, 1, STEEL[3]);
  R(ctx, 5, -47, 46, 4, INK);
  R(ctx, 6, -46, 44, 2, STEEL[3]);
  R(ctx, 5, -44, 2, 38, STEEL[3]);
  R(ctx, 49, -44, 2, 38, STEEL[1]);
  signPlate(ctx, 11, -58, 'SERVICE', '#1d3326', '#a6dcb2');
  // ---- office: window, door, illuminated cross box ----
  windowPane(ctx, 56, -42, 20, 14, true);
  R(ctx, 81, -28, 12, 22, INK);
  R(ctx, 82, -27, 10, 21, SAGE[3]);
  R(ctx, 82, -27, 10, 1, SAGE[4]);
  R(ctx, 84, -25, 6, 6, GLASS[2]);
  R(ctx, 90, -16, 1, 2, YELLOW);
  R(ctx, 79, -46, 16, 14, INK);
  R(ctx, 80, -45, 14, 12, '#203a2a');
  R(ctx, 86, -43, 2, 8, '#2f5e3c'); // cross (lit at runtime)
  R(ctx, 83, -40, 8, 2, '#2f5e3c');
  // hose reel bolted to the wall
  R(ctx, 54, -22, 2, 6, INK);
  ring(ctx, 60, -19, 5, 2, '#2a2f2c');
  ring(ctx, 60, -19, 3, 1, '#c8a23c');
  R(ctx, 59, -20, 3, 3, STEEL[3]);
  pixelLine(ctx, [60, -14], [62, -6], '#2a2f2c', 2);
  // ---- EV charging post on the slab with a looped cable on its hook ----
  R(ctx, 99, -8, 12, 2, INK);
  R(ctx, 101, -38, 8, 30, INK);
  R(ctx, 102, -37, 6, 29, STEEL[3]);
  R(ctx, 102, -37, 1, 29, STEEL[4]);
  R(ctx, 103, -35, 4, 5, '#0d1a14');
  R(ctx, 109, -27, 2, 2, INK); // hook
  pixelLine(ctx, [108, -20], [111, -12], '#1c2120', 2);
  pixelLine(ctx, [111, -12], [113, -14], '#1c2120', 2);
  pixelLine(ctx, [113, -14], [110, -27], '#1c2120', 2);
  // ---- solar arrays on parapet-mounted racks ----
  const panel = (x: number) => {
    R(ctx, x + 2, -66, 2, 5, INK); // front leg
    R(ctx, x + 28, -71, 2, 10, INK); // rear leg
    polygon(ctx, [[x, -66], [x + 32, -66], [x + 30, -73], [x + 2, -73]], INK);
    polygon(ctx, [[x + 1, -67], [x + 31, -67], [x + 29, -72], [x + 3, -72]], '#1d3a5a');
    for (let cx = x + 6; cx < x + 30; cx += 5) R(ctx, cx, -72, 1, 6, '#3f6488');
    R(ctx, x + 2, -70, 28, 1, '#3f6488');
    R(ctx, x + 3, -72, 26, 1, '#6f95b8');
  };
  panel(6);
  if (tier >= 1) panel(44);
  if (tier >= 2) { box(ctx, 82, -69, 12, 8, STEEL); R(ctx, 85, -67, 6, 1, '#5fb47c'); }
  if (tier >= 3) { // roof mast with a small dish
    R(ctx, 95, -86, 2, 25, INK);
    R(ctx, 95, -86, 1, 25, STEEL[4]);
    ellipseFill(ctx, 91, -82, 4, 6, INK);
    ellipseFill(ctx, 91, -82, 3, 5, STEEL[4]);
    R(ctx, 93, -83, 2, 2, INK);
  }
}

function buildShaft(ctx: CanvasRenderingContext2D) {
  // concrete collar blocks framing the hole (hole spans x 16..112)
  concreteWall(ctx, 2, -8, 14, 8, 91);
  concreteWall(ctx, 112, -8, 26, 8, 93);
  // concrete shaft lining (the timbers and guides below bolt into it)
  for (const lx of [14, 111]) {
    R(ctx, lx - 1, 0, 5, 162, INK);
    R(ctx, lx, 0, 3, 162, CONC[2]);
    R(ctx, lx, 0, 1, 162, CONC[3]);
    for (let y = 8; y < 160; y += 8) R(ctx, lx, y, 3, 1, CONC[1]);
  }
  // guide rails continuing down the hole (visible through open tiles)
  for (const gx of [32, 66, 82, 102]) {
    R(ctx, gx, -8, 2, 168, INK);
    R(ctx, gx, -8, 1, 168, STEEL[2]);
    for (let y = 4; y < 160; y += 24) R(ctx, gx - 1, y, 4, 2, STEEL[1]);
  }
  for (let y = 10; y < 160; y += 48) { R(ctx, 16, y - 1, 96, 5, INK); R(ctx, 16, y, 96, 3, '#2a1f17'); R(ctx, 16, y, 96, 1, '#5c4433'); }
  // lattice towers on both sides of the hole
  const tower = (x: number) => {
    R(ctx, x - 1, -130, 12, 122, INK);
    R(ctx, x, -130, 2, 122, STEEL[3]);
    R(ctx, x + 8, -130, 2, 122, STEEL[1]);
    R(ctx, x + 2, -130, 6, 122, '#1a2128');
    for (let y = -130; y < -10; y += 12) {
      R(ctx, x + 2, y, 6, 1, STEEL[2]);
      pixelLine(ctx, [x + 2, y + 1], [x + 7, y + 11], STEEL[2]);
    }
    R(ctx, x - 3, -11, 16, 4, INK); // foot plate on the collar
    R(ctx, x - 2, -10, 14, 2, STEEL[3]);
  };
  tower(6);
  tower(112);
  // lattice girts spanning the hole
  for (const gy of [-62, -102]) {
    R(ctx, 16, gy - 1, 96, 8, INK);
    R(ctx, 16, gy, 96, 1, STEEL[4]);
    R(ctx, 16, gy + 5, 96, 1, STEEL[1]);
    for (let x = 16; x < 112; x += 8) pixelLine(ctx, [x, gy + 1], [x + 4, gy + 4], STEEL[2]);
  }
  signPlate(ctx, 47, -55, 'MINE 07', '#3a2a1c', '#e8c98c');
  // raked back leg toward the winch side, landing on its own footing
  pixelLine(ctx, [121, -124], [133, -12], INK, 6);
  pixelLine(ctx, [122, -123], [134, -12], STEEL[3], 2);
  for (let k = 0.1; k < 0.95; k += 0.12) {
    const y = -124 + k * 112;
    const x = 121 + k * 12;
    R(ctx, x - 9, y, 12, 1, INK); // ties back to the tower
  }
  box(ctx, 128, -14, 12, 6, CONC);
  // ladder on the left tower
  ladder(ctx, 0, -134, -8);
  // sheave deck with railing
  R(ctx, -1, -137, 132, 6, INK);
  R(ctx, 0, -136, 130, 1, STEEL[4]);
  R(ctx, 0, -135, 130, 2, STEEL[2]);
  railing(ctx, 0, -137, 130);
  // A-frame bearing stands for the two sheaves
  pixelLine(ctx, [50, -137], [64, -152], INK, 3);
  pixelLine(ctx, [78, -137], [64, -152], INK, 3);
  pixelLine(ctx, [92, -137], [100, -147], INK, 3);
  pixelLine(ctx, [108, -137], [100, -147], INK, 3);
  ring(ctx, 64, -152, 15, 3, INK); // big sheave rim (spokes at runtime)
  ring(ctx, 64, -152, 14, 1, STEEL[4]);
  ring(ctx, 100, -147, 9, 2, INK);
  ring(ctx, 100, -147, 8, 1, STEEL[3]);
  // hoist ropes from the sheaves down to the winch house drum
  pixelLine(ctx, [74, -163], [151, -22], '#2a2e33');
  pixelLine(ctx, [106, -154], [153, -21], '#2a2e33');
  // beacon mast on the deck
  R(ctx, 122, -152, 2, 15, INK);
  R(ctx, 120, -154, 6, 3, INK);
  // deck flood lamps hanging under the deck ends
  for (const lx of [3, 122]) {
    R(ctx, lx, -131, 2, 3, INK);
    R(ctx, lx - 2, -128, 6, 3, INK);
    R(ctx, lx - 1, -127, 4, 1, STEEL[3]);
    R(ctx, lx - 1, -126, 4, 1, WARM[4]);
  }
  // winch house that the ropes enter
  brickWall(ctx, 142, -32, 24, 26, BRICK, 97);
  polygon(ctx, [[140, -32], [168, -32], [168, -36], [142, -38]], INK);
  polygon(ctx, [[141, -33], [167, -33], [167, -35], [142, -37]], STEEL[3]);
  R(ctx, 147, -27, 10, 9, INK); // drum window (drum animated)
  R(ctx, 148, -26, 8, 7, '#1a1410');
  R(ctx, 150, -24, 2, 3, '#140f0c'); // rope entry slot
  R(ctx, 159, -18, 5, 12, INK);
  R(ctx, 160, -17, 3, 11, STEEL[2]);
  R(ctx, 140, -7, 28, 1, CONC[1]);
  R(ctx, 139, -7, 30, 7, INK); // its own small slab
  R(ctx, 140, -6, 28, 5, CONC[2]);
  R(ctx, 140, -6, 28, 1, CONC[4]);
}

function buildHabitat(ctx: CanvasRenderingContext2D) {
  // water tank on a braced stand, piped into the bunker
  for (const lx of [154, 168]) { R(ctx, lx - 1, -40, 4, 34, INK); R(ctx, lx, -40, 2, 34, STEEL[2]); }
  pixelLine(ctx, [155, -36], [168, -10], INK, 2);
  pixelLine(ctx, [168, -36], [155, -10], INK, 2);
  R(ctx, 150, -68, 24, 30, INK);
  for (let i = 0; i < 22; i++) {
    const k = (i + 0.5) / 22;
    R(ctx, 151 + i, -67, 1, 28, k < 0.3 ? STEEL[4] : k < 0.6 ? STEEL[3] : k < 0.85 ? STEEL[2] : STEEL[1]);
  }
  for (const by of [-60, -50]) R(ctx, 151, by, 22, 1, STEEL[1]);
  ellipseFill(ctx, 162, -68, 11, 3, INK);
  ellipseFill(ctx, 162, -68, 10, 2, STEEL[4]);
  pipeRun(ctx, [[160, -38], [160, -12], [140, -12]], 2, STEEL);
  // corrugated arch roof (end elevation of a Quonset hut)
  const cx = 70, cy = -8, rx = 74, ry = 76;
  for (let y = cy - ry - 1; y <= cy; y++) {
    for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      const dx = (x - cx) / (rx + 1), dy = (y - cy) / (ry + 1);
      const rho = Math.sqrt(dx * dx + dy * dy);
      if (rho > 1) continue;
      let c: string;
      if (rho > 0.975) c = INK;
      else if (rho > 0.9) {
        const ang = Math.atan2(y - cy, x - cx);
        const rib = Math.floor((ang + Math.PI) * 30) % 3;
        const lit = x < cx ? 1 : 0;
        c = rib === 0 ? STEEL[1] : rib === 1 ? STEEL[2 + lit] : STEEL[3 + lit];
      } else if (rho > 0.885) c = INK;
      else {
        const plank = Math.floor((x + 200) / 9);
        const k = hash(plank * 3.3);
        c = (x + 200) % 9 === 0 ? '#2d241c' : k > 0.6 ? '#6e5a44' : k > 0.25 ? '#5f4d3a' : '#544433';
        if (y > -22) c = shade(c, -0.15);
      }
      R(ctx, x, y, 1, 1, c);
    }
  }
  // porthole windows
  for (const wx of [24, 116]) {
    ellipseFill(ctx, wx, -38, 8, 8, INK);
    ellipseFill(ctx, wx, -38, 6, 6, STEEL[3]);
    ellipseFill(ctx, wx, -38, 4, 4, WARM[2]);
    R(ctx, wx - 2, -40, 2, 1, WARM[4]);
  }
  // vault door opening (door slab animated at runtime)
  R(ctx, 47, -61, 42, 55, INK);
  R(ctx, 50, -58, 36, 52, '#2a1e14');
  for (let yy = -58; yy < -6; yy++) R(ctx, 50, yy, 36, 1, mix(WARM[2], WARM[0], (yy + 58) / 52));
  R(ctx, 52, -40, 10, 34, '#3a2716'); // interior: shelving and lamp
  for (let sy = -38; sy < -8; sy += 8) R(ctx, 52, sy, 10, 1, '#1f150c');
  R(ctx, 74, -58, 1, 8, INK);
  R(ctx, 72, -50, 5, 2, INK);
  R(ctx, 73, -48, 3, 1, WARM[4]);
  R(ctx, 47, -61, 3, 55, STEEL[3]); // heavy frame
  R(ctx, 86, -61, 3, 55, STEEL[1]);
  R(ctx, 47, -61, 42, 3, STEEL[4]);
  signPlate(ctx, 47, -73, 'OUTPOST 07', '#2b2a24', '#efd9a0');
  // stove chimney through the roof with rain cap
  pipeV(ctx, 103, -96, -64, 4, STEEL);
  R(ctx, 99, -66, 12, 3, INK); // roof flashing
  R(ctx, 100, -65, 10, 1, STEEL[3]);
  R(ctx, 99, -100, 12, 2, INK);
  R(ctx, 100, -100, 10, 1, STEEL[4]);
  R(ctx, 104, -98, 2, 2, INK);
  // dish on a bracket bolted to the arch
  R(ctx, 14, -68, 8, 3, INK);
  pixelLine(ctx, [16, -68], [10, -80], INK, 2);
  ellipseFill(ctx, 8, -84, 6, 9, INK);
  ellipseFill(ctx, 8, -84, 5, 8, STEEL[4]);
  ellipseFill(ctx, 9, -84, 3, 6, STEEL[3]);
  // sandbag revetments either side of the door
  const bag = (x: number, y: number) => {
    R(ctx, x, y, 12, 6, INK);
    R(ctx, x + 1, y + 1, 10, 4, '#8a7a58');
    R(ctx, x + 1, y + 1, 10, 1, '#a99668');
    R(ctx, x + 1, y + 4, 10, 1, '#6a5c42');
  };
  for (let x = -8; x < 40; x += 11) { bag(x, -12); if (x < 30) bag(x + 5, -17); }
  for (let x = 92; x < 146; x += 11) { bag(x, -12); if (x < 136) bag(x + 5, -17); }
}

const builders: Record<BuildingKind, (ctx: CanvasRenderingContext2D, tier: number) => void> = {
  refinery: buildRefinery,
  forge: buildForge,
  repair: buildRepair,
  shaft: (ctx) => buildShaft(ctx),
  habitat: (ctx) => buildHabitat(ctx),
};

const cache = new Map<string, HTMLCanvasElement>();
export function buildingSprite(kind: BuildingKind, tier: number): HTMLCanvasElement {
  const key = `${kind}:${tier}`;
  let c = cache.get(key);
  if (!c) {
    const [canvas, ctx] = makeCanvas(CANVAS_W, CANVAS_H);
    ctx.translate(AX, AY);
    builders[kind](ctx, tier);
    cache.set(key, canvas);
    c = canvas;
  }
  return c;
}

/* ------------------------------------------------------------------ */
/*  Animated overlays                                                  */
/* ------------------------------------------------------------------ */
/** Continuous smoke plume: overlapping puffs (always starting inside the mouth)
 *  are drawn opaque off-screen, then composited once so density stays even. */
const plumeLayer = makeCanvas(96, 96);
const smokeDiscs = new Map<string, HTMLCanvasElement>();
function smokeDisc(rx: number, ry: number, color: string) {
  const key = `${rx}:${ry}:${color}`;
  const hit = cacheGet(smokeDiscs, key);
  if (hit) return hit;
  const [c, g] = makeCanvas(rx * 2 + 1, ry * 2 + 1);
  ellipseFill(g, rx, ry, rx, ry, color);
  return cacheSet(smokeDiscs, key, c, 192);
}
function plume(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number, strength: number, light: string, dark: string) {
  const [layer, g] = plumeLayer;
  g.clearRect(0, 0, 96, 96);
  const n = 12;
  const spacing = 5;
  const phase = (t * 7 + seed * 3) % spacing;
  const ox = 20;
  const oy = 90;
  for (let i = n; i >= 0; i--) {
    const s = i === 0 ? 0 : (i - 1) * spacing + phase + 1;
    const k = Math.min(0.98, s / ((n + 1) * spacing));
    const r = 2.5 + k * 9;
    const cx = ox + s * 0.42 + Math.sin(t * 1.1 + s * 0.09 + seed) * k * 5;
    const cy = oy - 1 - s * 0.85;
    const rr = Math.round(r), rh = Math.round(r * 0.8);
    const hr = Math.max(1, Math.round(r * 0.5)), hh = Math.max(1, Math.round(r * 0.35));
    g.drawImage(smokeDisc(rr, rh, mix(light, dark, Math.round(k * 12) / 12)), Math.round(cx) - rr, Math.round(cy) - rh);
    g.drawImage(smokeDisc(hr, hh, mix(light, '#ffffff', Math.round((1 - k) * 12) / 12 * 0.15)), Math.round(cx - r * 0.25) - hr, Math.round(cy - r * 0.3) - hh);
  }
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * clamp(strength, 0, 0.7);
  ctx.drawImage(layer, x - ox, y - oy);
  ctx.globalAlpha = alpha;
}

/** Soft light pool / cone (solid contiguous shape, low alpha). */
function lightPool(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: string, a: number) {
  ctx.globalAlpha = a;
  ellipseFill(ctx, x, y, rx, ry, c);
  ctx.globalAlpha = a * 0.7;
  ellipseFill(ctx, x, y, Math.round(rx * 0.55), Math.max(1, Math.round(ry * 0.55)), c);
  ctx.globalAlpha = 1;
}
function lightCone(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string, a: number) {
  ctx.globalAlpha = a;
  polygon(ctx, [[x - 1, y], [x + 1, y], [x + w / 2, y + h], [x - w / 2, y + h]], c);
  ctx.globalAlpha = 1;
}

function spokes(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, ang: number, n: number, c: string) {
  for (let i = 0; i < n; i++) {
    const a = ang + (i * Math.PI * 2) / n;
    pixelLine(ctx, [cx, cy], [cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r)], c);
  }
  R(ctx, cx - 1, cy - 1, 3, 3, INK);
  R(ctx, cx, cy, 1, 1, STEEL[4]);
}

function animateRefinery(ctx: CanvasRenderingContext2D, t: number, active: boolean, lite: boolean, heatBase: number, attention: number) {
  const heat = heatBase + Math.sin(t * 6) * 0.06;
  // furnace mouth fire
  for (let x = 22; x < 34; x++) {
    const h = Math.max(2, Math.min(8, Math.round(3 + (Math.sin(t * 9 + x * 1.3) + 1) * 2 + hash(Math.floor(t * 10) + x) * 2)));
    R(ctx, x, -17 - h, 1, h, mix(WARM[0], WARM[1], clamp((heat - 0.7) / 0.3)));
    R(ctx, x, -17 - Math.ceil(h / 2), 1, Math.ceil(h / 2), WARM[2]);
  }
  R(ctx, 23, -18, 10, 1, WARM[4]);
  lightPool(ctx, 28, -5, 22, 2, WARM[2], 0.35 * heat);
  lightPool(ctx, 28, -30, 12, 4, WARM[1], 0.12 * heat);
  // ladle cycle on the monorail: travel → pour → return
  const cyc = (t % 7) / 7;
  const pos = cyc < 0.3 ? cyc / 0.3 : cyc < 0.65 ? 1 : 1 - (cyc - 0.65) / 0.35;
  const tx = Math.round(56 + pos * 14);
  R(ctx, tx - 3, -46, 7, 3, INK); // trolley riding the beam
  R(ctx, tx - 2, -46, 5, 1, STEEL[3]);
  const pouring = cyc > 0.34 && cyc < 0.62;
  R(ctx, tx, -43, 1, 11, '#2a2e33'); // hoist cable to the bail
  pixelLine(ctx, [tx - 4, -30], [tx, -32], INK);
  pixelLine(ctx, [tx + 4, -30], [tx, -32], INK);
  R(ctx, tx - 5, -30, 11, 8, INK);
  R(ctx, tx - 4, -29, 9, 6, STEEL[1]);
  R(ctx, tx - 4, -29, 9, 1, WARM[2]);
  R(ctx, tx + 5, -29, 3, 2, INK); // spout
  if (pouring) {
    R(ctx, tx + 6, -28, 2, 12, WARM[3]);
    R(ctx, tx + 6, -28, 1, 12, WARM[4]);
  }
  // ingot moulds riding the casting conveyor
  const scroll = (t * 3) % 11;
  for (let i = 0; i < 6; i++) {
    const mx = Math.round(48 + i * 11 - scroll + 11);
    if (mx < 48 || mx > 92) continue;
    const age = clamp((mx - (tx + 4)) / 26);
    const hot = mx <= tx + 8 && mx >= tx + 1 ? 1 : 1 - age;
    R(ctx, mx - 1, -19, 9, 4, INK);
    R(ctx, mx, -18, 7, 2, STEEL[2]);
    R(ctx, mx + 1, -18, 5, 1, mix(STEEL[3], WARM[3], clamp(hot)));
  }
  for (let rx = 49; rx < 97; rx += 4) R(ctx, rx + Math.floor(scroll) % 4, -14, 1, 1, STEEL[4]);
  // smoke & stack beacon
  if (!lite) plume(ctx, 12, -161, t, 1, 0.6, '#b9b2a6', '#5d5853');
  plume(ctx, 90, -135, t + 1.7, 2, lite ? 0.35 : 0.45, '#c9c2b2', '#6e6860');
  const beacon = Math.sin(t * 3) > 0.2;
  R(ctx, 10, -163, 4, 2, INK); // beacon housing on the lip
  R(ctx, 11, -163, 2, 1, beacon ? '#ff5a4a' : '#5a1e18');
  if (beacon) lightPool(ctx, 12, -164, 3, 2, '#ff5a4a', 0.4);
  lightCone(ctx, 132, -19, 16, 13, WARM[3], 0.12);
  // HVAC fan
  spokes(ctx, 114, -61, 3, t * 9, 3, STEEL[4]);
  // annex window life: monitor glow flicker
  R(ctx, 106, -38, 4, 3, Math.sin(t * 13) > 0 ? '#9fe0d6' : '#6fb8b0');
  if (attention > 0.02) {
    ctx.globalAlpha = attention;
    pixelText(ctx, 'REFINERY', 56, -62, WARM[4]);
    lightPool(ctx, 71, -61, 22, 6, WARM[2], 0.12 * attention);
    ctx.globalAlpha = 1;
  }
  void active;
}

function animateForge(ctx: CanvasRenderingContext2D, t: number, active: boolean, lite: boolean, doorOpen: number, attention: number) {
  // hearth fire
  for (let x = 49; x < 57; x++) {
    const h = 2 + Math.round((Math.sin(t * 8 + x) + 1) * 1.5);
    R(ctx, x, -11 - h, 1, h, WARM[1]);
    R(ctx, x, -11 - Math.ceil(h / 2), 1, Math.ceil(h / 2), WARM[3]);
  }
  // welding robot arm: pedestal → elbow → torch on the bench workpiece
  const sw = Math.sin(t * 1.4);
  const elbow: Point = [31 + Math.round(sw * 2), -24];
  const tip: Point = [37 + Math.round(sw * 3), -25];
  pixelLine(ctx, [29, -12], elbow, INK, 3);
  pixelLine(ctx, [29, -12], elbow, YELLOW);
  pixelLine(ctx, elbow, tip, INK, 2);
  R(ctx, elbow[0] - 1, elbow[1] - 1, 3, 3, INK);
  const arcCycle = (t % 2.4) < 1.3 ? 1 : 0;
  const arc = Math.max(arcCycle, attention);
  if (arc > 0.05) {
    ctx.globalAlpha = arc;
    R(ctx, tip[0], tip[1], 2, 2, '#f2fbff');
    for (let i = 0; i < (lite ? 2 : 4); i++) {
      const a = -0.4 - i * 0.6 + Math.sin(t * 20 + i) * 0.3;
      const l = 2 + ((t * 30 + i * 7) % 4);
      pixelLine(ctx, tip, [tip[0] + Math.round(Math.cos(a) * l), tip[1] + Math.round(Math.sin(a) * l)], '#ffe6a0');
    }
    lightPool(ctx, tip[0], -7, 14, 2, '#bfe8f0', 0.3 * arc);
    ctx.globalAlpha = 1;
  }
  // Roll-up door eases toward its target; entering/leaving never snaps it.
  const doorH = Math.round((1 - doorOpen) * 42);
  for (let y = 0; y < doorH; y++) R(ctx, 14, -48 + y, 48, 1, y % 3 === 2 ? TEAL[0] : y % 3 === 0 ? TEAL[3] : TEAL[2]);
  if (doorH > 0) { R(ctx, 14, -48 + doorH, 48, 2, INK); R(ctx, 36, -48 + doorH, 4, 1, STEEL[4]); }
  // hoist trolley, cable and crate load over the dock
  const trolley = Math.round(-14 + (Math.sin(t * 0.5) + 1) * 7);
  const drop = Math.round(18 + (Math.sin(t * 0.8) + 1) * 4);
  const swing = Math.round(Math.sin(t * 1.7) * 1.5);
  R(ctx, trolley - 3, -56, 7, 3, INK);
  R(ctx, trolley - 2, -56, 5, 1, STEEL[3]);
  pixelLine(ctx, [trolley, -53], [trolley + swing, -53 + drop], '#2a2e33');
  const ly = -53 + drop;
  R(ctx, trolley + swing - 1, ly, 3, 2, INK); // hook
  pixelLine(ctx, [trolley + swing, ly + 1], [trolley + swing - 4, ly + 4], INK);
  pixelLine(ctx, [trolley + swing, ly + 1], [trolley + swing + 4, ly + 4], INK);
  box(ctx, trolley + swing - 5, ly + 5, 11, 7, RUST);
  R(ctx, trolley + swing - 4, ly + 8, 9, 1, RUST[1]);
  // compressor flywheel
  spokes(ctx, 95, -22, 3, t * 8, 4, STEEL[4]);
  // window fire glow & chimney smoke
  R(ctx, 113, -30, 20, 2, Math.sin(t * 7) > 0 ? WARM[2] : WARM[1]);
  plume(ctx, 130, -116, t, 3, lite ? 0.35 : 0.5, '#bdb6aa', '#5a554f');
  lightCone(ctx, 60, -41, 26, 34, WARM[3], 0.1);
  if (attention > 0.02) {
    ctx.globalAlpha = attention;
    pixelText(ctx, 'DRILL FORGE', 33, -68, '#e8fbfa');
    ctx.globalAlpha = 1;
  }
  void active;
}

function animateRepair(ctx: CanvasRenderingContext2D, t: number, active: boolean, lift: number, attention: number) {
  const py = Math.round(-12 - lift * 18);
  pixelLine(ctx, [15, -10], [35, py + 2], INK, 2);
  pixelLine(ctx, [35, -10], [15, py + 2], INK, 2);
  pixelLine(ctx, [15, -10], [35, py + 2], STEEL[3]);
  pixelLine(ctx, [35, -10], [15, py + 2], STEEL[3]);
  R(ctx, 12, py - 1, 26, 4, INK);
  R(ctx, 13, py, 24, 2, '#c8a23c');
  R(ctx, 13, py, 24, 1, '#e8c860');
  const flick = Math.sin(t * 23) > -0.95 ? '#e8f4e6' : '#9fb3a6';
  R(ctx, 15, -40, 20, 1, flick);
  lightCone(ctx, 25, -39, 34, 30, '#dff5e2', 0.08);
  const pulse = 0.55 + 0.45 * Math.sin(t * 3);
  const crossC = mix('#2f5e3c', '#9cf0b0', Math.max(pulse, attention));
  R(ctx, 86, -43, 2, 8, crossC);
  R(ctx, 83, -40, 8, 2, crossC);
  lightPool(ctx, 87, -39, 9, 7, '#7fe39a', 0.12 * pulse);
  const bars = Math.floor(t * 2) % 4;
  for (let i = 0; i < 3; i++) R(ctx, 104, -34 + i, 2 + (i < bars ? 1 : 0), 1, i < bars ? '#7fe39a' : '#24402c');
  R(ctx, 104, -40, 2, 2, Math.sin(t * 4) > 0 ? '#7fe39a' : '#24402c');
  void active;
}

function animateShaft(ctx: CanvasRenderingContext2D, t: number) {
  const rot = t * 1.2;
  spokes(ctx, 64, -152, 12, rot, 6, STEEL[3]);
  spokes(ctx, 100, -147, 7, -rot * 1.6, 4, STEEL[3]);
  // cage and counter-moving skip on their ropes
  const k = (Math.sin(t * 0.25) + 1) / 2;
  const cageTop = Math.round(-38 + k * 150);
  const skipTop = Math.round(-38 + (1 - k) * 150);
  R(ctx, 49, -152, 1, cageTop + 152 - 4, '#2a2e33');
  pixelLine(ctx, [49, cageTop - 4], [38, cageTop], INK);
  pixelLine(ctx, [49, cageTop - 4], [60, cageTop], INK);
  R(ctx, 35, cageTop, 29, 24, INK);
  R(ctx, 36, cageTop + 1, 27, 22, '#1c2228');
  for (let bx = 38; bx < 62; bx += 4) R(ctx, bx, cageTop + 1, 1, 22, STEEL[2]);
  R(ctx, 36, cageTop + 1, 27, 2, STEEL[3]);
  R(ctx, 36, cageTop + 21, 27, 2, STEEL[3]);
  R(ctx, 48, cageTop + 4, 3, 2, WARM[3]);
  R(ctx, 91, -147, 1, skipTop + 147 - 3, '#2a2e33');
  pixelLine(ctx, [91, skipTop - 3], [86, skipTop], INK);
  pixelLine(ctx, [91, skipTop - 3], [97, skipTop], INK);
  polygon(ctx, [[84, skipTop], [99, skipTop], [97, skipTop + 16], [86, skipTop + 16]], INK);
  polygon(ctx, [[85, skipTop + 1], [98, skipTop + 1], [96, skipTop + 15], [87, skipTop + 15]], RUST[2]);
  R(ctx, 86, skipTop + 1, 11, 2, '#4a3f38');
  // winch drum turning
  const off = Math.floor(t * 6) % 3;
  for (let y = -26 + off; y < -19; y += 3) R(ctx, 148, y, 8, 1, STEEL[3]);
  const on = Math.sin(t * 2.6) > 0;
  R(ctx, 121, -154, 4, 2, on ? '#ff5a4a' : '#5a1e18');
  if (on) lightPool(ctx, 123, -154, 4, 3, '#ff5a4a', 0.35);
}

function animateHabitat(ctx: CanvasRenderingContext2D, t: number, open: number) {
  const h = Math.round((1 - clamp(open)) * 52);
  for (let y = 0; y < h; y++) R(ctx, 50, -58 + y, 36, 1, y % 6 === 0 ? STEEL[1] : y % 6 === 1 ? STEEL[3] : STEEL[2]);
  if (h > 0) {
    R(ctx, 50, -58 + h - 1, 36, 2, INK);
    R(ctx, 64, -58 + Math.max(0, h - 12), 8, 4, YELLOW);
  }
  lightPool(ctx, 68, -4, 24, 3, WARM[2], 0.25 * clamp(open));
  plume(ctx, 105, -101, t, 4, 0.38, '#c3bcae', '#66605a');
  for (let i = 0; i < 9; i++) { // bulbs on the arch rim
    const a = Math.PI * (1.08 + (i / 8) * 0.84);
    const bx = Math.round(70 + Math.cos(a) * 71);
    const by = Math.round(-8 + Math.sin(a) * 73);
    R(ctx, bx, by, 2, 2, (Math.sin(t * 2 + i) > -0.6) ? '#ffd889' : '#8a6a3a');
  }
}

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  kind: BuildingKind,
  x: number,
  ground: number,
  t: number,
  options: BuildingOptions = {}
) {
  const tier = Math.floor(clamp(options.tier ?? 1, 0, 3));
  const sprite = buildingSprite(kind, kind === 'shaft' || kind === 'habitat' ? 0 : tier);
  const lite = !!options.lite;
  const active = !!options.active;
  const id = options.id ?? `${kind}:${Math.round(x)}:${Math.round(ground)}`;
  const idleDoor = kind === 'forge' ? 0.66 : 1;
  const { s: st, easeTo } = motionState(id, t, active, active ? 1 : (options.door ?? idleDoor));
  // Service lift: autonomous cycle when idle, smooth approach to raised when active.
  const idleLift = (Math.sin(t * 0.7) + 1) / 2;
  st.lift = easeTo(st.lift, active ? 0.96 : idleLift, active ? 3.5 : 1.6);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(ground));
  const s = Math.max(1, Math.round(options.scale ?? 1)); // integer scaling only — keeps pixels square
  if (s !== 1) ctx.scale(s, s);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, -AX, -AY);
  if (kind === 'refinery') animateRefinery(ctx, t, active, lite, st.heat, st.attention);
  else if (kind === 'forge') animateForge(ctx, t, active, lite, st.door, st.attention);
  else if (kind === 'repair') animateRepair(ctx, t, active, st.lift, st.attention);
  else if (kind === 'shaft') animateShaft(ctx, t);
  else animateHabitat(ctx, t, st.door);
  ctx.restore();
}

/** Used by tests: static footprint anchor so a sprite can be drawn unanimated. */
export const BUILDING_ANCHOR = { x: AX, y: AY, w: CANVAS_W, h: CANVAS_H };
