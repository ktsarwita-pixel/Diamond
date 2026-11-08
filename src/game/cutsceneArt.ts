/* ================================================================== *
 *  CUTSCENE ART KIT — 100% procedural pixel art, no images.
 *  Everything is built from pixels and cached as custom sprites.
 * ================================================================== */

export const CW = 640;
export const CH = 360;

export type RGB = [number, number, number];
export type Palette = { ink: string; light: string; mid: string; dark: string; deep: string; glow: string };

export const INK = '#07050c';
import { cacheGet, cacheSet } from './spriteCache';

/* ------------------------------ helpers ------------------------------ */
export function R(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  // Round edges, not position and width independently: adjacent animated panels
  // must not open a one-pixel seam when their fractional coordinates change.
  const left = Math.round(x), top = Math.round(y);
  const right = Math.round(x + w), bottom = Math.round(y + h);
  if (right > left && bottom > top) ctx.fillRect(left, top, right - left, bottom - top);
}

const rgbCache = new Map<string, RGB>();
export function hexToRgb(hex: string): RGB {
  const cached = rgbCache.get(hex);
  if (cached) return cached;
  const h = hex.replace('#', '');
  const rgb: RGB = [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
  if (rgbCache.size > 512) rgbCache.clear();
  rgbCache.set(hex, rgb);
  return rgb;
}
export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
const shadeCache = new Map<string, string>();
export function shade(hex: string, amount: number): string {
  const value = Math.round(amount * 100) / 100;
  const key = `${hex}:${value}`;
  const cached = shadeCache.get(key);
  if (cached) return cached;
  const out = value >= 0 ? mix(hex, '#ffffff', value) : mix(hex, '#000000', -value);
  if (shadeCache.size > 2048) shadeCache.clear();
  shadeCache.set(key, out);
  return out;
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// 4x4 ordered Bayer matrix for authentic pixel-art dithering
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function ditherAt(x: number, y: number, threshold: number): boolean {
  const b = BAYER[(y & 3) * 4 + (x & 3)] / 16;
  return b < threshold;
}

const skyCache = new Map<string, HTMLCanvasElement>();

/** Builds (or reuses) a cached dithered sky canvas. */
export function skyCanvas(stops: Array<[number, string]>, w = CW, h = CH): HTMLCanvasElement {
  const key = `${stops.map((s) => s.join(':')).join('|')}_${w}x${h}`;
  const hit = skyCache.get(key);
  if (hit) return hit;
  const sprite = document.createElement('canvas');
  sprite.width = Math.max(1, Math.round(w));
  sprite.height = Math.max(1, Math.round(h));
  const sctx = sprite.getContext('2d')!;
  sctx.imageSmoothingEnabled = false;
  paintSkyRaw(sctx, stops, 0, h, 0, w);
  // Keep the cache bounded so dynamically colored skies can never leak
  cacheSet(skyCache, key, sprite, 24);
  return sprite;
}

/** Vertical multi-stop sky built from dithered color bands — cached, then blitted. */
export function paintSky(ctx: CanvasRenderingContext2D, stops: Array<[number, string]>, y0 = 0, h = CH, x0 = 0, w = CW) {
  ctx.drawImage(skyCanvas(stops, w, h), x0, y0);
}

function paintSkyRaw(ctx: CanvasRenderingContext2D, stops: Array<[number, string]>, y0: number, h: number, x0: number, w: number) {
  for (let y = 0; y < h; y++) {
    const k = y / Math.max(1, h - 1);
    let i = 0;
    while (i < stops.length - 2 && k > stops[i + 1][0]) i++;
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    const local = clamp((k - p0) / Math.max(0.0001, p1 - p0));
    R(ctx, x0, y0 + y, w, 1, c0);
    // Dither the transition band for a chunky retro finish
    if (local > 0.72) {
      for (let x = ((y0 + y) & 3) % 4; x < w; x += 4) {
        if (ditherAt(x, y + y0, (local - 0.72) / 0.28)) R(ctx, x0 + x, y0 + y, 1, 1, c1);
      }
    }
  }
}

const cache = new Map<string, HTMLCanvasElement>();
function cached(key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = cacheGet(cache, key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  paint(ctx);
  cacheSet(cache, key, c, 256);
  return c;
}

/* ------------------------------ clouds ------------------------------ */
/** Metablob pixel cloud, shaded with dithered light and shadow. */
export function cloudSprite(seed: number, w: number, h: number, light: string, mid: string, dark: string): HTMLCanvasElement {
  return cached(`cloud-v3-${seed}-${w}-${h}-${light}-${mid}-${dark}`, w, h, (ctx) => {
    const lobes = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8, arch = Math.sin(t * Math.PI);
      return {
        cx: w * (0.12 + t * 0.76 + (hash(seed + i * 3) - 0.5) * 0.04),
        cy: h * (0.64 - arch * 0.24 + (hash(seed + i * 5) - 0.5) * 0.08),
        rx: w * (0.11 + arch * 0.07 + hash(seed + i * 7) * 0.03),
        ry: h * (0.22 + arch * 0.18 + hash(seed + i * 11) * 0.08),
      };
    });
    const colors = [mid, shade(light, 0.35), light, shade(dark, -0.18), dark,
      mix(mid, light, 0.55), mix(mid, dark, 0.55)].map(hexToRgb);
    // One bulk upload, not a Canvas draw call for every cloud pixel. This also
    // makes cold scene changes and the first plasma/cloud pass much cheaper.
    const image = ctx.createImageData(w, h), data = image.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let inside = false, minNorm = 99, topDist = 99;
      for (const l of lobes) {
        const dx = (x - l.cx) / l.rx, dy = (y - l.cy) / l.ry;
        const d = dx * dx + dy * dy;
        if (d < 1 && d < minNorm) {
          inside = true; minNorm = d;
          topDist = (y - (l.cy - l.ry)) / (l.ry * 2);
        }
      }
      if (!inside) continue;
      const rel = y / h;
      let index = 0;
      if (topDist < 0.16 && rel < 0.52) index = 1;
      else if (topDist < 0.36 && rel < 0.62) index = 2;
      else if (rel > 0.78) index = 3;
      else if (rel > 0.62) index = 4;
      if (ditherAt(x, y, 0.45)) {
        if (topDist >= 0.32 && topDist < 0.48) index = 5;
        else if (rel > 0.54 && rel <= 0.66) index = 6;
      }
      const col = colors[index], i = (y * w + x) * 4;
      data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  });
}

export function cloudBank(ctx: CanvasRenderingContext2D, t: number, y: number, scale: number, palette: [string, string, string], speed = 6, seed = 1, count = 6) {
  const span = CW + 160 * scale;
  for (let i = 0; i < count; i++) {
    const spr = cloudSprite(seed + i * 7, Math.round(74 * scale), Math.round(30 * scale), palette[0], palette[1], palette[2]);
    const x = (((hash(seed + i) * span + t * speed) % span) + span) % span - 90 * scale;
    const yy = y + hash(seed + i * 13) * 14 * scale;
    ctx.drawImage(spr, Math.round(x), Math.round(yy - spr.height / 2));
  }
}

/* ------------------------------ terrain ------------------------------ */
export function ridgeSprite(seed: number, w: number, h: number, top: string, face: string, shadeCol: string, snow?: string): HTMLCanvasElement {
  return cached(`ridge-${seed}-${w}-${h}-${top}-${face}-${shadeCol}-${snow || ''}`, w, h, (ctx) => {
    const step = 29;
    const peaks = Array.from({ length: Math.ceil(w / step) + 2 }, (_, i) =>
      h * (0.36 + hash(seed * 19 + i * 7) * 0.37)
    );
    const heights: number[] = [];
    const faceGrain = shade(face, -0.08);
    const deepGrain = shade(shadeCol, -0.08);
    for (let x = 0; x < w; x++) {
      const section = Math.floor(x / step);
      const fraction = (x % step) / step;
      const slope = peaks[section] * (1 - fraction) + peaks[section + 1] * fraction;
      heights.push(Math.max(5, slope + Math.sin(x * 0.23 + seed) * 1.6));
    }
    for (let x = 0; x < w; x++) {
      const hh = heights[x];
      for (let y = 0; y < h; y++) {
        if (y < hh) continue;
        const depth = y - hh;
        let col = y < hh + 3 ? top : y < hh + 14 ? face : shadeCol;
        if (snow && y < hh + 2) col = snow;
        if (depth > 4 && ditherAt(x, y, 0.18)) col = y < hh + 14 ? faceGrain : deepGrain;
        R(ctx, x, y, 1, 1, col);
      }
    }
  });
}

/* --------------------------- AETHER CITY --------------------------- */
export function aetherSprite(modern: boolean): HTMLCanvasElement {
  return cached(`aether-v2-${modern}`, 360, 230, (ctx) => {
    const deckY = 148;
    const shellSpec = '#ffffff';
    const shellLight = modern ? '#f8fafc' : '#e6eef8';
    const shellMid = modern ? '#cbd5e1' : '#b8c7db';
    const shellDark = modern ? '#64748b' : '#6c7c93';
    const ink = '#1e293b';
    const accent = modern ? '#22d3ee' : '#38bdf8';

    // --- Floating island underside with carved basalt strata & anti-gravemitter rings ---
    for (let row = 0; row < 60; row++) {
      const w = 310 - row * 4.8 - Math.sin(row * 0.5) * 7;
      if (w <= 0) break;
      const x = 180 - w / 2;
      const col = row < 6 ? '#475569' : row % 6 === 0 ? '#4a3e5d' : row % 2 === 0 ? '#352c47' : '#251e34';
      R(ctx, x, deckY + row, w, 1, col);
      // Sunlit right rim on rock strata
      R(ctx, x + w - Math.max(4, w * 0.16), deckY + row, Math.max(4, w * 0.16), 1, row < 6 ? '#94a3b8' : '#58486e');
    }
    // Glowing anti-gravity propulsion rings under the island
    for (const [rx, ry, rw] of [[180, deckY + 26, 136], [180, deckY + 42, 86], [180, deckY + 54, 42]] as const) {
      R(ctx, rx - rw / 2, ry, rw, 3, '#0f172a');
      R(ctx, rx - rw / 2 + 2, ry + 1, rw - 4, 1, accent);
    }
    // Central levitation core crystal beneath the island
    R(ctx, 174, deckY + 56, 12, 16, '#0f172a');
    R(ctx, 176, deckY + 57, 8, 13, '#38bdf8');
    R(ctx, 178, deckY + 58, 4, 10, '#e0f2fe');

    // --- Multi-tier modern city deck & monorail track ---
    R(ctx, 22, deckY - 10, 316, 12, ink);
    R(ctx, 24, deckY - 9, 312, 9, shellMid);
    R(ctx, 24, deckY - 9, 312, 2, shellSpec);
    R(ctx, 28, deckY - 4, 304, 2, accent);
    for (let x = 34; x < 326; x += 18) R(ctx, x, deckY - 2, 10, 2, shellDark);

    // --- Gleaming modern arcology towers with directional sunlight ---
    const towers = [
      { x: 40, w: 22, h: 48, spire: 8 },
      { x: 66, w: 20, h: 74, spire: 12 },
      { x: 90, w: 28, h: 96, spire: 14 },
      { x: 122, w: 24, h: 116, spire: 18 },
      { x: 150, w: 38, h: 132, spire: 20 },
      { x: 192, w: 26, h: 108, spire: 16 },
      { x: 222, w: 30, h: 92, spire: 14 },
      { x: 256, w: 22, h: 72, spire: 10 },
      { x: 282, w: 24, h: 52, spire: 8 },
    ];
    towers.forEach((tw, i) => {
      const topY = deckY - 10 - tw.h;
      R(ctx, tw.x - 1, topY - 1, tw.w + 2, tw.h + 1, ink);
      // Left shadow, mid body, right sunlit specular edge (sun is on the right in Scene 1)
      R(ctx, tw.x, topY, tw.w, tw.h, shellMid);
      R(ctx, tw.x + 3, topY, tw.w - 3, tw.h, shellLight);
      R(ctx, tw.x + tw.w - 4, topY, 4, tw.h, shellSpec);
      R(ctx, tw.x, topY, 3, tw.h, shellDark);

      // Architectural glass curtain-wall bands & setbacks
      const stepH = Math.floor(tw.h / 4);
      for (let s = 1; s <= 3; s++) {
        R(ctx, tw.x + 1, topY + stepH * s, tw.w - 2, 2, accent);
      }

      // Illuminated windows with warm golden & cyan interior lights
      for (let wy = topY + 5; wy < deckY - 16; wy += 5) {
        if ((wy - topY) % stepH < 3) continue;
        for (let wx = tw.x + 4; wx < tw.x + tw.w - 4; wx += 4) {
          const r = hash(i * 41 + wy * 3 + wx);
          const col = r > 0.65 ? '#fef08a' : r > 0.35 ? '#7dd3fc' : '#475569';
          R(ctx, wx, wy, 2, 3, col);
        }
      }

      // Beveled tower crown + energy spire
      R(ctx, tw.x - 1, topY - 3, tw.w + 2, 3, ink);
      R(ctx, tw.x, topY - 2, tw.w, 2, accent);
      const sx = tw.x + Math.floor(tw.w / 2);
      R(ctx, sx - 1, topY - tw.spire - 2, 3, tw.spire, shellLight);
      R(ctx, sx, topY - tw.spire - 4, 1, tw.spire + 2, shellSpec);
      R(ctx, sx - 2, topY - tw.spire - 4, 5, 2, accent);

      // Elevated glass skybridge to next tower
      if (i < towers.length - 1) {
        const nb = towers[i + 1];
        const by = deckY - 28 - (i % 3) * 18;
        R(ctx, tw.x + tw.w, by, nb.x - tw.x - tw.w, 3, ink);
        R(ctx, tw.x + tw.w, by + 1, nb.x - tw.x - tw.w, 1, accent);
      }
    });

    // --- Glass geodesic biodomes along the plaza deck ---
    for (const dx of [74, 170, 250]) {
      R(ctx, dx - 14, deckY - 18, 28, 8, ink);
      R(ctx, dx - 12, deckY - 17, 24, 7, '#38bdf8');
      R(ctx, dx - 10, deckY - 16, 20, 5, '#bae6fd');
      R(ctx, dx - 8, deckY - 13, 16, 3, '#22c55e');
    }

    // --- Cascading waterfalls & mist plumes ---
    [94, 248].forEach((wx, i) => {
      for (let y = deckY; y < deckY + 68; y += 2) {
        const w = 4 + Math.floor(hash(y + i) * 3);
        R(ctx, wx + Math.sin(y * 0.2 + i) * 1.5, y, w, 2, rgba('#e0f2fe', 0.65 - (y - deckY) / 140));
      }
    });
  });
}

/* ------------------------------ props ------------------------------ */
export function headframeSprite(): HTMLCanvasElement {
  return cached('headframe', 140, 150, (ctx) => {
    const steel = '#8a6a4a';
    const dark = '#4a2f1c';
    const ink = '#150d0a';
    // legs
    R(ctx, 14, 36, 12, 114, ink);
    R(ctx, 114, 36, 12, 114, ink);
    R(ctx, 16, 38, 8, 112, steel);
    R(ctx, 116, 38, 8, 112, steel);
    R(ctx, 16, 38, 3, 112, shade(steel, 0.2));
    R(ctx, 121, 38, 3, 112, shade(steel, -0.3));
    // lattice bracing
    for (let i = 0; i < 6; i++) {
      const y = 48 + i * 18;
      R(ctx, 24, y, 92, 3, dark);
      R(ctx, 24, y, 92, 1, shade(steel, -0.1));
      for (let x = 26; x < 114; x += 18) R(ctx, x + (i % 2 ? 8 : 0), y, 3, 18, dark);
    }
    // rivets
    for (let y = 44; y < 150; y += 9) {
      R(ctx, 19, y, 2, 2, shade(steel, 0.35));
      R(ctx, 119, y, 2, 2, shade(steel, 0.35));
    }
    // top beam + wheel housing
    R(ctx, 4, 26, 132, 12, ink);
    R(ctx, 6, 28, 128, 8, '#9a784f');
    R(ctx, 6, 28, 128, 2, '#c2a075');
    for (let x = 10; x < 130; x += 12) R(ctx, x, 30, 6, 4, '#5a3d24');
    R(ctx, 52, 4, 36, 24, ink);
    R(ctx, 54, 6, 32, 20, '#6b4b2c');
    R(ctx, 54, 6, 32, 3, '#9a784f');
    // rust streaks
    for (let i = 0; i < 16; i++) {
      const x = 12 + hash(i) * 118;
      const y = 40 + hash(i + 3) * 100;
      R(ctx, x, y, 2, 4 + hash(i + 7) * 8, rgba('#b45309', 0.35));
    }
    // sign
    R(ctx, 34, 118, 72, 22, ink);
    R(ctx, 36, 120, 68, 18, '#b08a58');
    R(ctx, 36, 120, 68, 2, '#d4b184');
  });
}

export function shedSprite(): HTMLCanvasElement {
  return cached('shed', 300, 170, (ctx) => {
    const plank = '#3b2a22';
    const plankL = '#4a352a';
    const ink = '#120c0a';
    // corrugated back wall
    for (let x = 0; x < 300; x += 14) {
      R(ctx, x, 0, 12, 170, plank);
      R(ctx, x, 0, 2, 170, plankL);
      R(ctx, x + 11, 0, 1, 170, ink);
    }
    // girders
    R(ctx, 0, 16, 300, 8, '#20242c');
    R(ctx, 0, 16, 300, 2, '#39404c');
    R(ctx, 0, 116, 300, 8, '#20242c');
    for (let x = 20; x < 300; x += 60) R(ctx, x, 0, 6, 170, '#2a2f38');
    // high windows with moonlight
    for (let i = 0; i < 4; i++) {
      const wx = 26 + i * 70;
      R(ctx, wx, 32, 34, 26, ink);
      R(ctx, wx + 2, 34, 30, 22, '#6b7f97');
      R(ctx, wx + 2, 34, 30, 8, '#8ea6bf');
      for (let gx = wx + 2; gx < wx + 32; gx += 8) R(ctx, gx, 34, 2, 22, ink);
    }
    // tool board
    R(ctx, 214, 50, 70, 54, ink);
    R(ctx, 216, 52, 66, 50, '#2a2a20');
    const tools: Array<[number, number, number, number, string]> = [
      [222, 58, 3, 24, '#8b93a5'],
      [232, 60, 12, 4, '#9a6a3a'],
      [248, 58, 3, 26, '#6f7889'],
      [258, 62, 14, 3, '#a8b0bd'],
      [222, 88, 16, 3, '#9a6a3a'],
      [246, 86, 3, 14, '#8b93a5'],
      [254, 88, 14, 6, '#6f7889'],
    ];
    tools.forEach(([x, y, w, h, c]) => {
      R(ctx, x - 1, y - 1, w + 2, h + 2, ink);
      R(ctx, x, y, w, h, c);
    });
    // workbench
    R(ctx, 20, 132, 200, 10, ink);
    R(ctx, 22, 134, 196, 8, '#7a5a3a');
    R(ctx, 22, 134, 196, 2, '#a07c52');
    R(ctx, 34, 142, 8, 28, '#4a3626');
    R(ctx, 196, 142, 8, 28, '#4a3626');
    // clutter on bench
    for (let i = 0; i < 9; i++) {
      const x = 30 + i * 20;
      const h = 4 + hash(i) * 8;
      R(ctx, x, 132 - h, 8 + hash(i + 2) * 6, h, i % 3 ? '#5a4a3a' : '#6f7889');
    }
    // hanging lamp
    R(ctx, 150, 0, 2, 22, ink);
    R(ctx, 142, 22, 18, 6, '#39404c');
    R(ctx, 145, 28, 12, 3, '#fef3c7');
  });
}

export function bunkerSprite(): HTMLCanvasElement {
  return cached('bunker', 150, 110, (ctx) => {
    R(ctx, 4, 20, 142, 90, '#160f14');
    R(ctx, 6, 22, 138, 86, '#3b3448');
    for (let y = 30; y < 104; y += 12) R(ctx, 6, y, 138, 2, '#2a2434');
    R(ctx, 0, 12, 150, 12, '#4a4256');
    R(ctx, 0, 12, 150, 3, '#6a6078');
    // hazard chevrons
    for (let x = 0; x < 150; x += 12) R(ctx, x, 16, 6, 5, '#eab308');
    // round hatch
    R(ctx, 44, 38, 62, 62, '#0d090f');
    R(ctx, 47, 41, 56, 56, '#5a5268');
    for (let r = 0; r < 6; r++) R(ctx, 49 + r, 43 + r, 52 - r * 2, 1, '#767086');
    R(ctx, 70, 56, 18, 30, '#2a2434');
    R(ctx, 78, 42, 4, 12, '#8b93a5');
    // lamp
    R(ctx, 118, 30, 10, 8, '#1c1520');
    R(ctx, 120, 32, 6, 5, '#ffe9a8');
    // rust
    for (let i = 0; i < 20; i++) R(ctx, 8 + hash(i) * 130, 26 + hash(i + 5) * 76, 2, 3, rgba('#b45309', 0.3));
  });
}

export function cartSprite(): HTMLCanvasElement {
  return cached('cart', 64, 44, (ctx) => {
    R(ctx, 4, 14, 56, 18, '#1a110c');
    R(ctx, 6, 16, 52, 14, '#6b4a2a');
    R(ctx, 6, 16, 52, 3, '#8a6238');
    R(ctx, 8, 30, 48, 8, '#3a2416');
    // ore heaped inside
    for (let i = 0; i < 14; i++) {
      const x = 10 + hash(i) * 42;
      const y = 8 + hash(i + 3) * 8;
      R(ctx, x, y, 5, 4, '#1a110c');
      R(ctx, x + 1, y + 1, 3, 2, i % 3 === 0 ? '#e6d825' : '#8a6238');
    }
    // wheels
    [16, 48].forEach((wx) => {
      R(ctx, wx - 7, 32, 14, 12, '#1a110c');
      R(ctx, wx - 5, 34, 10, 8, '#7a7a86');
      R(ctx, wx - 2, 36, 4, 4, '#3d3d48');
    });
  });
}

/* ------------------------------ FX ------------------------------ */
export function dustMotes(ctx: CanvasRenderingContext2D, t: number, count: number, color: string, y0 = 0, y1 = CH, drift = 12) {
  for (let i = 0; i < count; i++) {
    const x = (hash(i) * CW + Math.sin(t * 0.4 + i) * 22 + t * drift) % CW;
    const y = y0 + ((hash(i + 7) * (y1 - y0) + Math.sin(t * 0.3 + i * 2) * 10) % (y1 - y0));
    const a = 0.18 + 0.5 * Math.abs(Math.sin(t * 0.8 + i));
    ctx.globalAlpha = a;
    R(ctx, x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1, color);
  }
  ctx.globalAlpha = 1;
}
export function embers(ctx: CanvasRenderingContext2D, t: number, count: number, x0: number, x1: number, yBottom: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const life = (t * (0.16 + hash(i) * 0.2) + hash(i + 3)) % 1;
    const x = x0 + hash(i + 9) * (x1 - x0) + Math.sin(t * 1.4 + i) * 6;
    const y = yBottom - life * (90 + hash(i + 5) * 120);
    ctx.globalAlpha = (1 - life) * 0.9;
    R(ctx, x, y, 1, 1, i % 3 === 0 ? '#fff3b0' : '#fb923c');
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
export function lightShaft(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w * 1.9, y + h);
  ctx.lineTo(x - w * 0.4, y + h);
  ctx.fill();
  ctx.restore();
}
const glowSprites = new Map<string, HTMLCanvasElement>();
/** Additive radial glow — rendered once per colour, then blitted (no per-call gradients). */
export function glowAt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) {
  if (a <= 0.004 || r < 1) return;
  let spr = cacheGet(glowSprites, color);
  if (!spr) {
    spr = document.createElement('canvas');
    spr.width = spr.height = 64;
    const g = spr.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.5, rgba(color, 0.35));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    cacheSet(glowSprites, color, spr, 64);
  }
  const prevOp = ctx.globalCompositeOperation;
  const prevA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = prevA * Math.min(1, a);
  ctx.drawImage(spr, Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}
