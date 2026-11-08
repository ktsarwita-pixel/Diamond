import { clamp, hash, heroRobot, mix, shade } from './cutsceneArt';
import { Job, band, hex3, lerp, makeCanvas, makeNoise, paintPixelsGen, sliceTimer } from './cineKit';
import { isLite, qn } from './quality';
import { ellipse, pixelGlow, pixelLine, polygon, px, rockTextureGen, type Point } from './pixelCraft';

export const CALDERA_W = 1920;
export const CALDERA_H = 960;
export const CALDERA_DURATION = 18;
const W = CALDERA_W, H = CALDERA_H, SEA = 754;
const CORE: Point = [1476, 390];
const HEART_BASE = 610;
const HEART_HEIGHT = 336;
const HEART_ROOT: Point[] = [[1340, 626], [1380, 580], [1428, 560], [1478, 548],
  [1534, 540], [1590, 550], [1626, 576], [1616, 616], [1552, 642], [1462, 650], [1380, 646]];
interface CrystalSpec { x: number; base: number; h: number; w: number; tilt: number; color: string }
const HEART_CRYSTALS: CrystalSpec[] = [
  { x: 1476, base: HEART_BASE, h: HEART_HEIGHT, w: 88, tilt: -6, color: '#ead896' },
  { x: 1402, base: 614, h: 238, w: 58, tilt: -20, color: '#d5c57c' },
  { x: 1548, base: 602, h: 276, w: 64, tilt: 16, color: '#e2ce88' },
  { x: 1596, base: 588, h: 184, w: 42, tilt: 26, color: '#cabb75' },
  { x: 1368, base: 618, h: 150, w: 36, tilt: -30, color: '#bcb060' },
];
for (let row = 0; row < 2; row++) {
  const count = 9 - row * 2;
  for (let i = 0; i < count; i++) {
    const x = 1372 + i * (230 / count) + hash(i * 7 + row) * 8;
    HEART_CRYSTALS.push({
      x, base: 618 - (x - 1476) * 0.08 + row * 5,
      h: 28 + hash(i * 3.1 + row * 41) * (58 + row * 22),
      w: 10 + hash(i + row * 5) * 18, tilt: (x - 1476) * 0.1,
      color: ['#bcb060', '#d5c57c', '#96a161', '#e2ce88'][(i + row) % 4],
    });
  }
}
// The stream skirts the foot of the socket mound; it never paints across a crystal.
const HEART_CHANNEL: Point[] = [[1666, 526], [1620, 543], [1612, 580], [1600, 624],
  [1548, 646], [1462, 652], [1388, 646], [1332, 634], [1261, 632], [1234, 630]];
const HEART_SEAM: Point[] = [[1604, 250], [1560, 320], [1548, 372], [1572, 420],
  [1600, 470], [1612, 520], [1598, 566]];
const PORTAL = {
  x: 60, y: 430, w: 320, h: 280,
  // A front-facing mine portal. CUBE rolls TOWARD the viewer between the two
  // timber legs, then turns right only after his treads are below the footings.
  opening: { x: 180, y: 574, w: 100, h: 88 },
  travelLane: { x: 188, y: 590, w: 84, h: 52 },
  leftJamb: { x: 168, y: 566, w: 12, h: 78 },
  rightJamb: { x: 280, y: 566, w: 12, h: 78 },
  lintel: { x: 164, y: 552, w: 132, h: 14 },
  postBase: 644,
  footings: [{ x: 174, y: 650 }, { x: 286, y: 650 }],
} as const;
const finish = (x: number) => { const t = clamp(x); return t * t * t * (10 + t * (-15 + t * 6)); };
const n = makeNoise(124612);

// The same sampled surface drives both the rock silhouette and tread contact.
function shoreHeight(x: number) {
  return 659 - 28 * finish((x - 260) / 350) + Math.sin(x * 0.014) * 2.5 + n.noise(x * 0.045, 7) * 2.2;
}
const PATH_TOP: Point[] = Array.from({ length: 100 }, (_, i) => {
  const x = -64 + i * 8;
  return [x, shoreHeight(x)] as const;
});
function groundAt(x: number) {
  const f = clamp((x + 64) / 8, 0, PATH_TOP.length - 1.001);
  const i = Math.floor(f);
  return lerp(PATH_TOP[i][1], PATH_TOP[i + 1][1], f - i);
}
const LEDGE: Point[] = [...PATH_TOP,
  [762, 665], [780, 690], [752, 711], [691, 724], [661, 762], [624, 787],
  [604, 836], [559, 862], [536, 925], [502, 1024], [-64, 1024]];
const RIGHT_WALL: Point[] = [[1984, -64], [1708, -64], [1700, 108], [1636, 161],
  [1652, 207], [1550, 246], [1540, 291], [1469, 328], [1481, 375], [1385, 415],
  [1381, 472], [1324, 502], [1341, 555], [1247, 591], [1231, 631], [1236, 675],
  [1251, 708], [1237, 742], [1215, 777], [1166, 818], [1143, 866], [1080, 1024], [1984, 1024]];

