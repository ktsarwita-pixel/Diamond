/* ================================================================== *
 *  CINE KIT — shared high-end FX for the remastered story cutscenes.
 *  Procedural noise, per-pixel painters, soft light blobs, smoke puffs,
 *  plasma sheaths, heat shimmer and faceted crystals.
 * ================================================================== */
import { CH, CW, INK, R, clamp, hash, rgba } from './cutsceneArt';
import { isLite, qn } from './quality';
import { cacheGet, cacheSet } from './spriteCache';

export type RGB3 = [number, number, number];

const hex3Cache = new Map<string, RGB3>();
/** Parses `#rrggbb` once per distinct colour (builders call this per pixel). */
export function hex3(hex: string): RGB3 {
  let c = hex3Cache.get(hex);
  if (c) return c;
  const h = hex.replace('#', '');
  c = [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
  hex3Cache.set(hex, c);
  return c;
}
export function lerp3(a: RGB3, b: RGB3, t: number): RGB3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/* ------------------------------ noise ------------------------------ */
export interface Noise {
  noise: (x: number, y: number) => number;
  fbm: (x: number, y: number, oct?: number, gain?: number) => number;
  ridged: (x: number, y: number, oct?: number) => number;
}

export function makeNoise(seed: number): Noise {
  let s = (seed * 9301 + 49297) % 233280;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const v = new Float32Array(256);
  for (let i = 0; i < 256; i++) v[i] = rnd();
  const lat = (x: number, y: number) => v[p[(p[x & 255] + y) & 255]];
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const w = yf * yf * (3 - 2 * yf);
    const a = lat(xi, yi);
    const b = lat(xi + 1, yi);
    const c = lat(xi, yi + 1);
    const d = lat(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  const fbm = (x: number, y: number, oct = 4, gain = 0.5) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * noise(x * f + i * 17.3, y * f + i * 31.7);
      norm += amp;
      amp *= gain;
      f *= 2.03;
    }
    return sum / norm;
  };
  const ridged = (x: number, y: number, oct = 4) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(noise(x * f + i * 7.1, y * f + i * 3.9) * 2 - 1);
      sum += amp * n * n;
      norm += amp;
      amp *= 0.5;
      f *= 2.1;
    }
    return sum / norm;
  };
  return { noise, fbm, ridged };
}

/** Worley/cellular noise: returns F2 - F1 (small values = cell borders / cracks). */
export function cellEdge(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox;
      const cy = yi + oy;
      const px = cx + hash(cx * 12.9898 + cy * 78.233 + seed);
      const py = cy + hash(cx * 39.346 + cy * 11.135 + seed * 1.7);
      const dx = px - x;
      const dy = py - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) f2 = d;
    }
  }
  return f2 - f1;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5;

/** Quantize a 0..1 light value into bands with ordered dithering (pixel-art finish). */
export function band(v: number, levels: number, x: number, y: number) {
  return clamp(Math.round(v * levels + bayer(x, y) * 0.9) / levels);
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/**
 * Paint every pixel of a canvas with a shader-like callback.
 * Yields on a *time* basis (~1.6 ms of work per step) so a background build
 * can always be interrupted inside the frame budget, regardless of how
 * expensive the per-pixel callback is.
 */
const STEP_MS = 0.9;
/** Cooperative time-slice helper for hand-written build loops. */
export function sliceTimer() {
  let start = performance.now();
  return {
    due() {
      if (performance.now() - start > STEP_MS) {
        start = performance.now();
        return true;
      }
      return false;
    },
  };
}
export function* paintPixelsGen(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  fn: (x: number, y: number, out: number[]) => void
): Generator<void, void, unknown> {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  w = Math.round(w);
  h = Math.round(h);
  if (w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x0, y0, w, h);
  const d = img.data;
  const out = [0, 0, 0, 255];
  let sliceStart = performance.now();
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = row + x * 4;
      out[0] = d[i];
      out[1] = d[i + 1];
      out[2] = d[i + 2];
      out[3] = d[i + 3];
      fn(x + x0, y + y0, out);
      const oa255 = out[3];
      if (oa255 >= 255) {
        d[i] = out[0];
        d[i + 1] = out[1];
        d[i + 2] = out[2];
        d[i + 3] = 255;
      } else if (oa255 > 0) {
        const a = oa255 / 255;
        const da = d[i + 3] / 255;
        const oa = a + da * (1 - a);
        const inv = da * (1 - a);
        d[i] = (out[0] * a + d[i] * inv) / oa;
        d[i + 1] = (out[1] * a + d[i + 1] * inv) / oa;
        d[i + 2] = (out[2] * a + d[i + 2] * inv) / oa;
        d[i + 3] = oa * 255;
      }
    }
    if (performance.now() - sliceStart > STEP_MS) {
      yield;
      sliceStart = performance.now();
    }
  }
  ctx.putImageData(img, x0, y0);
}

