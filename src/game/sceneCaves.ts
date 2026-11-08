/* ================================================================== *
 *  SCENE 11: a lit descent down a timbered shaft through four rock strata.
 *  The world-sized finale is implemented separately in sceneCaldera.ts.
 * ================================================================== */
import { CH, CW, INK, R, clamp, easeInOut, hash, heroRobot } from './cutsceneArt';
import { ellipse, pixelGlow, pixelLine, px } from './pixelCraft';
import {
  band,
  drawBlob,
  gem,
  grade,
  hex3,
  hudPanel,
  lerp,
  lerp3,
  makeCanvas,
  makeNoise,
  paintPixelsGen,
  Job,
  sliceTimer,
  sign,
  smooth,
  type RGB3,
} from './cineKit';
import { qn } from './quality';

/* ================================================================== *
 *  Shared rock material
 * ================================================================== */
interface RockPal {
  dark: RGB3;
  base: RGB3;
  lite: RGB3;
  accent?: RGB3;
  spec?: number;
}

const PAL = {
  soil: { dark: hex3('#160d0a'), base: hex3('#563826'), lite: hex3('#a3744e'), accent: hex3('#3a2a1c') } as RockPal,
  lime: { dark: hex3('#181616'), base: hex3('#625c50'), lite: hex3('#ada187'), accent: hex3('#c9a93a') } as RockPal,
  basalt: { dark: hex3('#120e18'), base: hex3('#4a3d52'), lite: hex3('#9a86a6'), accent: hex3('#d9572a') } as RockPal,
  obsidian: { dark: hex3('#07060c'), base: hex3('#24222f'), lite: hex3('#6c7a9a'), accent: hex3('#38bdf8'), spec: 0.8 } as RockPal,
  ore: { dark: hex3('#1a110c'), base: hex3('#6e4c2c'), lite: hex3('#e0b068'), accent: hex3('#ffe066'), spec: 0.25 } as RockPal,
  core: { dark: hex3('#0f0a12'), base: hex3('#4a3238'), lite: hex3('#c08a5a'), accent: hex3('#f2c037'), spec: 0.3 } as RockPal,
};

function palAtDepth(yy: number): [RockPal, RockPal, number] {
  const zones: Array<[number, RockPal]> = [
    [0, PAL.soil],
    [280, PAL.lime],
    [650, PAL.basalt],
    [1080, PAL.obsidian],
  ];
  let i = 0;
  while (i < zones.length - 1 && yy > zones[i + 1][0]) i++;
  const next = zones[Math.min(zones.length - 1, i + 1)];
  const blend = i < zones.length - 1 ? smooth(next[0] - 30, next[0] + 30, yy) : 0;
  return [zones[i][1], next[1], blend];
}

function mixPal(a: RockPal, b: RockPal, k: number): RockPal {
  if (k <= 0) return a;
  if (k >= 1) return b;
  return {
    dark: lerp3(a.dark, b.dark, k),
    base: lerp3(a.base, b.base, k),
    lite: lerp3(a.lite, b.lite, k),
    accent: lerp3(a.accent ?? a.base, b.accent ?? b.base, k),
    spec: lerp(a.spec ?? 0, b.spec ?? 0, k),
  };
}

/** 2-pass chamfer distance (in px) from every `target===0` pixel to nearest `target===1` pixel. */
function* distanceTo(mask: Uint8Array, w: number, h: number, wantOpen: boolean, cap = 48): Generator<void, Float32Array, unknown> {
  const slice = sliceTimer();
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = (mask[i] === 1) === wantOpen ? 0 : cap;
  const D1 = 1;
  const D2 = 1.414;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1] + D1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + D1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + D2);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + D2);
      }
      d[i] = v;
    }
    if (slice.due()) yield;
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (x < w - 1) v = Math.min(v, d[i + 1] + D1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + D1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + D2);
        if (x > 0) v = Math.min(v, d[i + w - 1] + D2);
      }
      d[i] = v;
    }
    if (slice.due()) yield;
  }
  return d;
}