export function sparksAt(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number, count = 14, spread = 30) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const life = (t * 1.6 + hash(seed + i)) % 1;
    const a = hash(seed + i * 4) * Math.PI * 2;
    const sp = spread * (0.35 + hash(seed + i * 6) * 0.65);
    ctx.globalAlpha = 1 - life;
    R(ctx, x + Math.cos(a) * sp * life, y + Math.sin(a) * sp * life + life * life * 18, 1, i % 4 === 0 ? 2 : 1, i % 2 ? '#fde047' : '#fff7d6');
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
export function smokeAt(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number, color = '#8a8494', count = 7, rise = 44) {
  for (let i = 0; i < count; i++) {
    const life = (t * 0.28 + i / count + hash(seed)) % 1;
    const s = 3 + life * 9;
    const px = x + Math.sin(life * 5 + i + seed) * 7 + life * 10;
    const py = y - life * rise;
    R(ctx, px - s / 2, py - s / 2, s, s, rgba(color, 0.4 * (1 - life)));
    if (s > 6) {
      R(ctx, px - s / 2 + 2, py - s / 2 + 2, s - 3, s - 3, rgba(color, 0.22 * (1 - life)));
    }
  }
}
export function rain(ctx: CanvasRenderingContext2D, t: number, count: number, color: string) {
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < count; i++) {
    const x = (hash(i) * CW + t * 60) % CW;
    const y = (hash(i + 3) * CH + t * 300) % CH;
    R(ctx, x, y, 1, 6, color);
  }
  ctx.restore();
}
export function birds(ctx: CanvasRenderingContext2D, t: number, y: number, color: string, count = 7) {
  for (let i = 0; i < count; i++) {
    const x = ((t * (14 + i * 2) + i * 57) % (CW + 40)) - 20;
    const yy = y + Math.sin(t + i) * 4 + i * 2;
    const flap = Math.sin(t * 7 + i) > 0 ? 1 : -1;
    R(ctx, x, yy, 1, 1, color);
    R(ctx, x - 1, yy + flap, 1, 1, color);
    R(ctx, x + 1, yy - flap, 1, 1, color);
  }
}

