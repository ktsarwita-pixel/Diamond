import { clamp, hash, mix, shade } from './cutsceneArt';
import { makeCanvas, makeNoise, sliceTimer, type Noise } from './cineKit';
import { cacheGet, cacheSet } from './spriteCache';

export type Point = readonly [number, number];
export const px = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  if (w <= 0 || h <= 0) return;
  const left = Math.round(x), top = Math.round(y);
  const right = Math.round(x + w), bottom = Math.round(y + h);
  ctx.fillStyle = color;
  ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
};

export function pixelLine(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string, width = 1) {
  let x = Math.round(a[0]);
  let y = Math.round(a[1]);
  const ex = Math.round(b[0]);
  const ey = Math.round(b[1]);
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = color;
  for (let i = 0; i < 12000; i++) {
    ctx.fillRect(x, y, width, width);
    if (x === ex && y === ey) break;
    const twice = 2 * err;
    if (twice >= dy) { err += dy; x += sx; }
    if (twice <= dx) { err += dx; y += sy; }
  }
}

/** Scan conversion keeps silhouettes crisp even at non-axis-aligned edges. */
export function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[], color: string) {
  // Sample pixel centres so fractional contours retain their first/last row.
  const top = Math.ceil(Math.min(...points.map(p => p[1])) - 0.5);
  const bottom = Math.floor(Math.max(...points.map(p => p[1])) - 0.5);
  ctx.fillStyle = color;
  for (let y = top; y <= bottom; y++) {
    const hits: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const scanY = y + 0.5;
      if ((a[1] <= scanY && b[1] > scanY) || (b[1] <= scanY && a[1] > scanY)) {
        hits.push(a[0] + (scanY - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i < hits.length - 1; i += 2) {
      const x = Math.ceil(hits[i] - 0.5);
      const width = Math.ceil(hits[i + 1] - 0.5) - x;
      if (width > 0) ctx.fillRect(x, y, width, 1);
    }
  }
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  for (let yy = Math.ceil(-ry); yy <= ry; yy++) {
    const w = Math.sqrt(Math.max(0, 1 - yy * yy / (ry * ry))) * rx;
    px(ctx, x - w, y + yy, w * 2, 1, color);
  }
}

export function cable(ctx: CanvasRenderingContext2D, a: Point, b: Point, sag: number, color: string, width = 1) {
  const steps = Math.max(8, Math.ceil(Math.abs(b[0] - a[0]) / 3));
  let prev = a;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const p: Point = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + 4 * sag * k * (1 - k)];
    pixelLine(ctx, prev, p, color, width);
    prev = p;
  }
}

export function metal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, seed = 1, rib = 9) {
  px(ctx, x - 1, y - 1, w + 2, h + 2, '#090c13');
  px(ctx, x, y, w, h, color);
  px(ctx, x, y, w, 2, shade(color, 0.28));
  px(ctx, x + w - 3, y + 2, 3, h - 2, shade(color, -0.45));
  for (let xx = x + rib; xx < x + w - 3; xx += rib) {
    px(ctx, xx - 1, y + 3, 1, h - 4, shade(color, -0.24));
    px(ctx, xx, y + 3, 1, h - 4, shade(color, 0.14));
  }
  for (let i = 0; i < w * h / 32; i++) {
    const xx = x + 2 + hash(seed + i * 5.3) * (w - 5);
    const yy = y + 3 + hash(seed + i * 8.7) * (h - 5);
    px(ctx, xx, yy, 1 + hash(i) * 2, 1, i % 5 ? shade(color, -0.13) : '#83513b');
  }
  for (const xx of [x + 2, x + w - 5]) {
    for (const yy of [y + 3, y + h - 4]) {
      px(ctx, xx, yy, 2, 2, '#0d111a');
      px(ctx, xx, yy, 1, 1, '#a2aaac');
    }
  }
}

export function pipe(ctx: CanvasRenderingContext2D, points: readonly Point[], width: number, color: string) {
  for (let i = 0; i < points.length - 1; i++) {
    pixelLine(ctx, points[i], points[i + 1], '#080c12', width + 2);
    pixelLine(ctx, [points[i][0] + 1, points[i][1] + 1], [points[i + 1][0] + 1, points[i + 1][1] + 1], color, width);
    pixelLine(ctx, [points[i][0] + 1, points[i][1] + 1], [points[i + 1][0] + 1, points[i + 1][1] + 1], shade(color, 0.35));
  }
}

export function windowGrid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  px(ctx, x - 2, y - 2, w + 4, h + 4, '#090e18');
  for (let yy = 0; yy < h; yy++) px(ctx, x, y + yy, w, 1, mix(color, '#182c3f', yy / h * 0.72));
  for (let xx = x + 6; xx < x + w; xx += 7) px(ctx, xx, y, 1, h, '#19222e');
  px(ctx, x, y + h / 2, w, 1, '#19222e');
  px(ctx, x - 2, y + h + 1, w + 4, 2, '#616a6c');
}

export function gear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number, color = '#768794') {
  ellipse(ctx, x, y, r + 1, r + 1, '#070d14');
  ellipse(ctx, x, y, r - 1, r - 1, color);
  ellipse(ctx, x, y, r * 0.65, r * 0.65, '#1b2833');
  for (let i = 0; i < 8; i++) {
    const a = angle + i * Math.PI / 4;
    pixelLine(ctx, [x, y], [x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2)], color, 2);
    px(ctx, x + Math.cos(a) * r - 1, y + Math.sin(a) * r - 1, 3, 3, color);
  }
  px(ctx, x - 1, y - 1, 3, 3, '#cfcdc2');
}