function wallEdgeAt(y: number) {
  for (let i = 1; i < RIGHT_WALL.length - 2; i++) {
    const a = RIGHT_WALL[i], b = RIGHT_WALL[i + 1];
    if (y >= a[1] && y <= b[1]) return lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1]));
  }
  return RIGHT_WALL[1][0];
}
function surfaceAt(points: readonly Point[], x: number) {
  let top = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (a[0] === b[0] || x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0])) continue;
    top = Math.min(top, lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])));
  }
  return top;
}
const BENCHES: Point[][] = Array.from({ length: 8 }, (_, i) => {
  const y = 410 + i * 42;
  // Small eroded lips, joined well into the actual wall at this height.
  const x = wallEdgeAt(y) - 4;
  return [[x, y + 7], [x + 28, y], [x + 83, y + 3], [x + 101, y - 5],
    [x + 167, y - 1], [x + 190, y + 11], [x + 149, y + 25], [x + 71, y + 22], [x + 17, y + 29]];
});
function insidePolygon(points: readonly Point[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function ctxAlpha(ctx: CanvasRenderingContext2D, alpha: number, draw: () => void) {
  ctx.save(); ctx.globalAlpha = alpha; draw(); ctx.restore();
}
/** Sparse, broken bedding planes — not continuous stripes across the cave. */
function* beddingGen(ctx: CanvasRenderingContext2D, points: readonly Point[], seed: number, dark: string, light: string): Generator<void, void, unknown> {
  const slice = sliceTimer();
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
  let row = 0;
  for (let y = minY + 18; y < maxY - 8; y += 30, row++) {
    let x = minX + hash(seed + row * 11) * 24;
    while (x < maxX - 12) {
      const len = 18 + hash(seed + row * 7 + x) * 46;
      const gap = 12 + hash(seed + row * 13 + x) * 30;
      const yy = y + Math.sin(x * 0.018 + seed) * 2.5;
      const y2 = y + Math.sin((x + len) * 0.018 + seed) * 2.5;
      if (insidePolygon(points, x, yy) && insidePolygon(points, x + len, y2)) {
        ctxAlpha(ctx, 0.4, () => pixelLine(ctx, [x, yy], [x + len, y2], row % 3 === 0 ? light : dark, 1));
      }
      x += len + gap;
    }
    if (slice.due()) yield;
  }
  for (let i = 0; i < 4; i++) {
    let x = minX + hash(seed + i * 13) * (maxX - minX);
    let y = minY + hash(seed + i * 7) * (maxY - minY) * 0.5;
    let prev: Point | null = null;
    for (let k = 0; k < 12; k++) {
      x += (hash(seed + i * 31 + k) - 0.5) * 9;
      y += 9 + hash(seed + k) * 9;
      if (insidePolygon(points, x, y)) {
        if (prev) ctxAlpha(ctx, 0.5, () => pixelLine(ctx, prev!, [x, y], dark, 1));
        prev = [x, y];
      } else prev = null;
    }
  }
}
function ceilingAt(x: number) {
  const side = 220 * Math.exp(-Math.max(0, x) / 185) + 115 * Math.exp(-Math.max(0, W - x) / 130);
  const folds = n.fbm(x * 0.012, 4, 3) * 48;
  const tooth = Math.max(0, Math.sin(x * 0.031 + n.noise(x * 0.01, 3) * 3)) ** 8 * 52;
  return 24 + side + folds + tooth;
}
const CEILING: Point[] = [[-64, -64], [1984, -64],
  ...Array.from({ length: 257 }, (_, i) => {
    const x = 1984 - i * 8;
    return [x, ceilingAt(x)] as Point;
  })];

/** Entire irregular contours, including a rounded base, replace rectangular rubble. */
function stone(cx: number, base: number, rx: number, ry: number, seed: number): Point[] {
  return Array.from({ length: 13 }, (_, i) => {
    const a = i / 13 * Math.PI * 2;
    const r = 0.84 + hash(seed + i * 4.7) * 0.16;
    return [cx + Math.cos(a) * rx * r, base - ry + Math.sin(a) * ry * r] as Point;
  });
}
const TALUS = Array.from({ length: 23 }, (_, i) => {
  const bench = BENCHES[i % BENCHES.length];
  const x = bench[0][0] + 46 + hash(i * 4.7) * 99;
  const raw = stone(x, 0, 8 + hash(i) * 14, 6 + hash(i * 3) * 12, i + 92);
  const foot = raw.reduce((a, b) => b[1] > a[1] ? b : a);
  const supportY = surfaceAt(bench, foot[0]);
  // Bury the lowest contour point one pixel in its supporting bench. No
  // guessed diagonal slope, air gap, or disconnected boulder placement.
  const shift = supportY + 1 - foot[1];
  const points = raw.map(([px0, py]) => [px0, py + shift] as Point);
  return { x, points, contact: [foot[0], supportY + 1] as Point, supportY, bench: i % BENCHES.length };
});
export const riftGeometry = {
  ledge: LEDGE, rightWall: RIGHT_WALL, ceiling: CEILING,
  boulders: TALUS.map((s) => s.points), waterline: SEA, benches: BENCHES,
  boulderSupports: TALUS.map(({ contact, supportY, bench }) => ({ contact, supportY, bench })),
  portal: PORTAL,
  heart: {
    root: HEART_ROOT, seam: HEART_SEAM, channel: HEART_CHANNEL,
    crystals: HEART_CRYSTALS.map(c => ({ ...c, footprint: [
      [c.x - c.w * 0.48, c.base + 2], [c.x + c.w * 0.48, c.base + 2], [c.x, c.base + 2],
    ] as Point[] })),
  },
};
export function calderaWalkerAt(t: number) {
  const exit = finish((t - 0.6) / 2.6);
  const advance = finish((t - 4.4) / 4.4);
  const x = lerp(230, 622, advance);
  const mouthY = PORTAL.opening.y + PORTAL.opening.h;
  const exitY = lerp(632, mouthY, exit);
  const deck = advance === 0 ? exitY : lerp(mouthY, groundAt(x), finish((x - 230) / 80));
  const s = lerp(1.25, 1.7, exit) + 0.15 * finish(advance * 3);
  const inFront = exit >= 1; // latch: once closer than the footings, stay in front
  const phase = t < 0.6 ? 'inside' : t < 3.2 ? 'exit' : t < 4.4 ? 'scan' : 'advance';
  return {
    x, deck, s, travel: (x - 230) / (622 - 230), rollOut: exit, overlook: advance,
    inFront, phase, supported: exit < 1 || Math.abs(deck - groundAt(x)) < 6,
  };
}
export function riftCameraAt(t: number) {
  const follow = finish((t - 3.2) / 5.6);
  const reveal = finish((t - 7.8) / 6.8);
  const awe = finish((t - 12.8) / 4.4);
  return {
    x: lerp(lerp(lerp(300, 629, follow), 970, reveal), 1128, awe),
    y: lerp(lerp(lerp(565, 538, follow), 471, reveal), 452, awe),
    zoom: lerp(lerp(lerp(1.2, 0.86, follow), 0.39, reveal), 0.5, awe),
  };
}

function crystal(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, w: number, tilt: number, color: string) {
  const tip: Point = [x + tilt, base - h];
  const left: Point = [x - w * 0.5, base - h * 0.68];
  const right: Point = [x + w * 0.5, base - h * 0.73];
  polygon(ctx, [[x - w * 0.48, base + 2], left, tip, right, [x + w * 0.48, base + 2]], '#17231c');
  polygon(ctx, [[x - w * 0.44, base], [left[0] + 1, left[1]], tip, [x + w * 0.09, base]], shade(color, 0.15));
  polygon(ctx, [[x + w * 0.09, base], tip, [right[0] - 1, right[1]], [x + w * 0.43, base]], shade(color, -0.3));
  pixelLine(ctx, [left[0] + 2, left[1] + 1], tip, shade(color, 0.5));
  for (let j = 0; j < 4; j++) pixelLine(ctx, [x - w * 0.3, base - h * (0.2 + j * 0.12)],
    [x + w * 0.26, base - h * (0.21 + j * 0.12)], shade(color, -0.13));
}

interface Cascade { x: number; y: number; w: number; bottom: number; }
const CASCADES: Cascade[] = [
  { x: 1214, y: 630, w: 17, bottom: SEA + 1 },
  { x: 1656, y: 368, w: 20, bottom: 526 },
];
/** Scene-12 limestone: bedding planes, staggered joints, pitting and edge AO.
 * This replaces the cloudy generic noise for the host rock only. */
function* limestoneGen(
  ctx: CanvasRenderingContext2D, points: readonly Point[], seed: number,
  darkC: string, baseC: string, lightC: string,
): Generator<void, void, unknown> {
  const slice = sliceTimer();
  const x0 = Math.max(0, Math.floor(Math.min(...points.map(p => p[0]))) - 2);
  const x1 = Math.min(ctx.canvas.width, Math.ceil(Math.max(...points.map(p => p[0]))) + 3);
  const y0 = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))) - 2);
  const y1 = Math.min(ctx.canvas.height, Math.ceil(Math.max(...points.map(p => p[1]))) + 3);
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  const [, mctx] = makeCanvas(w, h);
  mctx.translate(-x0, -y0); polygon(mctx, points, '#ffffff');
  const mask = mctx.getImageData(0, 0, w, h).data;
  const img = ctx.getImageData(x0, y0, w, h);
  const d = img.data;
  const dark = hex3(darkC), base = hex3(baseC), light = hex3(lightC);
  const solid = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && mask[(yy * w + xx) * 4 + 3] > 0;
  for (let yy = 0; yy < h; yy++) {
    const y = y0 + yy;
    for (let xx = 0; xx < w; xx++) {
      const mi = (yy * w + xx) * 4;
      if (mask[mi + 3] === 0) continue;
      const x = x0 + xx;
      const relief = n.fbm(x * 0.016 + seed, y * 0.018, 3);
      const fine = n.noise(x * 0.11 + seed, y * 0.11) - 0.5;
      const bed = Math.sin(y * 0.065 + n.noise(x * 0.006, y * 0.01 + seed) * 7);
      // Broken bedding seams and irregular fractures, not a regular brick grid.
      const bedSeam = Math.abs(bed) > 0.96 && n.noise(x * 0.018 + seed, y * 0.004) > 0.42 ? 0.18 : 0;
      const fracture = Math.abs(n.noise(x * 0.025 + seed, y * 0.012) - 0.5) < 0.012 && n.noise(x * 0.005, y * 0.02) > 0.5 ? 0.16 : 0;
      const pit = n.noise(x * 0.35 + seed, y * 0.35) > 0.84 ? 0.08 : 0;
      let k = 0.34 + relief * 0.3 + bed * 0.05 + fine * 0.06 - bedSeam - fracture - pit;
      // Edge ambient occlusion + a thin top light on broken faces.
      if (!solid(xx - 3, yy) || !solid(xx + 3, yy) || !solid(xx, yy - 3) || !solid(xx, yy + 3)) k *= 0.72;
      if (!solid(xx, yy - 3)) k += 0.1;
      k = clamp(k);
      const c = k < 0.5
        ? [dark[0] + (base[0] - dark[0]) * k * 2, dark[1] + (base[1] - dark[1]) * k * 2, dark[2] + (base[2] - dark[2]) * k * 2]
        : [base[0] + (light[0] - base[0]) * (k - 0.5) * 2, base[1] + (light[1] - base[1]) * (k - 0.5) * 2, base[2] + (light[2] - base[2]) * (k - 0.5) * 2];
      d[mi] = c[0]; d[mi + 1] = c[1]; d[mi + 2] = c[2]; d[mi + 3] = 255;
    }
    if (slice.due()) { ctx.putImageData(img, x0, y0); yield; }
  }
  ctx.putImageData(img, x0, y0);
}