/* ================================================================== *
 *  HERO ROBOT — a big custom sprite for cinematic close-ups.
 *  Drawn in a 26x26 pixel grid, scaled up crisply.
 * ================================================================== */
export type RobotState = 'idle' | 'boot' | 'working' | 'happy' | 'sad' | 'crash' | 'falling' | 'sleep';
export interface HeroRobotOpts {
  x: number;
  y: number;
  s?: number;
  t: number;
  state?: RobotState;
  flip?: boolean;
  damage?: number;
  power?: number;
  rot?: number;
  drill?: boolean;
  drillAngle?: number;
  drillExtend?: number;
  drillSpin?: number;
  thruster?: number;
  look?: number;
  eye?: 'normal' | 'happy' | 'surprised' | 'dead' | 'closed' | 'scan';
  /** 0 = pristine white/cyan Aether coat; 1 = scorched/oxidized brown coat (default 1). */
  paintMix?: number;
  /** Custom tank-tread scroll phase (so tank movement matches ground distance). */
  wheelPhase?: number;
  /** Renders a half-broken, wobbling front drive wheel for wasteland tank crawling. */
  brokenWheel?: boolean;
  /** 0..1 extension of the small front service manipulator arm (Scene 10 handshake). */
  serviceArm?: number;
  /** Disable free idle bob when a shot supplies exact physical contact poses. */
  chassisMotion?: boolean;
}