export function paintPixels(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  fn: (x: number, y: number, out: number[]) => void
) {
  const g = paintPixelsGen(ctx, x0, y0, w, h, fn);
  while (!g.next().done) {
    /* run to completion */
  }
}

/* ------------------------------ background build jobs ------------------------------ */
/**
 * A resumable asset build. Builds are stepped a few milliseconds per frame by
 * `pumpWarm`; `get()` is only a last resort that finishes synchronously.
 * Use `ready` + `peek()` inside render loops so a frame never stalls.
 */
export class Job<T> {
  private it: Generator<unknown, T, unknown> | null = null;
  private val: T | null = null;
  /** Higher priority jobs are pumped first (set by prepareScene for current/next scene). */
  priority = 0;
  constructor(private make: () => Generator<unknown, T, unknown>) {
    warmQueue.push(this as Job<unknown>);
  }
  get done() {
    return this.val !== null;
  }
  get ready() {
    return this.val !== null;
  }
  /** Returns the asset if finished, otherwise null (never blocks). */
  peek(): T | null {
    return this.val;
  }
  /** Finishes the build synchronously. Avoid on hot paths. */
  get(): T {
    if (this.val !== null) return this.val;
    if (!this.it) this.it = this.make();
    let r = this.it.next();
    while (!r.done) r = this.it.next();
    this.val = r.value;
    return this.val;
  }
  step(deadline: number): boolean {
    if (this.val !== null) return true;
    if (!this.it) this.it = this.make();
    do {
      const r = this.it.next();
      if (r.done) {
        this.val = r.value;
        return true;
      }
    } while (performance.now() < deadline);
    return false;
  }
}
const warmQueue: Job<unknown>[] = [];
/** Advance pending builds, highest priority first, for at most `budgetMs`. */
export function pumpWarm(budgetMs: number) {
  const deadline = performance.now() + budgetMs;
  const pending = warmQueue.filter((j) => !j.done);
  if (pending.length === 0) return;
  pending.sort((a, b) => b.priority - a.priority);
  for (const job of pending) {
    if (!job.step(deadline)) return;
  }
}
/** True when every registered build has finished. */
export function warmComplete() {
  return warmQueue.every((j) => j.done);
}
/** Diagnostics for tests/benchmarks (counts of registered vs finished builds). */
export function warmStatus() {
  return { total: warmQueue.length, done: warmQueue.filter((j) => j.done).length };
}
declare global {
  interface Window { __storyWarm?: () => { total: number; done: number } }
}
if (typeof window !== 'undefined') window.__storyWarm = warmStatus;

/* ------------------------------ soft light blobs ------------------------------ */
const blobCache = new Map<string, HTMLCanvasElement>();
export function blob(color: string): HTMLCanvasElement {
  let c = cacheGet(blobCache, color);
  if (c) return c;
  const [canvas, ctx] = makeCanvas(64, 64);
  const image = ctx.createImageData(64, 64), data = image.data;
  const col = hex3(color);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const d = Math.hypot(x - 32, y - 32) / 32;
    if (d >= 1) continue;
    const i = (y * 64 + x) * 4;
    data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2];
    data[i + 3] = Math.round(clamp(Math.floor((1 - d) ** 2 * 9 + bayer(x, y) + 0.5) / 9) * 255);
  }
  ctx.putImageData(image, 0, 0);
  cacheSet(blobCache, color, canvas, 64);
  c = canvas;
  return c;
}