/** Lambert + specular rock shading from a height field sample triplet. */
function shadeRock(
  pal: RockPal,
  h: number,
  hx: number,
  hy: number,
  lx: number,
  ly: number,
  lz: number,
  light: number,
  x: number,
  y: number,
  wet = 0,
  k = 7
): RGB3 {
  let nx = -hx * k;
  let ny = -hy * k;
  let nz = 1;
  const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
  nx /= nl;
  ny /= nl;
  nz /= nl;
  const lam = Math.max(0, nx * lx + ny * ly + nz * lz);
  const ao = 0.6 + h * 0.55;
  const v = band(clamp((0.12 + lam * 0.95) * ao * light), 7, x, y);
  let col = v < 0.5 ? lerp3(pal.dark, pal.base, v * 2) : lerp3(pal.base, pal.lite, (v - 0.5) * 2);
  const specK = (pal.spec ?? 0) + wet * 0.7;
  if (specK > 0) {
    const s = Math.pow(lam, 14) * specK * light;
    col = lerp3(col, [255, 248, 230], clamp(s));
  }
  if (wet > 0) col = lerp3(col, [col[0] * 0.6, col[1] * 0.62, col[2] * 0.7], wet * 0.5);
  return col;
}

/* ================================================================== *
 *  SCENE 11 — the shaft
 * ================================================================== */
const SH_W = 640;
const SH_H = 1500;

export interface ShaftData {
  canvas: HTMLCanvasElement;
  fore: HTMLCanvasElement;
  lamps: Array<[number, number]>;
  glints: Array<[number, number, string]>;
}


const CAVERNS = [
  { cx: 140, cy: 300, rx: 132, ry: 56 },
  { cx: 505, cy: 580, rx: 135, ry: 66 },
  { cx: 128, cy: 880, rx: 140, ry: 74 },
  { cx: 512, cy: 1160, rx: 130, ry: 64 },
  { cx: 150, cy: 1385, rx: 130, ry: 62 },
];