/** Rough-hewn, wet mine timber. Contours are irregular; grain/straps carry load. */
function timberPost(ctx: CanvasRenderingContext2D, x: number, seed: number) {
  polygon(ctx, [[x - 1, 135], [x + 12, 133], [x + 13, 215], [x, 217]], '#120d08');
  polygon(ctx, [[x, 136], [x + 10, 134], [x + 11, 214], [x + 1, 215]], '#3b2c1e');
  polygon(ctx, [[x + 1, 136], [x + 3, 135], [x + 3, 214], [x + 1, 215]], '#6b5136');
  polygon(ctx, [[x + 8, 135], [x + 10, 134], [x + 11, 214], [x + 9, 214]], '#241a10');
  ctxAlpha(ctx, 0.65, () => {
    for (let i = 0; i < 4; i++) {
      const gx = x + 3 + i * 2 + hash(seed + i) * 1.5;
      pixelLine(ctx, [gx, 140 + hash(seed + i * 3) * 8], [gx + (hash(seed + i * 7) - 0.5) * 2, 208], i % 2 ? '#241a10' : '#5a422a', 1);
    }
  });
  ellipse(ctx, x + 5 + hash(seed) * 2, 166 + hash(seed * 3) * 10, 1.6, 2.4, '#1a130d');
  ellipse(ctx, x + 6, 192 + hash(seed * 5) * 8, 1.2, 1.8, '#241a10');
  for (const y of [140, 206]) {
    polygon(ctx, [[x - 1, y], [x + 12, y - 1], [x + 12, y + 3], [x - 1, y + 4]], '#181c22');
    pixelLine(ctx, [x, y + 1], [x + 11, y], '#4b5563', 1);
    px(ctx, x + 2, y + 1, 1, 1, '#9ca3af'); px(ctx, x + 9, y + 1, 1, 1, '#9ca3af');
  }
}
function timberLintel(ctx: CanvasRenderingContext2D) {
  polygon(ctx, [[102, 121], [238, 119], [240, 135], [104, 137]], '#120d08');
  polygon(ctx, [[104, 122], [236, 120], [237, 133], [105, 135]], '#3b2c1e');
  polygon(ctx, [[105, 122], [236, 120], [236, 123], [105, 125]], '#6b5136');
  polygon(ctx, [[105, 132], [237, 130], [237, 133], [105, 135]], '#241a10');
  ctxAlpha(ctx, 0.6, () => {
    pixelLine(ctx, [110, 127], [232, 125], '#241a10', 1);
    pixelLine(ctx, [112, 130], [230, 128], '#5a422a', 1);
  });
  // End grain + iron bolts, not a clean orange rectangle.
  polygon(ctx, [[232, 121], [238, 120], [239, 134], [233, 134]], '#2a1e14');
  pixelLine(ctx, [234, 123], [237, 132], '#6b5136', 1);
  for (const x of [112, 168, 224]) { px(ctx, x, 123, 2, 10, '#181c22'); px(ctx, x, 124, 1, 1, '#9ca3af'); }
}
function timberBrace(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
  pixelLine(ctx, a, b, '#120d08', 5);
  pixelLine(ctx, a, b, '#3b2c1e', 3);
  pixelLine(ctx, [a[0], a[1] - 1], [b[0], b[1] - 1], '#6b5136', 1);
  px(ctx, a[0] - 1, a[1] - 1, 2, 2, '#181c22'); px(ctx, b[0] - 1, b[1] - 1, 2, 2, '#181c22');
}