export function drawBlob(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, a: number, additive = true) {
  if (a <= 0.003 || r <= 0.5) return;
  const prevOp = ctx.globalCompositeOperation;
  const prevA = ctx.globalAlpha;
  if (additive) ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = prevA * Math.min(1, a);
  ctx.drawImage(blob(color), Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}

/* ------------------------------ smoke / dust puffs ------------------------------ */
const puffCache = new Map<string, HTMLCanvasElement>();
/** Textured, top-lit volumetric puff (pixel-dithered edges). */
export function puff(seed: number, light: string, dark: string): HTMLCanvasElement {
  const key = `${seed}-${light}-${dark}`;
  const hit = cacheGet(puffCache, key);
  if (hit) return hit;
  const S = 48;
  const [c, ctx] = makeCanvas(S, S);
  const image = ctx.createImageData(S, S), data = image.data;
  const n = makeNoise(seed * 13 + 7);
  const L = hex3(light);
  const D = hex3(dark);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const dx = (x - S / 2) / (S / 2);
    const dy = (y - S / 2) / (S / 2);
    const r = Math.sqrt(dx * dx + dy * dy);
    const lump = n.fbm(x * 0.09, y * 0.09, 3);
    const edge = 1 - r + (lump - 0.5) * 0.7;
    if (edge <= 0) continue;
    const alpha = clamp(edge * 2.4);
    if (alpha + bayer(x, y) * 0.5 < 0.25) continue;
    // top-left lit, bottom-right shadowed
    const lit = clamp(0.62 - dy * 0.55 - dx * 0.15 + (lump - 0.5) * 0.6);
    const col = lerp3(D, L, band(lit, 5, x, y));
    data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2];
    data[i + 3] = Math.round(clamp(alpha) * 255);
  }
  ctx.putImageData(image, 0, 0);
  cacheSet(puffCache, key, c, 160);
  return c;
}

export function drawPuff(
  ctx: CanvasRenderingContext2D,
  seed: number,
  light: string,
  dark: string,
  x: number,
  y: number,
  size: number,
  alpha: number
) {
  if (alpha <= 0.01 || size < 1) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, alpha);
  ctx.drawImage(puff(seed % 6, light, dark), Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
  ctx.globalAlpha = prev;
}

/* ------------------------------ plasma sheath ------------------------------ */
/**
 * Turbulent ionised fire wake streaming *behind* a falling object.
 * `ang` is the velocity direction angle (0 = straight down, + = toward +x).
 */