const AETHER_BODY = {
  light: '#ffffff',
  mid: '#e2e8f0',
  dark: '#94a3b8',
  deep: '#475569',
  trim: '#38bdf8',
  side: '#64748b',
  sideDeep: '#334155',
  hi: '#f8fafc',
  stripe: '#38bdf8',
};

const BROWN_BODY = {
  light: '#ffb457',
  mid: '#d9772a',
  dark: '#9c4a0d',
  deep: '#5e2c07',
  trim: '#3d4453',
  side: '#774021',
  sideDeep: '#4d2b20',
  hi: '#ffe0a0',
  stripe: '#eab308',
};

/**
 * Bresenham 1px line with an optional 1px dark outline drawn underneath.
 * Used for antennae and cables so thin details never appear to snap apart.
 */
function pixelLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  outlineOffset = 0
) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const dx = Math.abs(ex - x);
  const dy = Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx - dy;
  ctx.fillStyle = color;
  for (let guard = 0; guard < 64; guard++) {
    ctx.fillRect(x, y + outlineOffset, 1, 1);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

export function heroRobot(ctx: CanvasRenderingContext2D, o: HeroRobotOpts) {
  const s = o.s ?? 3;
  const t = o.t;
  const state = o.state ?? 'idle';
  const dmg = clamp(o.damage ?? 0);
  const power = o.power ?? 1;
  const blink = state !== 'sleep' && t % 3.4 < 0.1;

  const idleSway = o.chassisMotion === false ? 0 : state === 'idle' ? Math.sin(t * 0.74) * 0.018 : 0;
  const bob = o.chassisMotion === false ? 0 :
    state === 'idle' ? Math.sin(t * 1.55) * 0.23 + Math.sin(t * 0.69) * 0.1 :
    state === 'happy' ? Math.sin(t * 3) * 0.18 :
    state === 'crash' ? 0 : Math.sin(t * 1.4) * 0.1;

  ctx.save();
  ctx.translate(o.x, o.y + bob);
  if (o.rot) ctx.rotate(o.rot);
  else if (idleSway) ctx.rotate(idleSway);
  ctx.scale((o.flip ? -1 : 1) * s, s);

  const P = (x: number, y: number, w: number, h: number, c: string) => R(ctx, x, y, w, h, c);
  const lit = (c: string) => (power > 0.5 || Math.sin(t * 37) > 0.2 ? c : shade(c, -0.5));

  // Exhaust stays behind the chassis, and stretches as the rig accelerates.
  if ((o.thruster ?? 0) > 0.01) {
    const flame = o.thruster ?? 0;
    const length = 4 + flame * (8 + Math.sin(t * 28) * 2);
    for (const nx of [-8, 7]) {
      P(nx - 2, 10, 4, length + 3, '#713522');
      P(nx - 1, 10, 2, length, '#ff993b');
      P(nx, 10, 1, Math.max(2, length * 0.6), '#fff3ae');
    }
  }

  /* --- shadow --- */
  if (state !== 'falling') {
    ctx.globalAlpha = 0.28;
    P(-10, 14, 20, 3, '#000000');
    ctx.globalAlpha = 1;
  }

  /* --- jetpack housing --- */
  P(-12, -3, 4, 10, INK);
  P(-11, -2, 2, 8, '#59606e');
  P(-11, -2, 2, 3, '#8b93a5');
  P(8, -3, 4, 10, INK);
  P(9, -2, 2, 8, '#59606e');

  const pm = clamp(o.paintMix ?? 1);
  const BODY = {
    light: mix(AETHER_BODY.light, BROWN_BODY.light, pm),
    mid: mix(AETHER_BODY.mid, BROWN_BODY.mid, pm),
    dark: mix(AETHER_BODY.dark, BROWN_BODY.dark, pm),
    deep: mix(AETHER_BODY.deep, BROWN_BODY.deep, pm),
    trim: mix(AETHER_BODY.trim, BROWN_BODY.trim, pm),
    side: mix(AETHER_BODY.side, BROWN_BODY.side, pm),
    sideDeep: mix(AETHER_BODY.sideDeep, BROWN_BODY.sideDeep, pm),
    hi: mix(AETHER_BODY.hi, BROWN_BODY.hi, pm),
    stripe: mix(AETHER_BODY.stripe, BROWN_BODY.stripe, pm),
  };

  /* --- treads & tank bogies --- */
  const rawWheel = o.wheelPhase ?? (state === 'working' ? t * 0.3 : 0);
  const phase = ((rawWheel % 1) + 1) % 1;
  P(-11, 7, 22, 8, INK);
  P(-10, 8, 20, 6, '#1b1f27');
  P(-10, 8, 20, 1, '#3a4152');
  for (let x = -10; x < 10; x += 3) {
    const off = (x + Math.floor(phase * 3) + 30) % 3;
    if (off !== 0) P(x, 8, 2, 5, '#6f7889');
  }
  [-7, 0, 7].forEach((wx, idx) => {
    // If brokenWheel is active, the front bogie (wx=7) wobbles and sits cocked!
    const wobbleY = o.brokenWheel && idx === 2 ? Math.round(Math.sin(rawWheel * Math.PI * 2) * 1.1) : 0;
    P(wx - 3, 8 + wobbleY, 6, 6, INK);
    P(wx - 2, 9 + wobbleY, 4, 4, o.brokenWheel && idx === 2 ? '#7a5c48' : '#8b93a5');
    P(wx - 1, 10 + wobbleY, 2, 2, '#3a4152');
    const sp = Math.floor(rawWheel * 2 + wx + 40) % 4;
    P(wx - 2 + (sp === 0 ? 3 : sp === 2 ? 0 : 1), 9 + wobbleY + (sp === 1 ? 3 : 0), 1, 1, '#d7dee8');
  });
  // Mudguards + hydraulic suspension struts
  P(-11, 6, 22, 2, '#2a2f38');
  P(-11, 6, 22, 1, '#59606e');
  P(-10, 13, 20, 1, '#49505c');
  P(-8, 11, 2, 1, '#d3d9df');
  P(6, 11, 2, 1, '#d3d9df');
  if (dmg > 0.5 || o.brokenWheel) {
    // Snapped mudguard & exposed bent drive sprocket on front tread
    P(4, 6, 5, 2, INK);
    P(6, 7, 3, 2, '#5a3a22');
  }

  /* --- chassis --- */
  P(-10, -8, 20, 15, INK);
  P(-9, -7, 18, 13, BODY.mid);
  // shading
  P(-9, -7, 18, 3, BODY.light);
  P(-9, -7, 3, 12, BODY.light);
  P(-8, 4, 17, 2, BODY.dark);
  P(6, -4, 3, 9, BODY.dark);
  P(-8, 5, 17, 1, BODY.deep);
  P(-9, 5, 18, 1, INK);
  // top edge
  P(-9, -8, 18, 1, BODY.light);
  // Angular side face and stamped production markings.
  P(7, -6, 2, 10, BODY.side);
  P(8, -5, 1, 8, BODY.sideDeep);
  P(-7, -5, 3, 1, BODY.hi);
  P(-8, -4, 1, 5, BODY.hi);
  P(-2, -6, 4, 1, BODY.hi);
  // panel seam + hazard/trim stripe
  P(-8, -2, 16, 1, BODY.deep);
  for (let i = 0; i < 5; i++) P(-8 + i * 4, -1, 2, 1, BODY.stripe);
  // rivets
  [[-8, -6], [7, -6], [-8, 3], [7, 3]].forEach(([x, y]) => {
    P(x, y, 1, 1, BODY.hi);
    P(x + 1, y + 1, 1, 1, BODY.deep);
  });
  P(1, -4, 2, 1, BODY.hi);
  P(4, -4, 1, 1, BODY.sideDeep);

  // Half-unit engraving adds mechanical detail without changing CUBE-07's silhouette.
  const D = P;
  D(-7, -6, 7, 1, BODY.hi);
  D(0, -6, 1, 3, BODY.deep);
  D(1, -6, 5, 1, BODY.hi);
  D(5, -5, 1, 2, BODY.sideDeep);
  D(-7, 2, 1, 2, BODY.light);
  D(1, 1, 5, 1, BODY.deep);
  for (let i = 0; i < 4; i++) {
    D(1 + i, 2, 1, 1, BODY.sideDeep);
    D(-9, -4 + i, 1, 1, '#c2c7bb');
  }
  D(-4, -5, 2, 1, shade(BODY.mid, -0.2));
  D(2, -4, 2, 1, shade(BODY.mid, -0.2));
  if (pm > 0.6) {
    D(-4, -6, 2, 1, '#d3c2a0');
    D(2, -3, 1, 1, '#573a29');
    D(6, 2, 1, 2, '#d0b88d');
  }

  // Atmospheric re-entry scorching / blistering patches when paintMix is transitioning (0 < pm < 1)
  if (pm > 0.05 && pm < 0.95) {
    for (let py = -7; py < 5; py++) {
      for (let px = -8; px < 8; px++) {
        if (ditherAt(px + 10, py + 10, pm)) {
          P(px, py, 1, 1, py < -3 ? '#e07a22' : '#8a3c12');
        }
      }
    }
  }

  // Articulated front service manipulator arm (used in Scene 10 handshake)
  if ((o.serviceArm ?? 0) > 0.02) {
    const ext = clamp(o.serviceArm ?? 0);
    const armLen = Math.round(3 + ext * 7);
    P(8, 0, armLen, 3, INK);
    P(8, 1, armLen - 1, 1, '#94a3b8');
    // Small two-pronged wrist gripper
    P(8 + armLen - 1, -1, 3, 5, INK);
    P(8 + armLen, -1, 2, 1, '#cbd5e1');
    P(8 + armLen, 3, 2, 1, '#cbd5e1');
  }
  // shoulder plate
  P(-10, -6, 4, 7, '#59606e');
  P(-10, -6, 4, 2, '#8b93a5');
  P(-9, -4, 2, 1, INK);
  P(-9, 0, 2, 1, INK);

  /* --- cargo window --- */
  P(-6, 0, 6, 4, INK);
  P(-5, 1, 4, 2, lit('#f2b718'));
  P(-5, 1, 4, 1, '#fff0a8');
  P(-7, 0, 1, 3, '#f4c278');
  // An idle power heartbeat is slow and legible, not a noisy full-body flicker.
  if (state === 'idle') {
    const beat = Math.pow(Math.max(0, Math.sin(t * 1.35 - 0.35)), 7);
    P(-4, 1, 2, 1, mix('#c77423', '#fff0a8', beat));
    P(4, 0, 1, 2, beat > 0.52 ? '#8cf3ee' : '#32747c');
    if (power > 0.35 && t % 9 < 0.16 && Math.sin(t * 5) > 0.8) {
      smokeAt(ctx, -12, 1, t, 37, '#8a9290', 2, 9);
    }
  }

  /* --- back vents / exhaust --- */
  P(-13, 2, 2, 4, INK);
  P(-13, 3, 1, 2, '#39404c');
  [-13].forEach(() => {
    const puff = (t * 0.5) % 1;
    ctx.globalAlpha = 0.3 * (1 - puff);
    P(-15 - puff * 3, 3 - puff * 5, 3 + puff * 2, 2 + puff * 2, '#cbd5e1');
    ctx.globalAlpha = 1;
  });

  /* --- head / visor --- */
  P(-6, -13, 12, 6, INK);
  P(-5, -12, 10, 4, '#4a5567');
  P(-5, -12, 10, 1, '#8b93a5');
  // headlamp
  P(o.look && o.look < 0 ? -6 : 2, -13, 4, 3, INK);
  P(o.look && o.look < 0 ? -5 : 3, -12, 2, 1, lit('#fff3b0'));
  // visor
  P(-4, -10, 9, 5, INK);
  P(-3, -9, 7, 3, '#101a2b');
  ctx.globalAlpha = 0.35;
  P(-3, -9, 7, 1, '#7fc7ff');
  ctx.globalAlpha = 1;

  // Eyes
  const eye = o.eye ?? (state === 'sleep' ? 'closed' : state === 'happy' ? 'happy' : 'normal');
  const ex = o.look ?? 0;
  if (power > 0.02) {
    const eyeCol = lit('#5cc9ff');
    if (eye === 'closed' || (blink && eye === 'normal')) {
      P(-2 + ex, -8, 2, 1, '#2c6f92');
      P(2 + ex, -8, 2, 1, '#2c6f92');
    } else if (state === 'sad' && eye === 'normal') {
      P(-2 + ex, -8, 2, 1, eyeCol);
      P(2 + ex, -9, 1, 1, eyeCol);
      P(3 + ex, -8, 1, 1, eyeCol);
    } else if (eye === 'happy') {
      P(-2 + ex, -8, 1, 1, eyeCol);
      P(-1 + ex, -9, 1, 1, eyeCol);
      P(2 + ex, -8, 1, 1, eyeCol);
      P(3 + ex, -9, 1, 1, eyeCol);
    } else if (eye === 'surprised') {
      P(-2 + ex, -9, 2, 2, eyeCol);
      P(2 + ex, -9, 2, 2, eyeCol);
    } else if (eye === 'scan') {
      P(-3, -8, 1, 1, eyeCol);
      P(1, -8, 1, 1, eyeCol);
      P(Math.floor((t * 6) % 6) - 1, -9, 1, 1, '#bff3ff');
    } else if (eye === 'dead') {
      P(-2 + ex, -9, 2, 2, '#2a2f38');
      P(2 + ex, -8, 1, 1, '#3a4152');
    } else {
      P(-2 + ex, -9, 2, 2, eyeCol);
      P(2 + ex, -9, 1, 2, eyeCol);
      P(-2 + ex, -9, 1, 1, '#ffffff');
    }
    if (eye !== 'dead') glowAt(ctx, -3, -8, 6, '#5cc9ff', 0.22 * power);
  }

  // Antenna — a two-segment whip rigidly mounted on the helmet. It bends at the
  // base, so the tip can never drift away from the stem and look like it floats.
  const antennaIdle = state === 'idle' || state === 'sleep' || state === 'sad';
  const swayAmt = Math.sin(t * (antennaIdle ? 1.7 : 5)) * 1.2 + dmg * 1.5;
  const antBaseX = 1;
  const antBaseY = -14; // helmet crown sits at -13, so the boss overlaps it
  const stemTopY = -18;
  const tipX = antBaseX + Math.round(swayAmt);
  const tipY = stemTopY - 1 - Math.round(Math.abs(swayAmt) * 0.6);
  // Mounting boss, fused into the helmet
  P(antBaseX - 1, antBaseY, 3, 3, INK);
  P(antBaseX - 1, antBaseY, 3, 1, '#59606e');
  // Rigid stem
  P(antBaseX, antBaseY, 1, stemTopY - antBaseY + 1, INK);
  P(antBaseX, antBaseY, 1, stemTopY - antBaseY + 1, '#8b93a5');
  // Flexible segment, walked pixel by pixel so it stays visually connected
  pixelLine(ctx, antBaseX, stemTopY, tipX, tipY, '#8b93a5');
  pixelLine(ctx, antBaseX, stemTopY, tipX, tipY, '#59606e', 1);
  // Beacon bulb
  const beaconOn = power > 0.3 && Math.sin(t * (state === 'sleep' ? 1.4 : 3)) > -0.2;
  P(tipX - 1, tipY - 1, 3, 3, INK);
  P(tipX, tipY, 1, 1, beaconOn ? '#ff5470' : '#5b2431');
  if (beaconOn) glowAt(ctx, tipX, tipY, 4, '#ff5470', 0.4 * power);

  /* --- drill arm --- */
  if (o.drill !== false) {
    const ang = o.drillAngle ?? 0.55;
    const ext = clamp(o.drillExtend ?? 0.4);
    ctx.save();
    ctx.translate(9, -1);
    ctx.rotate(ang);
    P(-1, -4, 4, 8, INK);
    P(0, -3, 3, 6, '#59606e');
    P(0, -3, 3, 2, '#8b93a5');
    P(3, -2, 2 + ext * 3, 4, INK);
    P(4, -1, 1 + ext * 3, 2, '#c3ccd9');
    const base = 5 + ext * 3;
    P(base, -4, 4, 8, INK);
    P(base + 1, -3, 2, 6, '#7c2d12');
    P(base + 1, -3, 2, 2, '#f59e0b');
    for (let i = 0; i < 8; i++) {
      const hh = Math.max(1, Math.round(3.2 * (1 - (i / 8) * 0.85)));
      P(base + 4 + i, -hh, 1, hh * 2, INK);
      P(base + 4 + i, -hh + 1, 1, hh * 2 - 2, i % 2 ? '#6f7889' : '#c3ccd9');
      if ((i + Math.floor((o.drillSpin ?? t * 2.8) * 8)) % 3 === 0) {
        P(base + 4 + i, -hh + 1, 1, 1, '#f7e9c2');
      }
    }
    if (state === 'working') {
      const tip = base + 12;
      glowAt(ctx, tip, 0, 9, '#ffd166', 0.55);
      sparksAt(ctx, tip, 0, t, 5, 10, 14);
    }
    ctx.restore();
  }

  /* --- damage / repairs --- */
  if (dmg > 0.15) {
    // patch plate
    P(0, 1, 6, 3, INK);
    P(1, 2, 4, 1, '#8a5a32');
    P(1, 3, 1, 1, '#d9b48a');
    P(4, 3, 1, 1, '#d9b48a');
    // cracks
    P(-3, -5, 2, 1, INK);
    P(-1, -4, 1, 2, INK);
    if (dmg > 0.5) {
      P(-8, 0, 4, 4, INK);
      P(-7, 1, 2, 2, '#1a1210');
      P(-7, 2, 1, 1, '#ef4444');
      P(-6, 1, 1, 1, '#fde047');
      // loose wire
      const sw = Math.sin(t * 3) * 2;
      P(-11, 4, 1, 2, INK);
      P(-11 + sw, 6, 1, 1, '#ef4444');
      P(-11 + sw, 7, 1, 2, '#fde047');
      // smoke
      smokeAt(ctx, -4, -6, t, 9, '#8a8494', 4, 26);
    }
    // cracked visor
    P(2, -9, 1, 1, '#ffffff');
    P(3, -8, 1, 1, '#bff3ff');
  }

  // Boot power flicker overlay
  if (power < 1 && Math.sin(t * 30) > power * 2 - 1) {
    ctx.globalAlpha = 0.5;
    P(-9, -7, 18, 13, '#1a1210');
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/* ================================================================== *
 *  HERO HUMAN — detailed pixel people with poses
 * ================================================================== */
export interface HeroHumanOpts {
  x: number;
  y: number;
  s?: number;
  t: number;
  look: { skin: string; hair: string; shirt: string; shirtDark: string; pants: string; boots: string; helmet?: string | null; apron?: string | null; beard?: boolean; glasses?: boolean; hairStyle?: string; small?: boolean };
  pose?: 'idle' | 'walk' | 'wave' | 'reach' | 'cheer' | 'kneel' | 'point' | 'hold';
  facing?: 1 | -1;
  walkPhase?: number;
  talking?: boolean;
  flipProp?: 'wrench' | 'mug' | 'lantern' | 'clipboard' | 'drill' | null;
}

export function heroHuman(ctx: CanvasRenderingContext2D, o: HeroHumanOpts) {
  const s = o.s ?? 3;
  const t = o.t;
  const pose = o.pose ?? 'idle';
  const look = o.look;
  // 8-step smooth walk cycle
  const frame8 = pose === 'walk' ? Math.floor((o.walkPhase ?? t * 8) * 2) % 8 : 0;
  const strideTable = [0, 1, 2, 1, 0, -1, -2, -1];
  const liftTable = [0, -1, -1, 0, 0, 0, 0, 0];
  const stride = pose === 'walk' ? strideTable[frame8] : 0;
  const liftA = pose === 'walk' ? liftTable[frame8] : 0;
  const liftB = pose === 'walk' ? liftTable[(frame8 + 4) % 8] : 0;
  const armSwing = pose === 'walk' ? -stride : 0;
  const bob = pose === 'walk' ? (frame8 % 4 === 1 || frame8 % 4 === 2 ? -0.7 : 0) : 0;
  const breathe = pose === 'idle' ? Math.sin(t * 2.2) * 0.34 : 0;
  const blink = t % 4.2 < 0.13;
  const lean = pose === 'reach' || pose === 'point'
    ? 0.08
    : pose === 'cheer'
      ? 0.04
      : pose === 'idle'
        ? Math.sin(t * 0.95) * 0.01
        : 0;
  const y = o.y + bob + breathe;

  ctx.save();
  ctx.translate(o.x, y);
  const scale = s * (look.small ? 0.82 : 1);
  ctx.scale((o.facing ?? 1) * scale, scale);
  ctx.rotate(lean);

  const P = (x: number, y2: number, w: number, h: number, c: string) => R(ctx, x, y2, w, h, c);
  const shadowC = shade(look.skin, -0.22);
  const hiC = shade(look.skin, 0.14);

  // Ground contact shadow
  ctx.globalAlpha = 0.28;
  P(-6, 0, 12, 2, '#000000');
  ctx.globalAlpha = 1;

  // Legs with 1px ink outline + knee lift
  const legW = 3;
  if (pose === 'kneel') {
    P(-5, -9, 10, 9, INK);
    P(-4, -8, 8, 3, look.pants);
    P(-1, -6, 3, 6, look.pants);
    P(-3, -1, 3, 1, look.boots);
    P(0, -1, 4, 1, look.boots);
  } else {
    P(-5 + stride, -11 + liftA, legW + 2, 11, INK);
    P(-1 - stride, -11 + liftB, legW + 2, 11, INK);
    P(-4 + stride, -10 + liftA, legW, 8, look.pants);
    P(0 - stride, -10 + liftB, legW, 8, look.pants);
    P(-4 + stride, -10 + liftA, 1, 8, shade(look.pants, 0.18));
    P(0 - stride, -10 + liftB, 1, 8, shade(look.pants, 0.18));
    P(-5 + stride, -2 + liftA, 4, 2, look.boots);
    P(0 - stride, -2 + liftB, 4, 2, look.boots);
    P(-5 + stride, -2 + liftA, 4, 1, shade(look.boots, 0.25));
    P(0 - stride, -2 + liftB, 4, 1, shade(look.boots, 0.25));
  }

  // Back arm
  const backArmY = -20;
  if (pose === 'cheer') {
    const cy = backArmY - 5 + Math.round(Math.sin(t * 11));
    P(-7, cy - 3, 4, 12, INK);
    P(-6, cy, 2, 8, look.shirtDark);
    P(-6, cy - 2, 2, 2, shadowC);
  } else {
    const bx = -5 - armSwing * (pose === 'walk' ? 1 : 0);
    P(bx - 1, -20, 4, 11, INK);
    P(bx, -19, 2, 7, look.shirtDark);
    P(bx, -12, 2, 2, shadowC);
  }

  // Torso with 1px ink outline
  P(-5, -22, 10, 13, INK);
  P(-4, -21, 8, 11, look.shirt);
  P(-4, -21, 2, 11, shade(look.shirt, 0.16));
  P(2, -21, 2, 11, shade(look.shirt, -0.16));
  P(-4, -11, 8, 1, look.shirtDark);
  // collar + zipper
  P(-2, -21, 4, 2, shade(look.shirt, -0.28));
  P(-1, -19, 1, 8, look.shirtDark);
  // belt
  P(-4, -13, 8, 2, '#2a2018');
  P(-1, -13, 2, 2, '#d9b24a');
  // apron
  if (look.apron) {
    P(-3, -18, 6, 8, look.apron);
    P(-1, -16, 2, 3, shade(look.apron, -0.2));
    P(-3, -14, 6, 1, shade(look.apron, 0.2));
  }

  // Head with 1px ink outline
  P(-4, -30, 9, 9, INK);
  P(-3, -28, 7, 7, look.skin);
  P(-3, -28, 7, 1, shade(look.skin, 0.2));
  P(2, -28, 2, 7, shadowC);
  P(-3, -22, 7, 1, shadowC);
  // ear
  P(-4, -25, 1, 2, shade(look.skin, -0.12));

  // Hair styles
  const hs = look.hairStyle ?? 'short';
  P(-3, -29, 7, 2, look.hair);
  if (hs === 'long') {
    P(-4, -28, 2, 8, look.hair);
    P(3, -28, 1, 6, look.hair);
  } else if (hs === 'bun') {
    P(-5, -31, 3, 3, look.hair);
    P(-3, -29, 7, 1, look.hair);
  } else if (hs === 'bald') {
    P(-3, -29, 7, 1, shade(look.skin, 0.2));
  } else {
    P(-3, -28, 7, 1, shade(look.hair, 0.12));
    P(-3, -28, 1, 3, look.hair);
  }
  if (look.beard) {
    P(-3, -24, 6, 3, look.hair);
    P(-2, -23, 4, 1, shade(look.hair, 0.2));
  }
  if (look.helmet) {
    P(-6, -32, 12, 5, INK);
    P(-5, -31, 10, 3, look.helmet);
    P(-5, -31, 10, 1, shade(look.helmet, 0.3));
    P(-6, -29, 12, 1, shade(look.helmet, -0.25));
    P(3, -30, 3, 2, '#fff3b0');
  }

  // Face
  const faceInk = '#22140f';
  if (!blink) {
    P(0, -26, 1, 2, faceInk);
    P(2, -26, 1, 2, faceInk);
    P(0, -26, 1, 1, '#ffffff');
  } else {
    P(0, -25, 1, 1, faceInk);
    P(2, -25, 1, 1, faceInk);
  }
  if (look.glasses) {
    P(-1, -26, 4, 3, '#cbd5e1');
    P(0, -26, 1, 2, faceInk);
    P(2, -26, 1, 2, faceInk);
    P(-2, -25, 1, 1, '#cbd5e1');
  }
  // nose + mouth
  P(2, -24, 1, 1, shadowC);
  const talk = pose === 'cheer' || (o.talking && Math.floor(t * 9) % 3 === 0);
  P(1, -23, 2, 1, talk ? '#5a1e1e' : shade(look.skin, -0.35));

  // Front arm + prop with 1px ink outline
  const prop = o.flipProp ?? null;
  if (pose === 'wave' || pose === 'cheer') {
    const waveOff = Math.round(Math.sin(t * (pose === 'cheer' ? 11 : 8)) * (pose === 'cheer' ? 2 : 1));
    P(1, -28, 4, 10, INK);
    P(2, -27, 2, 8, look.shirt);
    P(2, -27, 1, 8, shade(look.shirt, 0.15));
    P(1 + waveOff, -31, 4, 5, INK);
    P(2 + waveOff, -30, 2, 3, shadowC);
    P(2 + waveOff, -30, 2, 1, hiC);
  } else if (pose === 'reach' || pose === 'point') {
    P(1, -22, 11, 4, INK);
    P(2, -21, 8, 2, look.shirt);
    P(2, -21, 8, 1, shade(look.shirt, 0.2));
    P(9, -21, 2, 2, shadowC);
    P(10, -21, 1, 1, hiC);
    if (pose === 'reach') {
      // Glowing gold-cyan Aether core module offered in Mara's hand
      P(11, -22, 4, 4, INK);
      P(12, -21, 2, 2, '#fde047');
      P(12, -21, 1, 1, '#ffffff');
    }
  } else if (pose === 'hold' || prop) {
    P(1, -21, 4, 9, INK);
    P(2, -20, 2, 6, look.shirt);
    P(2, -20, 1, 6, shade(look.shirt, 0.15));
    P(2, -15, 2, 2, shadowC);
    if (prop === 'wrench') {
      P(2, -28, 4, 14, INK);
      P(3, -25, 2, 10, '#8b93a5');
      P(2, -27, 4, 3, '#a8b0bd');
      P(3, -26, 2, 1, '#4a5567');
    } else if (prop === 'mug') {
      P(2, -19, 6, 6, INK);
      P(3, -18, 4, 4, '#c9a06a');
      P(3, -18, 4, 1, '#e8c79a');
      P(7, -17, 1, 2, '#c9a06a');
      P(3, -16, 3, 2, '#5b3a20');
    } else if (prop === 'lantern') {
      P(2, -16, 7, 10, INK);
      P(3, -13, 5, 6, '#1a1210');
      P(4, -12, 3, 3, '#ffe9a8');
      P(3, -15, 5, 1, '#4a5567');
    } else if (prop === 'clipboard') {
      P(2, -22, 7, 9, INK);
      P(3, -21, 5, 7, '#d8c9a8');
      P(3, -21, 5, 1, '#8a7a5a');
      P(4, -19, 3, 1, '#5a4a3a');
      P(4, -17, 3, 1, '#5a4a3a');
    }
  } else {
    const fx = 2 + armSwing;
    P(fx - 1, -21, 4, 9, INK);
    P(fx, -20, 2, 6, look.shirt);
    P(fx, -20, 1, 6, shade(look.shirt, 0.15));
    P(fx, -15, 2, 2, shadowC);
  }

  ctx.restore();
}

type NpcPose = 'idle' | 'walk' | 'wave' | 'cheer';
const npcFrames = new Map<string, HTMLCanvasElement>();

/** The surface crew is drawn from a small pre-rendered animation atlas. */
export function drawCachedNpc(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  groundY: number,
  look: HeroHumanOpts['look'],
  pose: NpcPose,
  phase: number,
  facing: 1 | -1,
  prop: HeroHumanOpts['flipProp'] = null
) {
  const frame = pose === 'walk'
    ? Math.abs(Math.floor(phase * 16)) % 8
    : pose === 'idle'
      ? phase % 4.2 < 0.16 ? 2 : Math.floor(phase * 0.24) % 2
      : Math.floor(phase * 8) % 3;
  const key = `${id}-${pose}-${frame}-${prop || 'none'}`;
  let sprite = npcFrames.get(key);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = 56;
    sprite.height = 56;
    const spriteCtx = sprite.getContext('2d')!;
    spriteCtx.imageSmoothingEnabled = false;
    heroHuman(spriteCtx, {
      x: 28,
      y: 48,
      s: 1.2,
      t: pose === 'wave'
        ? 0.17 + frame * 0.23
        : pose === 'cheer'
          ? 0.12 + frame * 0.28
          : frame === 2 ? 0.04 : frame === 0 ? 0.9 : 1.5,
      look,
      pose,
      walkPhase: frame * 0.5 + 0.05,
      flipProp: prop,
    });
    npcFrames.set(key, sprite);
  }
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(facing, 1);
  ctx.drawImage(sprite, -28, -48);
  ctx.restore();
}