interface RiftLayers {
  distant: HTMLCanvasElement;
  geology: HTMLCanvasElement;
  ledge: HTMLCanvasElement;
  foreground: HTMLCanvasElement;
  reflection: HTMLCanvasElement;
  mist: HTMLCanvasElement;
  portalBack: HTMLCanvasElement;
  portalFront: HTMLCanvasElement;
}

export const calderaJob = new Job(function* (): Generator<unknown, RiftLayers, unknown> {
  const slice = sliceTimer();
  const [distant, d] = makeCanvas(W, H);
  const [low, l] = makeCanvas(W / 2, H / 2);
  const dark = hex3('#0a141a'), light = hex3('#24343a'), warm = hex3('#6a5f3c');
  yield* paintPixelsGen(l, 0, 0, W / 2, H / 2, (hx, hy, o) => {
    const x = hx * 2, y = hy * 2;
    const texture = n.fbm(x * 0.004, y * 0.007, 3);
    const k = 0.1 + band(texture, 8, hx, hy) * 0.52;
    const heat = Math.max(0, 1 - Math.hypot((x - CORE[0]) * 0.9, y - CORE[1]) / 660) * 0.2;
    for (let c = 0; c < 3; c++) {
      const v = dark[c] + (light[c] - dark[c]) * k;
      o[c] = v + (warm[c] - v) * heat;
    }
    o[3] = 255;
  });
  d.drawImage(low, 0, 0, W, H);
  // A far limestone wall closes the chamber instead of an open gradient void.
  const FAR_WALL: Point[] = [[-64, 280], [180, 250], [420, 316], [650, 276], [900, 336],
    [1180, 296], [1460, 356], [1720, 316], [1984, 340], [1984, 820], [-64, 820]];
  yield* limestoneGen(d, FAR_WALL, 201, '#070e12', '#141f24', '#2c3a3c');
  yield* beddingGen(d, FAR_WALL, 201, '#0a1216', '#233034');
  for (let i = 0; i < 18; i++) {
    const x = 40 + i * 108 + hash(i * 5) * 40;
    const y = surfaceAt(FAR_WALL, x);
    const len = 18 + hash(i * 3) * 46, w = 4 + hash(i) * 8;
    polygon(d, [[x - w, y - 2], [x + w, y - 2], [x + w * 0.3, y + len * 0.6], [x, y + len], [x - w * 0.3, y + len * 0.55]], '#0c161c');
  }

  // Flowstone buttresses fuse into the roof and pass below the waterline.
  for (const [ci, center, half] of [[0, 115, 128], [1, 523, 103], [2, 906, 75], [3, 1824, 113]]) {
    const centerline = new Float32Array(H), radius = new Float32Array(H);
    let left = W, right = 0;
    for (let y = 0; y < H; y++) {
      const f = y / (SEA + 70);
      centerline[y] = center + Math.sin(f * 4 + ci) * half * 0.16 + n.noise(y * 0.008, ci) * 9
        + n.ridged(y * 0.02, ci * 3 + 5, 2) * 6;
      // Flowstone buttresses: irregular erosion, slight bedding terraces, and a
      // widened root instead of smooth extruded cylinders.
      radius[y] = half * (0.45 + 0.22 * n.fbm(y * 0.01, ci + 13, 3)
        + n.ridged(y * 0.018, ci * 3 + 5, 3) * 0.16 + Math.sin(y * 0.055 + ci) * 0.035
        + Math.exp(-f * 9) * 1.15 + Math.exp(-Math.abs(1 - f) * 8) * 0.82);
      left = Math.min(left, centerline[y] - radius[y]);
      right = Math.max(right, centerline[y] + radius[y]);
    }
    const x0 = Math.max(0, Math.floor(left) - 3), x1 = Math.min(W, Math.ceil(right) + 3);
    const deep = hex3('#101f26'), lit = hex3('#51605a');
    yield* paintPixelsGen(d, x0, 0, x1 - x0, H, (x, y, o) => {
      const q = (x - centerline[y]) / radius[y];
      if (Math.abs(q) > 1) return;
      const flutes = n.fbm(x * 0.045 + ci * 7, y * 0.004, 3);
      const fracture = Math.abs(n.noise(x * 0.09, y * 0.002 + ci) - 0.5) < 0.018 ? -0.16 : 0;
      const lambert = clamp(0.24 + Math.sqrt(Math.max(0, 1 - q * q)) * 0.38 + q * 0.18 + (flutes - 0.5) * 0.62 + fracture);
      const k = band(lambert, 9, x, y);
      for (let c = 0; c < 3; c++) o[c] = deep[c] + (lit[c] - deep[c]) * k * 0.52;
      o[3] = 255;
    });
  }

  const [geology, g] = makeCanvas(W, H);
  yield* limestoneGen(g, RIGHT_WALL, 61, '#1c2226', '#343b3c', '#9a9382');
  yield* beddingGen(g, RIGHT_WALL, 61, '#1c2226', '#6f6a58');
  // Local sulfur staining follows the vein; the host limestone stays neutral.
  ctxAlpha(g, 0.18, () => { ellipse(g, 1580, 470, 90, 160, '#8a7a3a'); ellipse(g, 1500, 590, 150, 46, '#7a6a34'); });
  // Eroded benches belong to the same cliff, not disconnected floating slabs.
  for (let i = 0; i < BENCHES.length; i++) {
    const profile = BENCHES[i];
    const [x, lipY] = profile[0];
    yield* rockTextureGen(g, profile, '#3a4b42', '#a8aa79', 90 + i);
    pixelLine(g, [x + 22, lipY - 3], [x + 81, lipY], '#c0b471', 2);
    if (slice.due()) yield;
  }
  // Talus sits behind the mineral shelf so boulders never occlude the Heart.
  for (const s of TALUS) yield* rockTextureGen(g, s.points, '#34423a', '#8d9277', Math.round(s.x));
  const bed: Point[] = [[1330, 593], [1362, 571], [1402, 568], [1440, 550], [1489, 553],
    [1531, 535], [1584, 546], [1607, 568], [1554, 596], [1450, 630], [1352, 623]];
  yield* rockTextureGen(g, bed, '#616344', '#cab776', 117);
  // The Heart of Sulfur is a wall-rooted megacluster, not a small shelf prop.
  // Its socket mound overlaps the bed and host wall so the geology stays connected.
  yield* rockTextureGen(g, HEART_ROOT, '#6b6747', '#d6c481', 118);
  // Vein and stream are painted into the host rock BEFORE the crystals, so no
  // surface line can noclip across a crystal face. The stream also stays below
  // every crystal foot by construction (HEART_CHANNEL).
  for (let i = 1; i < HEART_SEAM.length; i++) {
    pixelLine(g, HEART_SEAM[i - 1], HEART_SEAM[i], '#182d2c', 5);
    pixelLine(g, [HEART_SEAM[i - 1][0] + 1, HEART_SEAM[i - 1][1]], [HEART_SEAM[i][0] + 1, HEART_SEAM[i][1]], '#c8ad61', 2);
  }
  const channels: Point[][] = [HEART_CHANNEL, [[1745, 294], [1707, 327], [1690, 346], [1666, 368]]];
  for (const route of channels) {
    for (let i = 1; i < route.length; i++) {
      pixelLine(g, route[i - 1], route[i], '#203b37', 8);
      pixelLine(g, route[i - 1], route[i], '#92a77a', 3);
      pixelLine(g, route[i - 1], route[i], '#d9d8a2');
    }
  }
  polygon(g, [[1639, 524], [1661, 520], [1686, 525], [1679, 534], [1649, 533]], '#31574b');
  pixelLine(g, [1645, 524], [1678, 526], '#bdcfa0');
  for (let i = 0; i < HEART_CRYSTALS.length; i++) {
    const c = HEART_CRYSTALS[i];
    // A dark socket collar seats each foot into the mound instead of letting it
    // hover on the rock surface or slice through an unbroken face.
    ellipse(g, c.x, c.base + 2, c.w * 0.62, 4, '#41452e');
    crystal(g, c.x, c.base, c.h, c.w, c.tilt, c.color);
    if (i % 4 === 0) yield;
  }
  // A bright inner facet makes the central crystal read as a glowing heart.
  pixelLine(g, [1476, HEART_BASE - 18], [1470, HEART_BASE - HEART_HEIGHT + 26], '#fff2c2', 2);
  pixelLine(g, [1458, HEART_BASE - 40], [1466, HEART_BASE - HEART_HEIGHT + 60], '#f7e6a8');
  yield;

  const [ledge, path] = makeCanvas(W, H);
  yield* limestoneGen(path, LEDGE, 125, '#171d20', '#2c3336', '#8f8a78');
  yield* beddingGen(path, LEDGE, 125, '#171d20', '#6a6656');
  // A walkable top surface, not a vertical wall painted like a floor.
  const SURFACE: Point[] = [...PATH_TOP, ...[...PATH_TOP].reverse().map(([x, y]) => [x, y + 18] as Point)];
  yield* limestoneGen(path, SURFACE, 126, '#2a2a24', '#4a4a40', '#b0a88e');
  for (let i = 0; i < 26; i++) {
    const x = -20 + i * 29 + hash(i * 3) * 12;
    const y = groundAt(x) + 4 + hash(i) * 9;
    pixelLine(path, [x, y], [x + 8 + hash(i * 7) * 10, y + (hash(i * 5) - 0.5) * 3], '#2a2a24', 1);
  }
  for (let i = 1; i < PATH_TOP.length; i++) {
    const a = PATH_TOP[i - 1], b = PATH_TOP[i];
    pixelLine(path, a, b, '#c2bca4', 2);
    pixelLine(path, [a[0], a[1] + 3], [b[0], b[1] + 3], '#3a3f38', 2);
  }
  for (let i = 0; i < 14; i++) {
    const x = 25 + i * 43 + hash(i) * 10;
    const y = groundAt(x) + 38 + hash(i * 3) * 24;
    yield* rockTextureGen(path, stone(x, y, 5 + hash(i) * 8, 4 + hash(i * 3) * 6, i + 5), '#20373c', '#7f927d', i + 141);
  }

  // Natural limestone mouth. The timber set is RECESSED in the tunnel shadow;
  // the foreground layer is only rock, stone footings and the threshold slab.
  const [portalBack, pb] = makeCanvas(PORTAL.w, PORTAL.h);
  polygon(pb, [[118, 232], [118, 128], [222, 128], [222, 232]], '#050a0d');
  polygon(pb, [[118, 232], [222, 232], [204, 208], [136, 208]], '#141a1c');
  for (const y of [214, 222, 230]) {
    const k = (y - 208) / 24;
    pixelLine(pb, [136 - k * 8, y], [204 + k * 8, y], '#2a2118', 2);
  }
  pixelLine(pb, [140, 232], [160, 208], '#3a2f24', 2);
  pixelLine(pb, [200, 232], [180, 208], '#3a2f24', 2);
  pixelLine(pb, [141, 232], [161, 208], '#6b5136', 1);
  pixelLine(pb, [199, 232], [179, 208], '#6b5136', 1);
  // Rough timbers just inside the mouth, dimmed by the rock lip.
  ctxAlpha(pb, 0.8, () => { timberPost(pb, 118, 11); timberPost(pb, 220, 29); timberLintel(pb); });
  ctxAlpha(pb, 0.65, () => { timberBrace(pb, [126, 138], [140, 152]); timberBrace(pb, [224, 138], [210, 152]); });
  for (let i = 0; i < 3; i++) {
    const inset = 10 + i * 10, yTop = 140 + i * 7, yBot = 230 - i * 5;
    ctxAlpha(pb, 0.4 - i * 0.1, () => {
      px(pb, 118 + inset, yTop, 3, yBot - yTop, '#2a2118');
      px(pb, 222 - inset - 3, yTop, 3, yBot - yTop, '#2a2118');
      px(pb, 118 + inset, yTop - 3, 104 - inset * 2, 3, '#2a2118');
    });
  }
  const [portalFront, pf] = makeCanvas(PORTAL.w, PORTAL.h);
  const LEFT_MASS: Point[] = [[0, 236], [0, 150], [30, 108], [70, 84], [104, 96], [118, 128], [118, 236]];
  const RIGHT_MASS: Point[] = [[222, 128], [244, 104], [272, 86], [304, 118], [320, 160], [320, 236], [222, 236]];
  const TOP_ARCH: Point[] = [[70, 84], [110, 50], [178, 44], [232, 64], [272, 86], [244, 104], [222, 128], [118, 128], [104, 96]];
  yield* limestoneGen(pf, LEFT_MASS, 126, '#171d20', '#2c3336', '#8f8a78');
  yield* limestoneGen(pf, RIGHT_MASS, 127, '#171d20', '#2c3336', '#8f8a78');
  yield* limestoneGen(pf, TOP_ARCH, 128, '#171d20', '#2c3336', '#8f8a78');
  yield* beddingGen(pf, LEFT_MASS, 126, '#171d20', '#6a6656');
  yield* beddingGen(pf, RIGHT_MASS, 127, '#171d20', '#6a6656');
  yield* beddingGen(pf, TOP_ARCH, 128, '#171d20', '#6a6656');
  // Rock lip shadows the recessed timber; no bright frame slapped on the face.
  ctxAlpha(pf, 0.55, () => { polygon(pf, [[118, 128], [222, 128], [222, 136], [118, 136]], '#050a0d'); });
  yield* limestoneGen(pf, [[100, 228], [103, 214], [123, 214], [126, 228]], 129, '#2a2a24', '#3a3f38', '#9a9382');
  yield* limestoneGen(pf, [[214, 228], [217, 214], [237, 214], [240, 228]], 130, '#2a2a24', '#3a3f38', '#9a9382');
  yield* limestoneGen(pf, [[112, 232], [228, 232], [236, 240], [104, 240]], 131, '#2a2a24', '#4a4a40', '#b0a88e');
  yield;

  const [foreground, f] = makeCanvas(W, H);
  yield* limestoneGen(f, CEILING, 151, '#050e12', '#0a161c', '#3a4a44');
  yield* beddingGen(f, CEILING, 151, '#050e12', '#2a3a34');
  // Dripstone is fused to the ceiling contour, not floating icicles.
  for (const [x, len, w] of [[250, 46, 12], [650, 62, 16], [1050, 38, 10], [1450, 70, 18]]) {
    const y = ceilingAt(x);
    polygon(f, [[x - w, y - 4], [x + w, y - 4], [x + w * 0.35, y + len * 0.55], [x, y + len], [x - w * 0.3, y + len * 0.6]], '#0a2029');
    pixelLine(f, [x - w * 0.4, y], [x - 1, y + len * 0.8], '#2e4a44', 1);
  }
  yield* rockTextureGen(f, [[-64, 864], [19, 860], [60, 868], [96, 895], [142, 897],
    [190, 935], [226, 960], [283, 1024], [-64, 1024]], '#071c25', '#536b5d', 154);
  yield* rockTextureGen(f, [[1623, 1024], [1660, 932], [1706, 907], [1748, 839],
    [1791, 831], [1854, 752], [1910, 728], [1984, 700], [1984, 1024]], '#091e26', '#49685b', 159);

  const [reflection, r] = makeCanvas(720, 220);
  r.translate(0, 220); r.scale(1, -1); r.globalAlpha = 0.36;
  r.drawImage(geology, 1050, 240, 720, 514, 0, 0, 720, 220);
  const [mist, mg] = makeCanvas(128, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 128; x++) {
    const q = ((x - 64) / 64) ** 2 + ((y - 16) / 16) ** 2;
    if (q >= 1) continue;
    mg.globalAlpha = Math.round((1 - q) * (0.25 + n.noise(x * 0.06, y * 0.1) * 0.4) * 5) / 5;
    px(mg, x, y, 1, 1, '#bbd1ba');
  }
  return { distant, geology, ledge, foreground, reflection, mist, portalBack, portalFront };
});

