import { clamp, hash, heroRobot, mix, shade } from './cutsceneArt';
import { Job, band, hex3, hudPanel, lerp, makeCanvas, makeNoise, paintPixelsGen, sliceTimer } from './cineKit';
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
const PORTAL = { x: 40, y: 440, w: 360, h: 300, opening: { x: 138, y: 576, w: 94, h: 88 } } as const;
const finish = (x: number) => { const t = clamp(x); return t * t * t * (10 + t * (-15 + t * 6)); };
const n = makeNoise(124612);

// The same sampled surface drives both the rock silhouette and tread contact.
function shoreHeight(x: number) {
  return 659 - 28 * finish((x - 260) / 350) + Math.sin(x * 0.014) * 2.5;
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
  // Chapter 11's cage reaches the 186 m level; CUBE rolls OUT of the old adit,
  // pauses to scan, then advances to the overlook. He does not begin mid-ledge.
  const rollOut = finish((t - 0.5) / 4.6);
  const overlook = finish((t - 6.2) / 3.4);
  const x = lerp(lerp(170, 430, rollOut), 622, overlook);
  return { x, deck: groundAt(x), travel: (x - 170) / (622 - 170), rollOut, overlook, supported: x >= -64 && x <= 724 };
}
export function riftCameraAt(t: number) {
  const follow = finish((t - 0.4) / 6.3);
  const reveal = finish((t - 5.2) / 9.4);
  // After the wide cavern reveal, ease into a closer awe shot of the Heart.
  const awe = finish((t - 10.8) / 6.4);
  return {
    x: lerp(lerp(lerp(391, 629, follow), 970, reveal), 1128, awe),
    y: lerp(lerp(lerp(540, 538, follow), 471, reveal), 452, awe),
    zoom: lerp(lerp(lerp(1.16, 0.86, follow), 0.39, reveal), 0.5, awe),
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
  const dark = hex3('#091c27'), light = hex3('#365359'), warm = hex3('#877e4c');
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

  // Full-height pillars fuse into the roof and pass below the waterline.
  for (const [ci, center, half] of [[0, 115, 128], [1, 523, 103], [2, 906, 75], [3, 1824, 113]]) {
    const centerline = new Float32Array(H), radius = new Float32Array(H);
    let left = W, right = 0;
    for (let y = 0; y < H; y++) {
      const f = y / (SEA + 70);
      centerline[y] = center + Math.sin(f * 4 + ci) * half * 0.16 + n.noise(y * 0.008, ci) * 9;
      radius[y] = half * (0.45 + 0.22 * n.fbm(y * 0.01, ci + 13, 3)
        + Math.exp(-f * 9) * 1.15 + Math.exp(-Math.abs(1 - f) * 8) * 0.7);
      left = Math.min(left, centerline[y] - radius[y]);
      right = Math.max(right, centerline[y] + radius[y]);
    }
    const x0 = Math.max(0, Math.floor(left) - 3), x1 = Math.min(W, Math.ceil(right) + 3);
    const deep = hex3('#102936'), lit = hex3('#71847c');
    yield* paintPixelsGen(d, x0, 0, x1 - x0, H, (x, y, o) => {
      const q = (x - centerline[y]) / radius[y];
      if (Math.abs(q) > 1) return;
      const flutes = n.fbm(x * 0.045 + ci * 7, y * 0.004, 3);
      const lambert = clamp(0.24 + Math.sqrt(Math.max(0, 1 - q * q)) * 0.38 + q * 0.18 + (flutes - 0.5) * 0.56);
      const k = band(lambert, 9, x, y);
      for (let c = 0; c < 3; c++) o[c] = deep[c] + (lit[c] - deep[c]) * k * 0.66;
      o[3] = 255;
    });
  }

  const [geology, g] = makeCanvas(W, H);
  yield* rockTextureGen(g, RIGHT_WALL, '#283e3e', '#b8a980', 61);
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
  yield* rockTextureGen(path, LEDGE, '#233c43', '#9eaa8a', 125);
  for (let i = 1; i < PATH_TOP.length; i++) {
    const a = PATH_TOP[i - 1], b = PATH_TOP[i];
    pixelLine(path, a, b, '#b4baa0', 2);
    pixelLine(path, [a[0], a[1] + 3], [b[0], b[1] + 3], '#4b6259', 2);
  }
  for (let i = 0; i < 14; i++) {
    const x = 25 + i * 43 + hash(i) * 10;
    const y = groundAt(x) + 38 + hash(i * 3) * 24;
    yield* rockTextureGen(path, stone(x, y, 5 + hash(i) * 8, 4 + hash(i * 3) * 6, i + 5), '#20373c', '#7f927d', i + 141);
  }

  // The 186 m adit is a rock portal founded on the walking ledge. Back and front
  // layers let CUBE emerge through the mouth instead of spawning in front of it.
  const [portalBack, pb] = makeCanvas(PORTAL.w, PORTAL.h);
  const berm: Point[] = [[0, 250], [18, 180], [70, 120], [150, 86], [238, 124], [310, 210], [330, 270], [0, 270]];
  yield* rockTextureGen(pb, berm, '#233c43', '#9eaa8a', 126);
  polygon(pb, [[98, 224], [98, 150], [112, 136], [178, 136], [192, 150], [192, 224]], '#0a1418');
  for (let y = 140; y < 224; y += 4) px(pb, 100, y, 90, 2, y % 12 === 0 ? '#101c22' : '#0c161c');
  pixelLine(pb, [100, 222], [190, 222], '#3a4a44', 2);
  const [portalFront, pf] = makeCanvas(PORTAL.w, PORTAL.h);
  for (const x of [92, 194]) {
    px(pf, x, 132, 8, 96, '#1b232b');
    px(pf, x + 1, 132, 5, 96, '#5a422a');
    px(pf, x + 1, 132, 1, 96, '#8a6a44');
    for (let y = 140; y < 224; y += 16) px(pf, x + 2, y, 4, 2, '#2a2e36');
  }
  px(pf, 88, 126, 118, 12, '#1b232b');
  px(pf, 89, 127, 116, 9, '#5a422a');
  px(pf, 89, 127, 116, 2, '#8a6a44');
  pixelLine(pf, [96, 138], [118, 160], '#3a3a40', 3);
  pixelLine(pf, [198, 138], [176, 160], '#3a3a40', 3);
  px(pf, 128, 128, 38, 7, '#0b0f16');
  px(pf, 129, 129, 36, 5, '#1d3326');
  yield;

  const [foreground, f] = makeCanvas(W, H);
  yield* rockTextureGen(f, CEILING, '#071b24', '#42635e', 151);
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

const WATER_RAMP = Array.from({ length: 124 }, (_, y) => mix('#577d65', '#0b2c39', finish(y / 124)));
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

  // Both tread edges clear the slope, not just the centre of the rig.
  const s = 1.85;
  const supportY = Math.min(groundAt(walker.x - s * 12), groundAt(walker.x), groundAt(walker.x + s * 12));
  const glance = finish((t - 7.5) / 2.1);
  ellipse(ctx, walker.x, supportY + 1, 21, 2, 'rgba(2,12,17,0.5)');
  heroRobot(ctx, {
    x: walker.x, y: supportY - 15 * s - 0.55, s, t,
    state: t < 9.6 ? 'idle' : 'happy', chassisMotion: false, paintMix: 1,
    drill: true, drillAngle: 0.22, drillExtend: 0.12,
    drillSpin: 0, wheelPhase: walker.travel * 24, eye: t > 9.6 ? 'normal' : 'scan', look: 1,
  });
  const bx = walker.x + 8, by = supportY - 42;
  ctx.save(); ctx.globalAlpha = 0.08;
  polygon(ctx, [[bx, by], [bx + 170, by - 32 - glance * 28], [bx + 170, by + 18]], '#e0e9cd');
  ctx.restore();
  pixelGlow(ctx, bx, by, 24, '#e2eccb', 0.28);
  // Front jambs/lintel pass in front of the emerging rig; interior gloom lifts
  // only as he rolls through the mouth.
  ctx.drawImage(layers.portalFront, PORTAL.x, PORTAL.y);
  const gloom = 1 - finish((t - 0.5) / 2.1);
  if (gloom > 0.01) {
    ctx.save();
    ctx.beginPath(); ctx.rect(PORTAL.opening.x, PORTAL.opening.y, PORTAL.opening.w, PORTAL.opening.h); ctx.clip();
    ctx.globalAlpha = gloom * 0.78; px(ctx, PORTAL.opening.x, PORTAL.opening.y, PORTAL.opening.w, PORTAL.opening.h, '#0a1418');
    ctx.restore();
  }
  for (const [x, y, phase] of [[1464, 470, 0], [1505, 497, 2], [1390, 558, 4]]) {
    if (Math.sin(t * 1.3 + phase) > 0.78) {
      px(ctx, x - 2, y, 5, 1, '#f5efcf'); px(ctx, x, y - 2, 1, 5, '#f5efcf');
    }
  }
  ctx.drawImage(layers.foreground, 0, 0);
  ctx.restore();

  // The scan confirms what the promise needs: a viable power source for the outpost.
  const scanA = finish((t - 8.6) / 0.8) * (1 - finish((t - 13.2) / 0.9));
  if (scanA > 0.01) {
    ctx.save(); ctx.globalAlpha = scanA;
    hudPanel(ctx, 24, 282, 206, 46, '#d8c37c');
    ctx.textAlign = 'left'; ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#e6d8a8'; ctx.fillText('DEPOSIT SCAN', 34, 298);
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#9ebbb7'; ctx.fillText('HEART-01 // SULFUR', 34, 311);
    ctx.fillStyle = '#4ade80'; ctx.fillText('VIABLE // POWER FOR THE OUTPOST', 34, 322);
    ctx.restore();
  }
  px(ctx, 0, 0, 640, 12, '#07121a'); px(ctx, 0, 348, 640, 12, '#07121a');
  if (t > 14.2) {
    ctx.save(); ctx.globalAlpha = finish((t - 14.2) / 1.6);
    ctx.textAlign = 'left'; ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#9ebbb7'; ctx.fillText('186 METERS BELOW / FIRST SHIFT', 25, 34);
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = '#081a23'; ctx.fillText('SULFURED CAVES', 27, 66);
    ctx.fillStyle = '#e6d8a8'; ctx.fillText('SULFURED CAVES', 25, 64);
    px(ctx, 25, 78, 72, 1, '#c7b681');
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#b2c8bd'; ctx.fillText('THE HEART OF SULFUR. POWER FOR A NEW HOME.', 25, 93);
    ctx.restore();
  }
}