const rockNoise = makeNoise(3297);
/**
 * Textured rock fill. The polygon is scan-converted into a coverage mask once,
 * then shaded 2x2 blocks are written straight into an ImageData buffer
 * (one putImageData instead of thousands of fillRect calls).
 */
export function* rockTextureGen(ctx: CanvasRenderingContext2D, points: readonly Point[], base: string, light: string, seed: number, n: Noise = rockNoise): Generator<void, void, unknown> {
  const slice = sliceTimer();
  // Padding includes the final silhouette row/column instead of cropping it
  // exactly at the shape's bounds (the source of flat, half-square stones).
  const x0 = Math.max(0, Math.floor(Math.min(...points.map(p => p[0]))) - 2);
  const x1 = Math.min(ctx.canvas.width, Math.ceil(Math.max(...points.map(p => p[0]))) + 3);
  const y0 = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))) - 2);
  const y1 = Math.min(ctx.canvas.height, Math.ceil(Math.max(...points.map(p => p[1]))) + 3);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  // coverage mask via the same crisp scan conversion used by polygon()
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const mctx = maskCanvas.getContext('2d')!;
  mctx.translate(-x0, -y0);
  polygon(mctx, points, '#ffffff');
  const mask = mctx.getImageData(0, 0, w, h).data;
  const img = ctx.getImageData(x0, y0, w, h);
  const d = img.data;
  const palette: number[][] = Array.from({ length: 15 }, (_, i) => {
    const c = mix(shade(base, -0.58), light, i / 14 * 0.83).replace('#', '');
    return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
  });
  for (let yy = 0; yy < h; yy += 2) {
    const y = y0 + yy;
    for (let xx = 0; xx < w; xx += 2) {
      const mi = (yy * w + xx) * 4 + 3;
      // A silhouette can pass through any of the four pixels in this block.
      // Testing only the top-left pixel left rectangular bites out of edges.
      const topRight = xx + 1 < w ? mask[mi + 4] : 0;
      const bottomLeft = yy + 1 < h ? mask[mi + w * 4] : 0;
      const bottomRight = xx + 1 < w && yy + 1 < h ? mask[mi + w * 4 + 4] : 0;
      if (!(mask[mi] || topRight || bottomLeft || bottomRight)) continue;
      const x = x0 + xx;
      const u = x * 0.021 + seed;
      const v = y * 0.024;
      const relief = n.fbm(u, v, 3);
      const dx = n.fbm(u + 0.06, v, 3) - relief;
      const dy = n.fbm(u, v + 0.06, 3) - relief;
      const strata = Math.sin(y * 0.083 + n.noise(x * 0.009, y * 0.011) * 8);
      const seam = Math.abs(n.noise(x * 0.017 + seed, y * 0.028) - 0.5);
      const grain = n.noise(x * 0.24, y * 0.24) - 0.5;
      let k = 0.32 + relief * 0.4 - dx * 3.7 - dy * 4.2 + strata * 0.046 + grain * 0.07;
      if (seam < 0.013) k *= 0.58;
      const c = palette[Math.round(clamp(k) * 14)];
      // write the 2x2 block, respecting the mask per pixel for crisp edges
      for (let oy = 0; oy < 2 && yy + oy < h; oy++) {
        for (let ox = 0; ox < 2 && xx + ox < w; ox++) {
          const pi = ((yy + oy) * w + (xx + ox)) * 4;
          if (mask[pi + 3] === 0) continue;
          d[pi] = c[0]; d[pi + 1] = c[1]; d[pi + 2] = c[2]; d[pi + 3] = 255;
        }
      }
    }
    if (slice.due()) yield;
  }
  ctx.putImageData(img, x0, y0);
}

export function rockTexture(ctx: CanvasRenderingContext2D, points: readonly Point[], base: string, light: string, seed: number, n: Noise = rockNoise) {
  const painter = rockTextureGen(ctx, points, base, light, seed, n);
  while (!painter.next().done) { /* Complete small static props immediately. */ }
}

const fogCache = new Map<string, HTMLCanvasElement>();
export function pixelGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number) {
  let sprite = cacheGet(fogCache, color);
  if (!sprite) {
    const [c, g] = makeCanvas(64, 64);
    const b = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let yy = 0; yy < 64; yy++) for (let xx = 0; xx < 64; xx++) {
      const d = Math.hypot(xx - 32, yy - 32) / 32;
      const a = Math.max(0, (1 - d) ** 2);
      if (d >= 1) continue;
      g.globalAlpha = Math.floor(a * 7 + b[(yy & 3) * 4 + (xx & 3)] / 16) / 7;
      px(g, xx, yy, 1, 1, color);
    }
    sprite = c;
    cacheSet(fogCache, color, c, 64);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= clamp(alpha);
  ctx.drawImage(sprite, Math.round(x - radius), Math.round(y - radius), Math.round(radius * 2), Math.round(radius * 2));
  ctx.restore();
}

const colorSteps = Uint8Array.from({ length: 256 }, (_, i) => Math.min(255, Math.round(i / 6) * 6));

/** Resolve compositing and anti-aliasing back to the fixed pixel-art color grid. */
export function resolvePixelFrame(ctx: CanvasRenderingContext2D) {
  const frame = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const pixels = frame.data;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = colorSteps[pixels[i]];
    pixels[i + 1] = colorSteps[pixels[i + 1]];
    pixels[i + 2] = colorSteps[pixels[i + 2]];
  }
  ctx.putImageData(frame, 0, 0);
}