export function getCaldera() { return calderaJob.get(); }

const WATER_RAMP = Array.from({ length: 124 }, (_, y) => mix('#31514b', '#061820', finish(y / 124)));
function water(ctx: CanvasRenderingContext2D, t: number, layers: RiftLayers) {
  for (let y = SEA; y < H; y += 2) px(ctx, 0, y, W, 2, WATER_RAMP[Math.min(123, Math.floor((y - SEA) * 0.6))]);
  ctx.save(); ctx.globalAlpha = 0.46;
  for (let y = 0; y < 200; y += isLite() ? 8 : 4) {
    const off = Math.sin(t * 1.2 + y * 0.22) * (1 + y * 0.032);
    ctx.drawImage(layers.reflection, 0, y, 720, 3, 1050 + off, SEA + y, 720, 3);
  }
  ctx.restore();
  // Short irregular highlights, not full-width stripes.
  for (let i = 0; i < qn(55, 0.4); i++) {
    const depth = hash(i * 4.1);
    const x = 150 + ((hash(i) * 1650 + t * (2 + depth * 5)) % 1650);
    const y = SEA + 6 + depth * 176;
    px(ctx, x + Math.sin(t * 1.6 + i) * 3, y, 6 + depth * 30, 1,
      i % 6 === 0 ? '#a7bf95' : i % 2 ? '#6a9275' : '#315c59');
  }
  for (let i = 0; i < 26; i++) {
    const x = 1100 + hash(i) * 600, y = SEA + 3 + hash(i * 3.3) * 9;
    if (Math.sin(t * 1.7 + i) > 0.56) px(ctx, x, y, 3 + i % 4, 1, '#e0dfb3');
  }
  // Broken golden reflection directly beneath the Heart.
  for (let i = 0; i < 18; i++) {
    const a = (1 - i / 18) * (0.16 + 0.05 * Math.sin(t * 1.3 + i));
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    px(ctx, CORE[0] - 14 + Math.sin(t * 1.1 + i * 0.7) * (4 + i), SEA + 8 + i * 8, 28 - i, 1, '#e6d9a0');
    ctx.restore();
  }
}