export const shaftJob = new Job(function* (): Generator<unknown, ShaftData, unknown> {
  const slice = sliceTimer();
  const W = SH_W;
  const H = SH_H;
  const n = makeNoise(5151);
  const nw = makeNoise(6262);
  const [c, ctx] = makeCanvas(W, H);

  /* ---- open-space mask ---- */
  const mask = new Uint8Array(W * H);
  const leftE = new Float32Array(H);
  const rightE = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const cx = 320 + Math.sin(y * 0.004) * 10;
    leftE[y] = cx - (70 + (n.fbm(y * 0.008, 1.5, 3) - 0.5) * 34 + (n.fbm(y * 0.05, 7, 3) - 0.5) * 14);
    rightE[y] = cx + (70 + (n.fbm(y * 0.008, 9.5, 3) - 0.5) * 34 + (n.fbm(y * 0.05, 13, 3) - 0.5) * 14);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let open = x > leftE[y] && x < rightE[y];
      if (!open) {
        for (const cv of CAVERNS) {
          const dx = (x - cv.cx) / cv.rx;
          const dy = (y - cv.cy) / cv.ry;
          const r0 = dx * dx + dy * dy * (dy > 0 ? 1.5 : 1);
          if (r0 > 1.5) continue;
          const r = r0 + (n.fbm(x * 0.025, y * 0.025, 3) - 0.5) * 0.7;
          if (r < 1) {
            open = true;
            break;
          }
        }
      }
      mask[y * W + x] = open ? 1 : 0;
    }
    if (slice.due()) yield;
  }
  const dRock = yield* distanceTo(mask, W, H, true, 40); // rock px → nearest air
  const dAir = yield* distanceTo(mask, W, H, false, 60); // air px → nearest rock

  /* ---- height field ---- */
  const HW = W / 2 + 1;
  const HH = H / 2 + 1;
  const lo = new Float32Array(HW * HH);
  for (let y = 0; y < HH; y++) {
    for (let x = 0; x < HW; x++) {
      const X = x * 2;
      const Y = y * 2;
      let h = n.fbm(X * 0.022, Y * 0.022, 3) + (n.fbm(X * 0.085, Y * 0.085, 2) - 0.5) * 0.45;
      if (Y > 280 && Y < 650) h += Math.sin(Y * 0.11 + n.noise(X * 0.01, Y * 0.01) * 7) * 0.08; // bedding planes
      if (Y > 650 && Y < 1080) h += Math.abs(Math.sin(X * 0.07 + n.noise(X * 0.01, Y * 0.004) * 3)) * 0.14; // columnar joints
      if (Y > 1080) h += n.ridged(X * 0.03, Y * 0.03, 2) * 0.2; // conchoidal fractures
      lo[y * HW + x] = h;
    }
    if (slice.due()) yield;
  }
  const Hf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = y / 2;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = x / 2;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const a = lo[y0 * HW + x0];
      const b = lo[y0 * HW + x0 + 1];
      const c2 = lo[(y0 + 1) * HW + x0];
      const d2 = lo[(y0 + 1) * HW + x0 + 1];
      const i = y * W + x;
      let h = a + (b - a) * tx + (c2 - a) * ty + (a - b - c2 + d2) * tx * ty;
      h += (nw.noise(x * 0.18, y * 0.18) - 0.5) * 0.05 + (nw.noise(x * 0.06, y * 0.06) - 0.5) * 0.12; // grit & chisel marks
      if (mask[i] === 0) h += Math.min(dRock[i], 16) / 16 * 0.8;
      Hf[i] = h;
    }
    if (slice.due()) yield;
  }

  /* ---- shading ---- */
  const fog = hex3('#0a0912');
  const palCache: RockPal[] = [];
  const palFor = (yy: number) => {
    const key = Math.max(0, Math.min(420, Math.round(yy / 4) + 20));
    let pc = palCache[key];
    if (!pc) {
      const [pa, pb, k] = palAtDepth((key - 20) * 4);
      pc = mixPal(pa, pb, k);
      palCache[key] = pc;
    }
    return pc;
  };
  yield* paintPixelsGen(ctx, 0, 0, W, H, (x, y, o) => {
    const i = y * W + x;
    const yy = y + (lo[(y >> 1) * HW + (x >> 1)] - 0.5) * 120;
    const pal = palFor(yy);
    const hxv = (Hf[Math.min(i + 1, W * H - 1)] - Hf[Math.max(i - 1, 0)]) * 0.5;
    const hyv = (Hf[Math.min(i + W, W * H - 1)] - Hf[Math.max(i - W, 0)]) * 0.5;
    const depthDim = 1 - (y / H) * 0.3;
    const cf = clamp(1 - Math.abs(x - 320) / 380);
    const centerFall = cf * Math.sqrt(Math.sqrt(cf)); // ≈ cf^0.8 (sqrt chain instead of pow)
    let col: RGB3;
    if (mask[i] === 0) {
      const side = x < 320 ? 1 : -1;
      // Wet streaks vary slowly down the wall: sample them once per 2px column band.
      const wet = y > 260 ? smooth(0.6, 0.72, nw.fbm((x >> 1) * 0.26, (y >> 2) * 0.024, 2)) : 0;
      col = shadeRock(pal, Hf[i] - 0.4, hxv, hyv, side * 0.72, -0.38, 0.58, (0.42 + centerFall * 0.55) * depthDim, x, y, wet, 15);
      // mineral seams
      const seam = Math.abs(n.noise(x * 0.012 + 40, y * 0.05) - 0.5);
      if (seam < 0.009 && y > 280) col = lerp3(col, pal.accent ?? pal.base, 0.38);
      // lip highlight where the wall turns into the opening
      if (dRock[i] < 2.5) col = lerp3(col, pal.lite, 0.25 * centerFall);
    } else {
      const inCavern = x < leftE[y] - 2 || x > rightE[y] + 2;
      const ao = clamp(dAir[i] / 26);
      const backH = Hf[i] - 0.3;
      let bc = shadeRock(pal, backH, hxv * 0.5, hyv * 0.5, 0, -0.5, 0.86, 0.38 * depthDim, x, y);
      bc = lerp3(fog, bc, 0.42);
      if (inCavern) {
        const deep = clamp((Math.abs(x - 320) - 60) / 140);
        bc = lerp3(bc, fog, 0.5 + deep * 0.45);
      }
      col = lerp3([bc[0] * 0.45, bc[1] * 0.45, bc[2] * 0.5], bc, 0.35 + ao * 0.65);
    }
    col = lerp3(col, fog, (y / H) * 0.32);
    o[0] = col[0];
    o[1] = col[1];
    o[2] = col[2];
    o[3] = 255;
  });

  /* ---- cavern stalactites / stalagmites ---- */
  const spike = (x: number, y: number, len: number, w: number, down: boolean, pal: RockPal) => {
    for (let k = 0; k < len; k++) {
      const p = k / len;
      const ww = Math.max(1, w * (1 - p) ** 1.3);
      const yy = down ? y + k : y - k;
      const left = x - ww / 2;
      ctx.fillStyle = `rgb(${pal.dark.join(',')})`;
      ctx.fillRect(left - 1, yy, ww + 2, 1);
      ctx.fillStyle = `rgb(${lerp3(pal.base, pal.dark, 0.35).map((v) => v | 0).join(',')})`;
      ctx.fillRect(left, yy, ww, 1);
      ctx.fillStyle = `rgb(${lerp3(pal.base, pal.lite, 0.45).map((v) => v | 0).join(',')})`;
      ctx.fillRect(left + ww * 0.6, yy, Math.max(1, ww * 0.2), 1);
    }
  };
  CAVERNS.forEach((cv, ci) => {
    const [pa, pb, k] = palAtDepth(cv.cy);
    const pal = mixPal(pa, pb, k);
    for (let s = 0; s < 9; s++) {
      const x = Math.round(cv.cx - cv.rx * 0.8 + (s / 8) * cv.rx * 1.6 + (hash(ci * 31 + s) - 0.5) * 14);
      if (x < 2 || x > W - 2) continue;
      if (x > leftE[cv.cy] - 6 && x < rightE[cv.cy] + 6) continue;
      let yTop = cv.cy;
      while (yTop > 0 && mask[yTop * W + x] === 1) yTop--;
      let yBot = cv.cy;
      while (yBot < H - 1 && mask[yBot * W + x] === 1) yBot++;
      const gap = yBot - yTop;
      if (gap < 20) continue;
      spike(x, yTop, Math.min(gap * 0.45, 8 + hash(s * 7 + ci) * 30), 4 + hash(s + ci) * 7, true, pal);
      if (hash(s * 3 + ci) > 0.4) spike(x + 3, yBot, Math.min(gap * 0.3, 5 + hash(s * 11 + ci) * 18), 5 + hash(s * 2 + ci) * 8, false, pal);
    }
  });

  /* ---- timber sets, guide rails, pipe & ladderway (behind the cage) ---- */
  for (let y = 60; y < H; y += 170) {
    const l = leftE[y] - 8;
    const r = rightE[y] + 8;
    R(ctx, l, y - 1, r - l, 9, INK);
    R(ctx, l, y, r - l, 7, '#5a3e28');
    R(ctx, l, y, r - l, 2, '#8a6440');
    for (let gx = l + 4; gx < r; gx += 11) R(ctx, gx, y + 3, 6, 1, 'rgba(30,18,10,0.6)');
    for (const bx of [l + 4, r - 10]) {
      R(ctx, bx, y + 1, 6, 5, '#3a3a40');
      R(ctx, bx + 2, y + 2, 2, 2, '#9aa0aa');
    }
    // corner posts
    R(ctx, l + 2, y + 7, 7, 60, INK);
    R(ctx, l + 3, y + 7, 5, 60, '#4a3220');
    R(ctx, r - 9, y + 7, 7, 60, INK);
    R(ctx, r - 8, y + 7, 5, 60, '#4a3220');
  }
  for (const gx of [274, 364]) {
    R(ctx, gx - 2, 0, 5, H, INK);
    R(ctx, gx - 1, 0, 3, H, '#4a525e');
    R(ctx, gx - 1, 0, 1, H, '#8a94a2');
    for (let y = 20; y < H; y += 46) R(ctx, gx - 4, y, 9, 3, '#2a2e36');
  }
  // vertical service pipe with brackets
  for (let y = 0; y < H; y++) {
    const px = Math.round(Math.max(250, leftE[y] + 4));
    R(ctx, px, y, 5, 1, '#3a4048');
    R(ctx, px + 1, y, 1, 1, '#7a8696');
  }
  for (let y = 30; y < H; y += 90) {
    const px = Math.round(Math.max(250, leftE[y] + 4));
    R(ctx, px - 2, y, 9, 3, '#22262c');
  }
  // ladderway on the far right of the shaft
  for (let y = 0; y < H; y++) {
    const lx = Math.round(Math.min(388, rightE[y] - 14));
    R(ctx, lx, y, 1, 1, '#3a2a1c');
    R(ctx, lx + 9, y, 1, 1, '#3a2a1c');
    if (y % 9 === 0) R(ctx, lx, y, 10, 1, '#5a422a');
  }

  /* ---- ore veins as embedded crystal clusters ---- */
  const glints: Array<[number, number, string]> = [];
  const veinDefs: Array<[number, 'L' | 'R', string]> = [
    [150, 'L', '#b87333'],
    [230, 'R', '#9ca3af'],
    [420, 'L', '#e8c547'],
    [480, 'R', '#e8c547'],
    [700, 'R', '#ffd24a'],
    [760, 'L', '#ff9a6a'],
    [980, 'R', '#3ddc97'],
    [1040, 'L', '#3ddc97'],
    [1230, 'L', '#ff5a7a'],
    [1290, 'R', '#5ad2ff'],
    [1440, 'R', '#fde047'],
    [1460, 'L', '#fde047'],
  ];
  veinDefs.forEach(([y, side, col], vi) => {
    const ex = side === 'L' ? leftE[y] : rightE[y];
    const dir = side === 'L' ? -1 : 1;
    for (let g = 0; g < 6; g++) {
      const gx = ex + dir * (3 + hash(vi * 17 + g) * 18);
      const gy = y + (hash(vi * 5 + g) - 0.5) * 26;
      const size = 3 + hash(vi * 3 + g) * 5;
      gem(ctx, gx, gy + size, size, size * (1.4 + hash(g + vi) * 1.2), col, dir * (0.5 + hash(vi + g * 2) * 0.6));
    }
    glints.push([ex + dir * 10, y, col]);
  });

  /* ---- roots in the topsoil ---- */
  ctx.strokeStyle = 'rgba(28,16,10,0.75)';
  ctx.lineWidth = 1;
  for (let r = 0; r < 18; r++) {
    let x = hash(r * 3.3) * W;
    if (x > 230 && x < 410) continue;
    let y = 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 14; k++) {
      x += (hash(r * 11 + k) - 0.5) * 14;
      y += 6 + hash(r + k * 3) * 10;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /* ---- cavern set dressing ---- */
  // abandoned ore cart in cavern 2 floor
  {
    const cx = 520;
    let fy = 580;
    while (fy < H - 1 && mask[fy * W + cx] === 1) fy++;
    R(ctx, cx - 22, fy - 18, 44, 14, INK);
    R(ctx, cx - 20, fy - 16, 40, 10, '#5a3e2a');
    R(ctx, cx - 20, fy - 16, 40, 2, '#8a6a4a');
    for (const wx of [-12, 12]) {
      R(ctx, cx + wx - 4, fy - 7, 8, 7, INK);
      R(ctx, cx + wx - 2, fy - 5, 4, 4, '#3a3a40');
    }
    for (let k = 0; k < 5; k++) R(ctx, cx - 16 + k * 7, fy - 20, 6, 4, '#4a3f46');
  }
  // glowing crystal garden deep in cavern 5
  for (let g = 0; g < 9; g++) {
    const gx = 70 + g * 18;
    let fy = 1385;
    while (fy < H - 1 && mask[fy * W + Math.round(gx)] === 1) fy++;
    gem(ctx, gx, fy + 2, 5 + hash(g) * 5, 10 + hash(g * 3) * 22, g % 3 === 0 ? '#5ad2ff' : '#fde047', (hash(g * 7) - 0.5) * 0.6, 0.18);
  }

  /* ---- wall lamps ---- */
  const lamps: Array<[number, number]> = [];
  for (let y = 120, k = 0; y < H; y += 210, k++) {
    const side = k % 2 === 0 ? 'L' : 'R';
    const x = side === 'L' ? leftE[y] + 2 : rightE[y] - 2;
    const dir = side === 'L' ? 1 : -1;
    R(ctx, x, y - 1, dir * 12, 3, '#2a2a30');
    R(ctx, x + dir * 10 - 4, y + 1, 8, 8, INK);
    R(ctx, x + dir * 10 - 3, y + 2, 6, 6, '#ffe6a8');
    R(ctx, x + dir * 10 - 3, y + 4, 6, 1, '#3a3a40');
    lamps.push([x + dir * 10, y + 5]);
  }

  /* ---- foreground parallax rocks (scroll faster than the shaft) ---- */
  const FH = 2200;
  const [fc, fctx] = makeCanvas(W, FH);
  const nf = makeNoise(7373);
  for (let i = 0; i < 12; i++) {
    const left = i % 2 === 0;
    const cy = 120 + i * 180 + hash(i * 9) * 60;
    const reach = 50 + hash(i * 3) * 80;
    const hh = 70 + hash(i * 5) * 90;
    const x0 = left ? 0 : W - reach - 30;
    yield* paintPixelsGen(fctx, x0, Math.round(cy - hh), Math.round(reach + 30), Math.round(hh * 2), (x, y, o) => {
      const dy = (y - cy) / hh;
      const prof = reach * (1 - dy * dy) * (0.75 + nf.fbm(x * 0.03, y * 0.03, 2) * 0.5);
      const edgeX = left ? prof : W - prof;
      const inside = left ? x < edgeX : x > edgeX;
      if (!inside) {
        o[3] = 0;
        return;
      }
      const dEdge = left ? edgeX - x : x - edgeX;
      const col = dEdge < 1.6 ? hex3('#7a5a48') : lerp3(hex3('#0c0a10'), hex3('#16121a'), nf.noise(x * 0.2, y * 0.2));
      o[0] = col[0];
      o[1] = col[1];
      o[2] = col[2];
      o[3] = 255;
    });
  }

  return { canvas: c, fore: fc, lamps, glints };
});
export function getShaft(): ShaftData {
  return shaftJob.get();
}