export function plasmaWake(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, heat: number, t: number, R0: number) {
  if (heat <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-ang);
  const L = R0 * (3.2 + heat * 7.5);
  const N = qn(42, 0.35);
  const flick = 0.88 + 0.12 * Math.sin(t * 47);
  for (let i = N - 1; i >= 0; i--) {
    const k = i / N;
    const wob = Math.sin(t * 9 + i * 0.8) * R0 * 0.16 * k + Math.sin(t * 23 + i * 1.9) * R0 * 0.07 * k;
    const wy = -k * L;
    const r = R0 * (0.75 + k * 1.9) * (0.86 + 0.14 * Math.sin(t * 31 + i * 2.3));
    const col = k < 0.1 ? '#fff6dc' : k < 0.26 ? '#ffd27a' : k < 0.48 ? '#ff8a2a' : k < 0.72 ? '#e2452a' : '#6b2a5e';
    drawBlob(ctx, col, wob, wy, r, heat * (1 - k) * 0.42 * flick);
  }
  // Ionisation streamers peeling off the sheath shoulders
  ctx.globalCompositeOperation = 'lighter';
  for (let s = 0; s < qn(12, 0.34); s++) {
    const side = s % 2 ? 1 : -1;
    const x0 = side * R0 * (0.55 + hash(s) * 0.5);
    const len = L * (0.35 + hash(s + 9) * 0.55);
    const sway = Math.sin(t * 7 + s) * R0 * 0.35;
    const grad = ctx.createLinearGradient(x0, 0, x0 * 1.8 + sway, -len);
    grad.addColorStop(0, rgba('#fff3c4', 0.55 * heat));
    grad.addColorStop(0.4, rgba('#ff9b3d', 0.3 * heat));
    grad.addColorStop(1, rgba('#c2410c', 0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1 + (s % 3);
    ctx.beginPath();
    ctx.moveTo(x0, R0 * 0.35);
    ctx.quadraticCurveTo(x0 * 1.5, -len * 0.4, x0 * 1.9 + sway, -len);
    ctx.stroke();
  }
  ctx.restore();
}

/** Bright shock cap and parabolic bow-shock shells *ahead* of the falling object. */
export function plasmaFront(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, heat: number, t: number, R0: number) {
  if (heat <= 0.02) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-ang);
  const flick = 0.85 + 0.15 * Math.sin(t * 53);
  drawBlob(ctx, '#ffffff', 0, R0 * 0.85, R0 * 0.95, 0.55 * heat * flick);
  drawBlob(ctx, '#ffd9a0', 0, R0 * 0.6, R0 * 1.8, 0.5 * heat);
  drawBlob(ctx, '#ff7a26', 0, R0 * 0.2, R0 * 2.8, 0.32 * heat);
  ctx.globalCompositeOperation = 'lighter';
  for (let shell = 0; shell < 3; shell++) {
    const front = R0 * (1.02 + shell * 0.22);
    const k = R0 * (1.25 + shell * 0.75);
    const limit = R0 * 1.62;
    for (let x0 = -limit; x0 < limit; x0 += 4) {
      const x1 = Math.min(limit, x0 + 4);
      const y0 = front - x0 * x0 / k + Math.sin(x0 * 0.3 + t * 30) * 0.35;
      const y1 = front - x1 * x1 / k + Math.sin(x1 * 0.3 + t * 30) * 0.35;
      const edge = Math.sqrt(clamp(1 - Math.abs((x0 + x1) / 2) / limit));
      ctx.strokeStyle = rgba(shell === 0 ? '#fff5dc' : shell === 1 ? '#ffbd70' : '#c49cbb',
        edge * heat * (shell === 0 ? 0.68 : shell === 1 ? 0.35 : 0.17));
      ctx.lineWidth = shell === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ------------------------------ heat shimmer ------------------------------ */
/** Displaces horizontal scanlines of what's already on the canvas (refraction look). */
let heatSource: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;
export function heatShimmer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, amp: number) {
  if (amp < 0.2 || isLite()) return;
  // Map the requested logical region through the active camera/shake transform.
  // Resetting to identity before measuring used to shimmer the wrong pixels.
  const m = ctx.getTransform();
  const ax = m.a * x + m.c * y + m.e, ay = m.b * x + m.d * y + m.f;
  const bx = m.a * (x + w) + m.c * (y + h) + m.e, by = m.b * (x + w) + m.d * (y + h) + m.f;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx))), y0 = Math.max(0, Math.floor(Math.min(ay, by)));
  const x1 = Math.min(ctx.canvas.width, Math.ceil(Math.max(ax, bx))), y1 = Math.min(ctx.canvas.height, Math.ceil(Math.max(ay, by)));
  const ww = x1 - x0, hh = y1 - y0;
  if (ww <= 4 || hh <= 2) return;
  const pixelScale = Math.max(1, Math.hypot(m.a, m.b));
  if (!heatSource) heatSource = makeCanvas(ww, hh);
  const [source, g] = heatSource;
  if (source.width < ww || source.height < hh) {
    source.width = Math.max(source.width, ww); source.height = Math.max(source.height, hh);
    g.imageSmoothingEnabled = false;
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  // One snapshot, rather than repeatedly reading the destination canvas. Besides
  // avoiding read/write stalls, every displaced line uses the original image.
  g.drawImage(ctx.canvas, x0, y0, ww, hh, 0, 0, ww, hh);
  for (let yy = 0; yy < hh - 2; yy += 2) {
    const edge = Math.sin((yy / hh) * Math.PI);
    const off = Math.round((Math.sin((yy + y0) * 0.37 + t * 21) + Math.sin((yy + y0) * 0.11 - t * 9) * 0.5) * amp * edge * pixelScale);
    if (off !== 0) ctx.drawImage(source, 0, yy, ww, 2, x0 + off, y0 + yy, ww, 2);
  }
  ctx.restore();
}

/* ------------------------------ faceted crystal ------------------------------ */
/** Gem-like crystal prism with lit facets, inner glow & specular edge. */
export function gem(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  w: number,
  h: number,
  color: string,
  tilt = 0,
  glow = 0
) {
  const c = hex3(color);
  const toHex = (v: RGB3) => `rgb(${v[0] | 0},${v[1] | 0},${v[2] | 0})`;
  const dark = toHex(lerp3(c, [10, 6, 14], 0.62));
  const mid = toHex(c);
  const lite = toHex(lerp3(c, [255, 255, 255], 0.38));
  const spec = toHex(lerp3(c, [255, 255, 255], 0.78));
  ctx.save();
  ctx.translate(x, base);
  ctx.rotate(tilt);
  const hw = w / 2;
  const shoulder = -h + w * 0.7;
  // outline
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-hw - 1.5, 1);
  ctx.lineTo(-hw - 1.5, shoulder);
  ctx.lineTo(0, -h - 2);
  ctx.lineTo(hw + 1.5, shoulder);
  ctx.lineTo(hw + 1.5, 1);
  ctx.closePath();
  ctx.fill();
  // left (lit) face
  ctx.fillStyle = lite;
  ctx.beginPath();
  ctx.moveTo(-hw, 0);
  ctx.lineTo(-hw, shoulder);
  ctx.lineTo(0, -h);
  ctx.lineTo(-hw * 0.15, 0);
  ctx.closePath();
  ctx.fill();
  // center face
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.15, 0);
  ctx.lineTo(0, -h);
  ctx.lineTo(hw * 0.45, shoulder);
  ctx.lineTo(hw * 0.45, 0);
  ctx.closePath();
  ctx.fill();
  // right (shadow) face
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(hw * 0.45, 0);
  ctx.lineTo(hw * 0.45, shoulder);
  ctx.lineTo(0, -h);
  ctx.lineTo(hw, shoulder);
  ctx.lineTo(hw, 0);
  ctx.closePath();
  ctx.fill();
  // inner refraction streaks & specular edge
  ctx.fillStyle = spec;
  ctx.fillRect(-hw + 1, shoulder + 2, 1, Math.max(1, -shoulder - 4));
  ctx.globalAlpha = 0.5;
  ctx.fillRect(-hw * 0.1, -h * 0.55, 1, h * 0.3);
  ctx.globalAlpha = 1;
  ctx.restore();
  if (glow > 0) drawBlob(ctx, color, x, base - h * 0.5, Math.max(w, h) * 0.9, glow);
}