function cascade(ctx: CanvasRenderingContext2D, f: Cascade, t: number, seed: number, mist: HTMLCanvasElement) {
  const height = f.bottom - f.y;
  px(ctx, f.x - 3, f.y - 3, f.w + 6, 3, '#415b48');
  px(ctx, f.x, f.y - 1, f.w, 2, '#d3dfb1');
  // A contiguous sheet fans outward from a single rock-bound lip.
  for (let yy = 0; yy < height; yy += 3) {
    const k = yy / height, spread = k * f.w * 0.13;
    const wobble = Math.sin(t * 1.6 + yy * 0.08 + seed) * k;
    px(ctx, f.x - spread + wobble, f.y + yy, f.w + spread * 2, 3, '#7fa580');
    px(ctx, f.x + f.w * 0.25 + wobble, f.y + yy, f.w * 0.52, 3, '#b8cca0');
  }
  for (let i = 0; i < (isLite() ? 6 : 13); i++) {
    const age = (t * 0.52 + hash(i * 3 + seed)) % 1, y = age * age * height;
    const x = f.x + hash(i * 7 + seed) * f.w + Math.sin(t + i) * age * 1.4;
    px(ctx, x, f.y + y, 1, Math.min(height - y, 3 + age * 15), '#e4ead0');
  }
  for (let i = 0; i < 6; i++) px(ctx, f.x - 10 + i * (f.w + 20) / 6,
    f.bottom - 2 + Math.sin(t * 3 + i), 5, 2, '#dbe5c2');
  for (let i = 0; i < 3; i++) {
    const age = (t * 0.3 + i / 3) % 1;
    ctx.save(); ctx.globalAlpha = (1 - age) * 0.27;
    const radius = 9 + age * 36;
    for (let k = 0; k <= 10; k++) {
      const x = -radius + k * radius / 5;
      const y = Math.sqrt(Math.max(0, 1 - (x / radius) ** 2)) * radius * 0.13;
      px(ctx, f.x + f.w / 2 + x, f.bottom + y, 3, 1, '#b9cfa6');
    }
    ctx.drawImage(mist, f.x + f.w / 2 - 38 - age * 25, f.bottom - 18 - age * 34, 76 + age * 50, 22 + age * 22);
    ctx.restore();
  }
}