export function drawShaftScene(ctx: CanvasRenderingContext2D, t: number, duration: number) {
  const S = shaftJob.peek();
  if (!S) {
    R(ctx, 0, 0, CW, CH, '#0a0912');
    drawBlob(ctx, '#ffd890', 320, 120 + (t % 1) * 30, 70, 0.25);
    return;
  }
  const descent = easeInOut(t / duration);
  const scrollY = Math.round(descent * (SH_H - CH));
  ctx.drawImage(S.canvas, 0, -scrollY);

  // fixed wall lamps
  S.lamps.forEach(([lx, ly], i) => {
    const sy = ly - scrollY;
    if (sy < -120 || sy > CH + 120) return;
    const fl = i === 3 ? (Math.sin(t * 23) > -0.2 ? 1 : 0.2) : 0.92 + 0.08 * Math.sin(t * 9 + i);
    drawBlob(ctx, '#ffd890', lx, sy, 70, 0.32 * fl);
    drawBlob(ctx, '#fff3c8', lx, sy, 16, 0.7 * fl);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(lx, sy, lx, sy + 120);
    g.addColorStop(0, `rgba(255,214,140,${0.18 * fl})`);
    g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(lx - 4, sy);
    ctx.lineTo(lx + 4, sy);
    ctx.lineTo(lx + 40, sy + 120);
    ctx.lineTo(lx - 40, sy + 120);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // ore glints
  S.glints.forEach(([gx, gy, col], i) => {
    const sy = gy - scrollY;
    if (sy < -30 || sy > CH + 30) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + i * 1.7);
    drawBlob(ctx, col, gx, sy, 18 + pulse * 10, 0.2 + pulse * 0.2);
    if (pulse > 0.8) {
      R(ctx, gx - 3, sy, 7, 1, '#ffffff');
      R(ctx, gx, sy - 3, 1, 7, '#ffffff');
    }
  });

  /* ---- the cage ---- */
  const cageX = 320;
  const cageY = Math.round(118 + descent * 96);
  const sway = Math.sin(t * 1.3) * 1.2;
  ctx.save();
  ctx.translate(sway, 0);
  // hoist ropes
  R(ctx, cageX - 12, 0, 2, cageY - 40, '#2a2e36');
  R(ctx, cageX + 10, 0, 2, cageY - 40, '#2a2e36');
  R(ctx, cageX - 12, 0, 1, cageY - 40, '#8a94a2');
  R(ctx, cageX + 10, 0, 1, cageY - 40, '#8a94a2');
  // crosshead
  R(ctx, cageX - 46, cageY - 42, 92, 8, INK);
  R(ctx, cageX - 44, cageY - 41, 88, 5, '#5a6270');
  R(ctx, cageX - 44, cageY - 41, 88, 1, '#a8b2c0');
  // back mesh panel
  ctx.globalAlpha = 0.5;
  for (let gx = cageX - 38; gx <= cageX + 38; gx += 5) R(ctx, gx, cageY - 34, 1, 70, '#3a4048');
  for (let gy = cageY - 34; gy <= cageY + 34; gy += 5) R(ctx, cageX - 38, gy, 76, 1, '#3a4048');
  ctx.globalAlpha = 1;
  // roof & roof lamp
  R(ctx, cageX - 44, cageY - 36, 88, 4, '#3a3f48');
  R(ctx, cageX - 4, cageY - 33, 8, 3, '#fff1c0');
  drawBlob(ctx, '#ffe6a8', cageX, cageY - 28, 46, 0.35);
  // floor
  R(ctx, cageX - 46, cageY + 34, 92, 8, INK);
  R(ctx, cageX - 44, cageY + 35, 88, 5, '#5a6270');
  R(ctx, cageX - 44, cageY + 35, 88, 1, '#c0c8d4');
  for (let k = 0; k < 8; k++) R(ctx, cageX - 40 + k * 11, cageY + 37, 6, 1, '#3a3f48');

  // CUBE-07
  heroRobot(ctx, {
    x: cageX,
    y: cageY + 35 - 15 * 2.55,
    s: 2.55,
    t,
    state: 'idle',
    chassisMotion: false,
    eye: 'scan',
    look: 1,
    drill: true,
    drillAngle: 0.42,
    drillExtend: 0.28,
    paintMix: 1,
  });

  // headlamp beam sweeping the wall, with dust caught in the light
  const sweep = Math.sin(t * 1.1) * 0.35 + 0.15;
  const bx = cageX + 12;
  const by = cageY + 6;
  const len = 300;
  const a0 = sweep - 0.2;
  const a1 = sweep + 0.2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(bx, by, 4, bx, by, len);
  g.addColorStop(0, 'rgba(255,244,200,0.42)');
  g.addColorStop(0.5, 'rgba(255,228,160,0.14)');
  g.addColorStop(1, 'rgba(255,228,160,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.arc(bx, by, len, a0, a1);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < qn(40, 0.35); i++) {
    const r = 20 + hash(i * 3.1) * (len - 40);
    const a = a0 + hash(i * 7.7) * (a1 - a0);
    const px = bx + Math.cos(a) * r + Math.sin(t + i) * 4;
    const py = by + Math.sin(a) * r + ((t * 12 + i * 9) % 20) - 10;
    ctx.globalAlpha = (1 - r / len) * (0.5 + 0.5 * Math.sin(t * 3 + i));
    R(ctx, px, py, 1, 1, '#fff6d8');
  }
  ctx.restore();
  // lit spot where the beam hits the right wall
  drawBlob(ctx, '#ffe4b0', bx + Math.cos(sweep) * 110, by + Math.sin(sweep) * 110, 50, 0.22);

  // front cage bars (in front of the robot)
  R(ctx, cageX - 44, cageY - 36, 4, 72, INK);
  R(ctx, cageX + 40, cageY - 36, 4, 72, INK);
  R(ctx, cageX - 43, cageY - 36, 2, 72, '#6a7482');
  R(ctx, cageX + 41, cageY - 36, 2, 72, '#6a7482');
  for (const gy of [cageY - 8, cageY + 14]) {
    R(ctx, cageX - 44, gy, 88, 2, INK);
    R(ctx, cageX - 44, gy, 88, 1, '#6a7482');
  }
  ctx.restore();

  // water drips & falling grit
  for (let i = 0; i < qn(14, 0.5); i++) {
    const x = 240 + hash(i * 2.3) * 170;
    const y = ((t * (220 + hash(i) * 120) + hash(i * 5) * 500) % 460) - 50;
    ctx.globalAlpha = 0.6;
    R(ctx, x, y, 1, i % 3 === 0 ? 4 : 2, i % 3 === 0 ? '#9ad0ff' : '#a89a8a');
  }
  ctx.globalAlpha = 1;

  // Nearby timber sets pass faster than the back wall, grounding the elevator in space.
  for (let i = 0; i < 6; i++) {
    const yy = i * 250 - scrollY * 1.12;
    if (yy < -70 || yy > CH + 70) continue;
    for (const xx of [224, 407]) {
      px(ctx, xx, yy - 5, 8, 72, '#131c23');
      px(ctx, xx + 1, yy - 5, 2, 72, '#7b6850');
      px(ctx, xx, yy + 3, 8, 5, '#33444a');
      px(ctx, xx + 2, yy + 4, 2, 2, '#b7b49a');
    }
    pixelLine(ctx, [230, yy], [256, yy + 32], '#584c3a', 4);
    pixelLine(ctx, [407, yy], [382, yy + 32], '#584c3a', 4);
  }
  const coreLight = smooth(0.72, 1, descent);
  pixelGlow(ctx, 324, 385, 185, '#d8c37c', coreLight * 0.3);
  if (coreLight > 0) {
    ctx.globalAlpha = coreLight * 0.1;
    ellipse(ctx, 322, 337, 98, 14, '#bcbd8a');
    ctx.globalAlpha = 1;
  }

  // foreground rock silhouettes (faster parallax)
  const fy = -Math.round(descent * (SH_H - CH) * 1.45) + 40;
  ctx.drawImage(S.fore, 0, fy);

  // vertical depth darkness & cooling grade
  const vg = ctx.createLinearGradient(0, 0, 0, CH);
  vg.addColorStop(0, 'rgba(4,3,8,0.55)');
  vg.addColorStop(0.25, 'rgba(4,3,8,0)');
  vg.addColorStop(0.75, 'rgba(4,3,8,0)');
  vg.addColorStop(1, 'rgba(4,3,8,0.6)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, CW, CH);

  const depthMeters = Math.round(descent * 186);
  const stratum = depthMeters < 36 ? 'ASH & TOPSOIL' : depthMeters < 86 ? 'SULFUR LIMESTONE' : depthMeters < 141 ? 'BRIMSTONE BASALT' : 'ABYSSAL OBSIDIAN';
  const sc = depthMeters < 36 ? '#d97236' : depthMeters < 86 ? '#fde047' : depthMeters < 141 ? '#c084fc' : '#38bdf8';
  hudPanel(ctx, 18, 22, 162, 56, sc);
  sign(ctx, `DEPTH  ${depthMeters}M`, 99, 42, '#f4cb7a', 8);
  sign(ctx, stratum, 99, 60, sc, 5);
  R(ctx, 30, 68, 138, 2, '#272338');
  R(ctx, 30, 68, 138 * descent, 2, sc);
  grade(ctx, descent > 0.6 ? '#3a5aa0' : '#a06a3a', 0.12, '#05030a', 0.55);
}

// Scene 12 now lives in sceneCaldera.ts, with an independent world-sized set.