/* ------------------------------ text helpers ------------------------------ */
export function sign(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 7) {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0b0910';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

export function bar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, fraction: number, color: string) {
  R(ctx, x, y, width, 7, INK);
  R(ctx, x + 2, y + 2, width - 4, 3, '#272338');
  R(ctx, x + 2, y + 2, (width - 4) * clamp(fraction), 3, color);
  for (let tick = x + 13; tick < x + width - 3; tick += 14) R(ctx, tick, y + 2, 1, 3, '#161220');
}

/** Cinematic letterbox-friendly HUD panel. */
export function hudPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string) {
  R(ctx, x, y, w, h, 'rgba(9,8,15,0.86)');
  R(ctx, x, y, w, 2, accent);
  R(ctx, x, y + h - 1, w, 1, rgba(accent, 0.35));
  R(ctx, x, y, 2, 6, accent);
  R(ctx, x + w - 2, y, 2, 6, accent);
}

/** Anamorphic grade: subtle colour wash + vignette + top/bottom bars. */
const vignetteCache = new Map<string, HTMLCanvasElement>();
function vignetteSprite(color: string, a: number, cx: number, cy: number, r0: number, r1: number) {
  const key = `${color}:${a.toFixed(2)}:${cx}:${cy}:${r0}:${r1}`;
  let v = cacheGet(vignetteCache, key);
  if (!v) {
    v = document.createElement('canvas');
    v.width = CW;
    v.height = CH;
    const g = v.getContext('2d')!;
    const grad = g.createRadialGradient(cx, cy, r0, cx, cy, r1);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, rgba(color, a));
    g.fillStyle = grad;
    g.fillRect(0, 0, CW, CH);
    cacheSet(vignetteCache, key, v, 48);
  }
  return v;
}
export { vignetteSprite };

/** Anamorphic grade: subtle colour wash + cached vignette. Lite mode skips the soft-light wash. */
export function grade(ctx: CanvasRenderingContext2D, wash: string, washA: number, vignette: string, vigA: number) {
  ctx.save();
  // Respect the 2x Lite render scale instead of clipping a full-size vignette.
  const sx = ctx.canvas.width / CW;
  const sy = ctx.canvas.height / CH;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  if (washA > 0 && !isLite()) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = rgba(wash, washA);
    ctx.fillRect(0, 0, CW, CH);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(vignetteSprite(vignette, Math.round(vigA * 50) / 50, CW / 2, Math.round(CH * 0.48), 70, 430), 0, 0, CW, CH);
  ctx.restore();
}

/** Deterministic, band-limited shake; respects the user's reduced-motion setting. */
const reducedMotion = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export function shake(t: number, amp: number): [number, number] {
  if (amp <= 0 || reducedMotion?.matches) return [0, 0];
  // Band-limited, continuous shake avoids random one-frame teleportation. The
  // envelope still controls intensity; rounding happens at the pixel boundary.
  return [
    Math.round((Math.sin(t * 73) + Math.sin(t * 113) * 0.45) * amp * 0.68),
    Math.round((Math.sin(t * 89 + 1.7) + Math.sin(t * 127) * 0.35) * amp * 0.6),
  ];
}