function renderFallback(ctx: CanvasRenderingContext2D, t: number) {
  px(ctx, 0, 0, 640, 360, '#0a222d');
  pixelGlow(ctx, 495, 190, 180, '#a7a76b', 0.12 + Math.sin(t) * 0.015);
  polygon(ctx, [[0, 256], [110, 261], [190, 265], [260, 257], [320, 278], [305, 360], [0, 360]], '#304b4b');
  heroRobot(ctx, { x: 130, y: 261 - 15 * 2, s: 2, t, state: 'idle', eye: 'scan', drillAngle: 0.1, drillSpin: 0, paintMix: 1 });
}

export function drawCalderaScene(ctx: CanvasRenderingContext2D, t: number) {
  const layers = calderaJob.peek();
  if (!layers) { renderFallback(ctx, t); return; }
  const cam = riftCameraAt(t), walker = calderaWalkerAt(t);
  const halfWidth = 320 / cam.zoom;
  ctx.save();
  ctx.translate(320, 180); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);
  ctx.drawImage(layers.distant, 0, 0);
  water(ctx, t, layers);
  ctx.drawImage(layers.geology, 0, 0);
  const reveal = finish((t - 5.2) / 9.4);
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.15);
  pixelGlow(ctx, CORE[0], CORE[1] + 90, 360, '#d3bc69', 0.14 + reveal * 0.08);
  pixelGlow(ctx, CORE[0], CORE[1] + 40, 190, '#e5ce83', 0.24 + pulse * 0.07);
  pixelGlow(ctx, CORE[0], CORE[1] - 60, 96, '#f4e2a0', 0.26 + pulse * 0.1);
  // Slow volumetric shafts and rising sulfur embers sell the scale of the Heart.
  if (!isLite()) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = -2.35 + i * 0.34 + Math.sin(t * 0.22 + i) * 0.025;
      const len = 460 + i * 40, spread = 0.05 + i * 0.012;
      ctx.globalAlpha = reveal * (0.035 + 0.015 * Math.sin(t * 0.7 + i));
      polygon(ctx, [[CORE[0], CORE[1] + 20],
        [CORE[0] + Math.cos(a - spread) * len, CORE[1] + 20 + Math.sin(a - spread) * len],
        [CORE[0] + Math.cos(a + spread) * len, CORE[1] + 20 + Math.sin(a + spread) * len]], '#e8d79a');
    }
    ctx.restore();
  }
  for (let i = 0; i < qn(28, 0.4); i++) {
    const age = (t * 0.16 + hash(i * 3.7)) % 1;
    const x = CORE[0] + (hash(i) - 0.5) * 280 + Math.sin(t * 0.9 + i) * 9;
    const y = CORE[1] + 150 - age * 330;
    ctx.save(); ctx.globalAlpha = (1 - age) * (0.2 + reveal * 0.35);
    px(ctx, x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1, '#f5e6b0');
    ctx.restore();
  }
  for (const [vx, vy, ph] of [[1598, 566, 0], [1612, 520, 1.4], [1600, 470, 2.8]]) {
    pixelGlow(ctx, vx, vy, 26, '#e9d68f', 0.1 + 0.12 * Math.max(0, Math.sin(t * 1.15 + ph)));
  }
  for (let i = 0; i < CASCADES.length; i++) {
    const f = CASCADES[i];
    if (f.x >= cam.x - halfWidth - 60 && f.x <= cam.x + halfWidth + 60) cascade(ctx, f, t, i + 2, layers.mist);
  }
  for (let i = 0; i < qn(10, 0.4); i++) {
    const x = 400 + ((hash(i * 2.3) * 1350 + t * 4) % 1350), y = SEA - 34 + hash(i) * 32;
    ctx.save(); ctx.globalAlpha = 0.035 + (i % 3) * 0.015;
    ctx.drawImage(layers.mist, x - 70, y, 140 + i % 3 * 30, 22);
    ctx.restore();
  }
  ctx.drawImage(layers.ledge, 0, 0);
  ctx.drawImage(layers.portalBack, PORTAL.x, PORTAL.y);

  const s = walker.s;
  const supportY = walker.deck;
  const drawWalker = () => {
    ellipse(ctx, walker.x, supportY + 1, 15 * s, 2, 'rgba(2,12,17,0.5)');
    heroRobot(ctx, {
      x: walker.x, y: supportY - 15 * s - 0.55, s, t,
      state: t < 9.6 ? 'idle' : 'happy', chassisMotion: false, paintMix: 1,
      drill: true, drillAngle: 0.22, drillExtend: 0.12,
      drillSpin: 0, wheelPhase: walker.travel * 24, eye: t > 9.6 ? 'normal' : 'scan', look: 1,
    });
    const bx = walker.x + 4 * s, by = supportY - 27 * s;
    ctx.save(); ctx.globalAlpha = 0.08;
    polygon(ctx, [[bx, by], [bx + 170, by - 32], [bx + 170, by + 18]], '#e0e9cd');
    ctx.restore();
    pixelGlow(ctx, bx, by, 24, '#e2eccb', 0.28);
  };
  // Inside/exit: rig is behind the timber frame. Once his treads are below the
  // footings he is closer to camera, so he passes IN FRONT of the right leg.
  if (!walker.inFront) {
    drawWalker();
    ctx.drawImage(layers.portalFront, PORTAL.x, PORTAL.y);
  } else {
    ctx.drawImage(layers.portalFront, PORTAL.x, PORTAL.y);
    drawWalker();
  }
  const gloom = 1 - walker.rollOut;
  if (gloom > 0.01) {
    ctx.save();
    ctx.beginPath(); ctx.rect(PORTAL.opening.x, PORTAL.opening.y, PORTAL.opening.w, PORTAL.opening.h); ctx.clip();
    ctx.globalAlpha = gloom * 0.7; px(ctx, PORTAL.opening.x, PORTAL.opening.y, PORTAL.opening.w, PORTAL.opening.h, '#0a1418');
    ctx.restore();
  }
  for (const [x, y, phase] of [[1464, 470, 0], [1505, 497, 2], [1390, 558, 4]]) {
    if (Math.sin(t * 1.3 + phase) > 0.78) {
      px(ctx, x - 2, y, 5, 1, '#f5efcf'); px(ctx, x, y - 2, 1, 5, '#f5efcf');
    }
  }
  ctx.drawImage(layers.foreground, 0, 0);
  ctx.restore();

  px(ctx, 0, 0, 640, 12, '#07121a'); px(ctx, 0, 348, 640, 12, '#07121a');
  if (t > 14.2) {
    ctx.save(); ctx.globalAlpha = finish((t - 14.2) / 1.6);
    ctx.textAlign = 'left'; ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = '#081a23'; ctx.fillText('SULFURED CAVES', 27, 66);
    ctx.fillStyle = '#e6d8a8'; ctx.fillText('SULFURED CAVES', 25, 64);
    px(ctx, 25, 78, 72, 1, '#c7b681');
    ctx.restore();
  }
}