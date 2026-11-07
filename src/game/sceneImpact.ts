/* ================================================================== *
 *  SCENE 06 — EARTH: realistic wasteland + meteoric impact (remastered)
 * ================================================================== */
import { CH, CW, INK, R, clamp, ease, hash, heroRobot, rgba, smokeAt } from './cutsceneArt';
import {
  band,
  bar,
  cellEdge,
  drawBlob,
  drawPuff,
  grade,
  heatShimmer,
  hex3,
  hudPanel,
  lerp,
  lerp3,
  makeCanvas,
  makeNoise,
  paintPixelsGen,
  Job,
  sliceTimer,
  plasmaFront,
  plasmaWake,
  shake,
  sign,
  smooth,
  type RGB3,
} from './cineKit';
import { qn } from './quality';
import { heatedRobot } from './sceneReentry';
import { pixelLine, px } from './pixelCraft';

export const HORIZON = 206;
const SUN_X = 470;
const SUN_Y = 190;

/** 640x360 painted badlands: sky, mesas, ruined skyline, cracked earth, props. */
export const landJob = new Job(function* () {
  const [c, ctx] = makeCanvas(CW, CH);
  const n = makeNoise(1717);
  const n2 = makeNoise(9191);

  /* ---------- sky + clouds + ground (per pixel) ---------- */
  const skyStops: Array<[number, RGB3]> = [
    [0, hex3('#120c22')],
    [0.3, hex3('#2b1c40')],
    [0.6, hex3('#6c3a52')],
    [0.82, hex3('#c4684c')],
    [1, hex3('#f3ad6c')],
  ];
  const skyAt = (y: number): RGB3 => {
    const k = clamp(y / HORIZON);
    let i = 0;
    while (i < skyStops.length - 2 && k > skyStops[i + 1][0]) i++;
    const [p0, c0] = skyStops[i];
    const [p1, c1] = skyStops[i + 1];
    return lerp3(c0, c1, clamp((k - p0) / (p1 - p0)));
  };
  const farGround = hex3('#c98c66');
  const midGround = hex3('#8e5e44');
  const nearGround = hex3('#5a3b2c');
  const crackCol = hex3('#2c1c17');
  const sandLite = hex3('#d8a27a');

  yield* paintPixelsGen(ctx, 0, 0, CW, CH, (x, y, o) => {
    let col: RGB3;
    if (y < HORIZON) {
      col = skyAt(y);
      // sun glow
      const dx = x - SUN_X;
      const dy = (y - SUN_Y) * 1.6;
      const d = Math.sqrt(dx * dx + dy * dy);
      col = lerp3(col, hex3('#ffd29a'), clamp(1 - d / 230) * 0.55);
      // stratified clouds: long, lit from below by the low sun
      const yy = y / HORIZON;
      const streak = n.fbm(x * 0.0045 + 3, y * 0.045, 5);
      const cov = smooth(0.5, 0.66, streak) * smooth(0.05, 0.3, yy) * (1 - smooth(0.72, 0.96, yy));
      if (cov > 0) {
        const under = clamp((n.fbm(x * 0.0045 + 3, (y - 2) * 0.045, 5) - streak) * 18 + 0.5);
        const lit = lerp3(hex3('#3a2848'), hex3('#ffb37a'), clamp(under * 0.7 + clamp(1 - d / 320) * 0.6));
        col = lerp3(col, lit, band(cov, 4, x, y) * 0.9);
      }
      // sun disk veiled by haze
      if (d < 21) col = lerp3(col, hex3('#fff1cf'), clamp((21 - d) / 3) * 0.95);
    } else {
      const d = (y - HORIZON) / (CH - HORIZON); // 0 far → 1 near
      const z = 1 / (d + 0.035);
      const wx = (x - CW / 2) / CW * z;
      const base = d < 0.35 ? lerp3(farGround, midGround, d / 0.35) : lerp3(midGround, nearGround, (d - 0.35) / 0.65);
      const mott = n.fbm(wx * 1.2 + 9, z * 0.35, 4);
      col = lerp3(base, mott > 0.5 ? sandLite : nearGround, Math.abs(mott - 0.5) * 0.9);
      // wind ripples (dunes)
      const ripple = Math.sin(z * 2.8 + wx * 1.1 + n.noise(wx * 2, z * 0.4) * 5);
      col = lerp3(col, ripple > 0.6 ? sandLite : base, d > 0.08 ? 0.12 : 0);
      // cracked mud plates in the foreground (perspective Voronoi)
      if (d > 0.3) {
        const e = cellEdge(wx * 9, z * 1.9, 5);
        const width = 0.035 + (1 - d) * 0.05;
        if (e < width) col = lerp3(col, crackCol, 0.85);
        else if (e < width * 2.2) col = lerp3(col, sandLite, 0.18);
      }
      // aerial perspective toward the horizon
      col = lerp3(col, hex3('#e7a77a'), clamp(1 - d * 4.5) * 0.7);
      // pebbles
      if (hash(x * 13.1 + y * 7.7) > 0.992 - d * 0.004) col = lerp3(col, hex3('#2e211c'), 0.7);
      const l = band(0.5 + (n2.noise(x * 0.5, y * 0.5) - 0.5) * 0.25, 6, x, y);
      col = [col[0] * (0.9 + l * 0.2), col[1] * (0.9 + l * 0.2), col[2] * (0.9 + l * 0.2)];
    }
    o[0] = col[0];
    o[1] = col[1];
    o[2] = col[2];
    o[3] = 255;
  });

  /* ---------- ruined megacity skyline at the horizon ---------- */
  for (let i = 0; i < 26; i++) {
    const x = 14 + i * 9 + hash(i * 3.1) * 5;
    const h = 8 + hash(i * 1.7) * 30 * (i > 6 && i < 18 ? 1.4 : 0.7);
    const w = 5 + hash(i * 2.9) * 7;
    R(ctx, x, HORIZON - h, w, h, rgba('#7c4d55', 0.75));
    if (hash(i * 5.3) > 0.5) R(ctx, x + w * 0.3, HORIZON - h - 4, 2, 4, rgba('#7c4d55', 0.75));
    if (hash(i * 4.1) > 0.6) R(ctx, x + w - 2, HORIZON - h + 2, 2, 3, rgba('#a0636a', 0.6)); // broken edge
  }

  /* ---------- eroded mesas (two depth layers) ---------- */
  function* mesa(layer: number) {
    const slice = sliceTimer();
    const n3 = makeNoise(300 + layer);
    const tops: Array<[number, number, number]> =
      layer === 0
        ? [[300, 420, 34], [520, 600, 46], [590, 660, 28]]
        : [[-20, 120, 58], [130, 190, 30], [560, 680, 64]];
    const haze = layer === 0 ? 0.62 : 0.3;
    for (let x = 0; x < CW; x++) {
      let h = 0;
      for (const [x0, x1, hh] of tops) {
        const slope = 14 + hh * 0.3;
        const k = Math.min(clamp((x - x0) / slope), clamp((x1 - x) / slope));
        h = Math.max(h, hh * Math.pow(k, 0.55));
      }
      if (h <= 0.5) continue;
      h += (n3.fbm(x * 0.06, layer, 3) - 0.5) * 6;
      const top = HORIZON - h + (layer === 1 ? 6 : 0);
      const slopeR = h - (() => {
        let h2 = 0;
        for (const [x0, x1, hh] of tops) {
          const slope = 14 + hh * 0.3;
          const k = Math.min(clamp((x + 2 - x0) / slope), clamp((x1 - x - 2) / slope));
          h2 = Math.max(h2, hh * Math.pow(k, 0.55));
        }
        return h2;
      })();
      const lit = slopeR > 0.2 ? 1 : slopeR < -0.2 ? 0.25 : 0.6;
      for (let y = Math.floor(top); y < HORIZON + (layer === 1 ? 6 : 0); y++) {
        const strata = Math.floor((y - top + n3.noise(x * 0.08, y * 0.3) * 4) / 4) % 3;
        const baseC = strata === 0 ? hex3('#8a4f3c') : strata === 1 ? hex3('#a8644a') : hex3('#6e3c32');
        let col = lerp3(hex3('#3a2230'), baseC, lit * (0.7 + band(n3.noise(x * 0.3, y * 0.3), 3, x, y) * 0.3));
        if (y - top < 2) col = lerp3(col, hex3('#ffb58a'), lit * 0.6);
        col = lerp3(col, skyAt(HORIZON - 6), haze);
        ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        ctx.fillRect(x, y, 1, 1);
      }
      if (slice.due()) yield;
    }
  }
  yield* mesa(0);
  yield* mesa(1);

  // horizon toxic haze band
  const hz = ctx.createLinearGradient(0, HORIZON - 14, 0, HORIZON + 22);
  hz.addColorStop(0, 'rgba(240,170,120,0)');
  hz.addColorStop(0.5, 'rgba(240,170,120,0.45)');
  hz.addColorStop(1, 'rgba(240,170,120,0)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, HORIZON - 14, CW, 36);

  /* ---------- leaning power pylon + sagging cable ---------- */
  const pylon = (px: number, base: number, h: number, lean: number, col: string) => {
    ctx.save();
    ctx.translate(px, base);
    ctx.rotate(lean);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-h * 0.18, 0);
    ctx.lineTo(-2, -h);
    ctx.lineTo(2, -h);
    ctx.lineTo(h * 0.18, 0);
    for (let k = 0.15; k < 1; k += 0.16) {
      const w = h * 0.18 * (1 - k) + 2;
      ctx.moveTo(-w, -h * k);
      ctx.lineTo(w * 0.9, -h * (k + 0.16));
      ctx.moveTo(w, -h * k);
      ctx.lineTo(-w * 0.9, -h * (k + 0.16));
    }
    ctx.moveTo(-h * 0.22, -h * 0.82);
    ctx.lineTo(h * 0.22, -h * 0.82);
    ctx.stroke();
    ctx.restore();
  };
  pylon(92, 238, 64, -0.14, '#3a2630');
  pylon(212, 222, 34, 0.05, 'rgba(90,52,60,0.8)');
  ctx.strokeStyle = 'rgba(40,24,30,0.8)';
  ctx.beginPath();
  ctx.moveTo(80, 186);
  ctx.quadraticCurveTo(150, 214, 206, 196);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(84, 186);
  ctx.quadraticCurveTo(40, 230, 0, 214);
  ctx.stroke();

  /* ---------- boulders with long shadows (low sun from the right) ---------- */
  function* boulder(bx: number, by: number, w: number, h: number, seed: number) {
    const n4 = makeNoise(seed);
    // cast shadow stretching to the left
    ctx.fillStyle = 'rgba(30,16,18,0.45)';
    ctx.beginPath();
    ctx.ellipse(bx - w * 1.1, by, w * 1.5, h * 0.18 + 1, 0, 0, Math.PI * 2);
    ctx.fill();
    yield* paintPixelsGen(ctx, Math.round(bx - w / 2 - 2), Math.round(by - h - 2), Math.round(w + 4), Math.round(h + 3), (x, y, o) => {
      const lx = (x - bx) / (w / 2);
      const ly = (y - (by - h * 0.5)) / (h / 2);
      const r = lx * lx + ly * ly * (ly > 0 ? 0.6 : 1.1) + (n4.fbm(x * 0.2, y * 0.2, 3) - 0.5) * 0.5;
      if (r > 1 || y > by) {
        o[3] = 0;
        return;
      }
      if (r > 0.82) {
        o[0] = 20;
        o[1] = 12;
        o[2] = 12;
        o[3] = 255;
        return;
      }
      const nx = lx;
      const ny = ly;
      const light = clamp(0.35 + nx * 0.55 - ny * 0.35 + (n4.noise(x * 0.5, y * 0.5) - 0.5) * 0.4);
      const col = lerp3(hex3('#3a2420'), hex3('#d79a6c'), band(light, 5, x, y));
      o[0] = col[0];
      o[1] = col[1];
      o[2] = col[2];
      o[3] = 255;
    });
  }
  yield* boulder(48, 300, 46, 30, 11);
  yield* boulder(86, 312, 22, 13, 12);
  yield* boulder(560, 290, 38, 24, 13);
  yield* boulder(604, 332, 58, 34, 14);
  yield* boulder(156, 246, 16, 9, 15);
  yield* boulder(500, 236, 12, 7, 16);
  yield* boulder(178, 340, 30, 16, 17);

  /* ---------- dead trees ---------- */
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    if (depth <= 0 || len < 2) return;
    const x2 = x + Math.sin(a) * len;
    const y2 = y - Math.cos(a) * len;
    ctx.strokeStyle = '#1e1216';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    branch(x2, y2, a - 0.45 - hash(x2) * 0.3, len * 0.72, Math.max(1, w * 0.65), depth - 1);
    branch(x2, y2, a + 0.4 + hash(y2) * 0.3, len * 0.68, Math.max(1, w * 0.65), depth - 1);
  };
  branch(612, 268, -0.12, 22, 3, 5);
  branch(120, 228, 0.1, 10, 1.5, 4);

  /* ---------- rusted vehicle wreck half-buried ---------- */
  ctx.fillStyle = '#24161a';
  ctx.beginPath();
  ctx.moveTo(462, 254);
  ctx.lineTo(470, 242);
  ctx.lineTo(488, 238);
  ctx.lineTo(500, 244);
  ctx.lineTo(518, 246);
  ctx.lineTo(520, 254);
  ctx.closePath();
  ctx.fill();
  R(ctx, 474, 242, 10, 4, '#6a3a2a');
  R(ctx, 488, 241, 8, 3, '#8a4a30');
  R(ctx, 500, 247, 16, 2, '#7a4028');
  ctx.fillStyle = 'rgba(30,16,18,0.4)';
  ctx.fillRect(430, 253, 40, 2);

  return c;
});
export function getWastelandLand(): HTMLCanvasElement {
  return landJob.get();
}

/* ================================================================== *
 *  Crater pieces (back half behind the robot, front lip on top)
 * ================================================================== */
const CX = 324;
const CY = 272;
const CRX = 112;
const CRY = 22;

function craterBack(ctx: CanvasRenderingContext2D, glow: number, t: number) {
  // ejecta rays
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + hash(i) * 0.2;
    const len = 30 + hash(i * 3.7) * 120;
    const x0 = CX + Math.cos(a) * CRX * 1.05;
    const y0 = CY + Math.sin(a) * CRY * 1.05;
    ctx.strokeStyle = 'rgba(40,24,20,0.38)';
    ctx.lineWidth = 2 + hash(i * 2.1) * 4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len * (CRY / CRX) * 1.4);
    ctx.stroke();
  }
  // raised outer rim
  ctx.fillStyle = '#4a3024';
  ctx.beginPath();
  ctx.ellipse(CX, CY - 2, CRX + 16, CRY + 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8c5c3e';
  ctx.beginPath();
  ctx.ellipse(CX, CY - 4, CRX + 12, CRY + 5, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // pit
  const g = ctx.createRadialGradient(CX, CY + 4, 4, CX, CY, CRX);
  g.addColorStop(0, '#120806');
  g.addColorStop(0.6, '#1e110c');
  g.addColorStop(1, '#3a2218');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(CX, CY, CRX, CRY, 0, 0, Math.PI * 2);
  ctx.fill();
  // back inner wall catching the glow
  ctx.fillStyle = `rgba(${150 + glow * 100},${70 + glow * 40},40,${0.35 + glow * 0.35})`;
  ctx.beginPath();
  ctx.ellipse(CX, CY - 3, CRX - 6, CRY - 6, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.ellipse(CX, CY + 2, CRX - 22, CRY - 10, 0, Math.PI * 1.95, Math.PI * 1.05, true);
  ctx.fill();
  // molten fractures on the floor
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const x0 = CX - 70 + i * 17 + hash(i) * 6;
    const y0 = CY + 2 + hash(i * 3) * 8;
    ctx.strokeStyle = rgba(i % 3 === 0 ? '#fde047' : '#f97316', glow * (0.6 + 0.4 * Math.sin(t * 5 + i)));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + 6, y0 + 2 - hash(i * 7) * 4);
    ctx.lineTo(x0 + 12, y0 + 1);
    ctx.stroke();
  }
  ctx.restore();
  drawBlob(ctx, '#ff6a1a', CX, CY + 2, 90, glow * 0.45);

  // Fracture rays and angular ejecta break up the artificially perfect ellipse.
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2 + hash(i) * 0.15;
    const r = 1.04 + hash(i * 3) * 0.18;
    const xx = CX + Math.cos(a) * CRX * r;
    const yy = CY + Math.sin(a) * CRY * r;
    const w = 3 + hash(i * 7) * 11;
    const h = 2 + hash(i * 5) * 5;
    px(ctx, xx, yy - h, w, h, i % 2 ? '#5b3926' : '#7e5335');
    px(ctx, xx + 1, yy - h, w - 2, 1, '#c18b55');
    const dir = Math.sign(xx - CX);
    if (i % 3 === 0) {
      pixelLine(ctx, [xx, yy], [xx + dir * 18, yy + 3], '#2b201a');
      pixelLine(ctx, [xx + dir * 18, yy + 3], [xx + dir * 29, yy + 1], '#34251b');
    }
  }
}

function craterFront(ctx: CanvasRenderingContext2D, glow: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(CX - CRX - 30, CY + 1, (CRX + 30) * 2, 40);
  ctx.clip();
  ctx.fillStyle = '#3e281e';
  ctx.beginPath();
  ctx.ellipse(CX, CY + 3, CRX + 16, CRY + 9, 0, 0, Math.PI * 2);
  ctx.ellipse(CX, CY - 1, CRX - 2, CRY - 1, 0, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.fillStyle = '#9a6a48';
  ctx.beginPath();
  ctx.ellipse(CX, CY - 1, CRX, CRY + 1, 0, 0.05, Math.PI - 0.05);
  ctx.ellipse(CX, CY - 1, CRX - 3, CRY - 2, 0, Math.PI - 0.05, 0.05, true);
  ctx.fill();
  ctx.restore();
  // rim rubble
  for (let i = 0; i < 26; i++) {
    const a = hash(i * 9.1) * Math.PI;
    const x = CX + Math.cos(a) * (CRX + 8 + hash(i) * 26);
    const y = CY + 2 + Math.sin(a) * (CRY + 6 + hash(i * 2) * 10);
    const s = 2 + hash(i * 4.4) * 5;
    R(ctx, x - s / 2, y - s / 2, s, s * 0.7, INK);
    R(ctx, x - s / 2 + 1, y - s / 2, s - 1, s * 0.5, hash(i) > 0.5 ? '#9a6a48' : '#5e3e2c');
  }
  drawBlob(ctx, '#ff7a2a', CX, CY + 10, 60, glow * 0.15);
}

/* ================================================================== *
 *  Scene draw
 * ================================================================== */
export function drawImpact(ctx: CanvasRenderingContext2D, t: number) {
  const impactT = 0.85;
  const after = t - impactT;
  const shakeAmp = after < 0 ? clamp(t / impactT) * 1.5 : after < 1.4 ? (1 - after / 1.4) ** 2 * 11 : 0;
  const [sx, sy] = shake(t, shakeAmp);
  const punch = after > 0 && after < 0.6 ? 1 + (1 - after / 0.6) * 0.04 : 1;

  ctx.save();
  ctx.translate(CW / 2 + sx, CH / 2 + sy);
  ctx.scale(punch, punch);
  ctx.translate(-CW / 2, -CH / 2);
  const land = landJob.peek();
  if (land) ctx.drawImage(land, 0, 0);
  else {
    R(ctx, 0, 0, CW, HORIZON, '#6c3a52');
    R(ctx, 0, HORIZON, CW, CH - HORIZON, '#5a3b2c');
  }

  // sun-side warm cloud drift
  for (let i = 0; i < 4; i++) {
    const x = ((i * 190 + t * 6) % 760) - 60;
    drawBlob(ctx, '#ffb27a', x, 70 + i * 22, 70, 0.05, true);
  }

  if (after < 0) {
    /* ---- incoming meteor: shallow diagonal from upper-left ---- */
    const k = clamp(t / impactT);
    const kk = k * k * 0.4 + k * 0.6;
    const mx = lerp(-60, CX, kk);
    const my = lerp(-70, CY - 10, kk);
    const ang = Math.atan2(CX + 60, CY - 10 + 70);
    const R0 = 30;
    // smoke trail across the sky
    for (let i = 0; i < qn(30, 0.4); i++) {
      const d = i / 30;
      const px = mx - Math.sin(ang) * d * 520;
      const py = my - Math.cos(ang) * d * 520;
      drawPuff(ctx, i, '#8a7068', '#2c2026', px + Math.sin(i) * 6, py, 18 + d * 46, (1 - d) * 0.55);
    }
    plasmaWake(ctx, mx, my, ang, 1, t * 1.6, R0);
    heatedRobot(ctx, { x: mx, y: my, s: 2.6, t, state: 'falling', rot: t * 4, eye: 'surprised', damage: 1, paintMix: 1, drill: false }, 1, ang);
    plasmaFront(ctx, mx, my, ang, 1, t * 1.6, R0);
    // ground lights up as it approaches
    drawBlob(ctx, '#ff8a3a', CX, CY, 140 + k * 140, k * k * 0.55);
    drawBlob(ctx, '#ff8a3a', mx, my, 160, 0.35);
  } else {
    /* ---- crater & robot ---- */
    const glow = Math.max(0.12, 1 - after * 0.16);
    craterBack(ctx, glow, t);

    const reboot = ease((after - 2.0) / 1.8);
    heroRobot(ctx, {
      x: CX + Math.sin(after * 19) * Math.exp(-after * 5) * 8,
      y: CY - 15 * 4.2 + 2 - Math.abs(Math.sin(after * 12)) * Math.exp(-after * 5) * 16,
      s: 4.2,
      t,
      state: after > 4.2 ? 'sad' : 'crash',
      damage: 1,
      power: reboot < 0.04 ? 0 : Math.max(0.14, reboot),
      eye: reboot > 0.45 ? 'scan' : 'dead',
      rot: 0.22 + Math.sin(after * 13) * Math.exp(-after * 4) * 0.16,
      drill: false,
      look: 1,
      paintMix: 1,
    });
    // residual heat glow on the hull
    drawBlob(ctx, '#ff5a1a', CX, CY - 30, 50, clamp(1 - after / 3) * 0.5);
    craterFront(ctx, glow);

    // small ground fires around the crater
    for (let i = 0; i < 7; i++) {
      const fx = CX + (i - 3) * 38 + hash(i) * 14;
      const fy = CY + 12 + hash(i * 2) * 26 - (i === 0 || i === 6 ? 12 : 0);
      const life = clamp(1 - (after - 1) / (5 + hash(i) * 3));
      if (life <= 0 || after < 0.25) continue;
      const fl = 5 + Math.sin(t * 14 + i * 3) * 2;
      R(ctx, fx - 2, fy - fl * life, 4, fl * life, '#f97316');
      R(ctx, fx - 1, fy - fl * life * 0.6, 2, fl * life * 0.6, '#fde047');
      drawBlob(ctx, '#ff7a26', fx, fy - 3, 16, 0.4 * life);
    }

    /* ---- fireball ---- */
    if (after < 1.6) {
      const fr = ease(after / 0.45) * 95;
      const fade = clamp(1 - after / 1.6);
      const rise = after * 30;
      drawBlob(ctx, '#ffffff', CX, CY - 10 - rise, fr * 0.6, fade * 0.9);
      drawBlob(ctx, '#ffd27a', CX, CY - 16 - rise, fr * 1.0, fade * 0.8);
      drawBlob(ctx, '#ff6a1a', CX, CY - 22 - rise, fr * 1.5, fade * 0.65);
      drawBlob(ctx, '#a8281a', CX, CY - 30 - rise, fr * 2.0, fade * 0.35);
      for (let i = 0; i < 14; i++) {
        const a = Math.PI + (i / 13) * Math.PI;
        const rr = fr * (0.6 + hash(i) * 0.5);
        drawBlob(ctx, i % 2 ? '#ffb347' : '#ff5a1a', CX + Math.cos(a) * rr, CY - rise + Math.sin(a) * rr * 0.8, fr * 0.45, fade * 0.5);
      }
    }

    /* ---- ground shockwave & air refraction ring ---- */
    if (after < 1.2) {
      const k = after / 1.2;
      const rr = 30 + ease(k) * 520;
      ctx.strokeStyle = rgba('#ffe1ad', (1 - k) * 0.8);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(CX, CY + 4, rr, rr * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', (1 - k) * 0.25);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(CX, CY, rr * 1.3, Math.PI, Math.PI * 2);
      ctx.stroke();
    }

    /* ---- ballistic debris with smoke trails ---- */
    for (let i = 0; i < qn(48, 0.45); i++) {
      const a = -Math.PI / 2 + (hash(i * 3.3) - 0.5) * 2.5;
      const sp = 170 + hash(i * 5.1) * 300;
      const vx = Math.cos(a) * sp;
      const vy = Math.sin(a) * sp;
      const g = 520;
      const age = after;
      const px = CX + vx * age;
      const py = CY - 8 + vy * age + 0.5 * g * age * age;
      const groundY = CY + 8 + Math.abs(px - CX) * 0.12;
      if (py > groundY && age > 0.1) continue;
      const cvx = vx;
      const cvy = vy + g * age;
      const hot = clamp(1 - age * 1.8);
      ctx.strokeStyle = hot > 0.1 ? rgba('#ffb060', 0.7 * hot) : 'rgba(60,44,38,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - cvx * 0.04, py - cvy * 0.04);
      ctx.stroke();
      const s = 2 + hash(i * 1.3) * 5;
      R(ctx, px - s / 2, py - s / 2, s, s, INK);
      R(ctx, px - s / 2 + 1, py - s / 2 + 1, s - 2, s - 2, hot > 0.2 ? '#ff9a4a' : i % 2 ? '#8a5a40' : '#5a3a2c');
    }

    /* ---- dust column & base surge ---- */
    for (let i = 0; i < qn(44, 0.4); i++) {
      const birth = hash(i * 2.7) * 1.2;
      const age = after - birth;
      if (age < 0) continue;
      const life = age / 6.5;
      if (life > 1) continue;
      const rise = (1 - Math.exp(-age * 0.9)) * (110 + hash(i) * 120);
      const px = CX + (hash(i * 4.1) - 0.5) * (40 + age * 34) + age * 12;
      const py = CY - 10 - rise;
      const size = 26 + age * 22 + hash(i) * 20;
      const fireLit = clamp(1 - age * 0.7);
      drawPuff(ctx, i, fireLit > 0.3 ? '#e8a070' : '#a88a78', fireLit > 0.3 ? '#5a2e22' : '#3a2c2c', px, py, size, (1 - life) * 0.75);
    }
    const surgeK = 1 - Math.exp(-after * 1.5);
    for (let i = 0; i < qn(24, 0.45); i++) {
      const side = i % 2 ? 1 : -1;
      const rr = (50 + surgeK * 300) * (0.6 + hash(i) * 0.4);
      const px = CX + side * rr;
      const py = CY + 6 - hash(i * 3) * 18 + Math.abs(rr) * 0.02;
      drawPuff(ctx, i + 7, '#c49a7a', '#5a4034', px, py, 28 + surgeK * 30, clamp(1 - after / 3.6) * 0.7);
    }
    // dense dust veil over the crater that clears as the robot reboots
    const veil = clamp(1 - (after - 1.6) / 1.4) * clamp(after / 0.25);
    for (let i = 0; i < 10; i++) {
      drawPuff(ctx, i + 3, '#b8927a', '#4a3630', CX + (i - 4.5) * 22, CY - 18 - hash(i) * 26 - after * 6, 64, veil * 0.85);
    }

    // lingering smoke from the crater
    smokeAt(ctx, CX - 20, CY - 34, t, 7, '#a8a1a0', 9, 110);
    smokeAt(ctx, CX + 26, CY - 30, t + 1.3, 19, '#8e8584', 7, 90);
    heatShimmer(ctx, CX - 110, CY - 120, 220, 110, t, clamp(1 - after / 6) * 2.4 + 0.6);

    // warm light flooding the landscape
    drawBlob(ctx, '#ff8a3a', CX, CY - 20, 360, clamp(1 - after / 2.2) * 0.5);

    if (reboot > 0) {
      hudPanel(ctx, 38, 46, 196, 72, '#89c5d4');
      sign(ctx, 'CUBE-07 / SYSTEMS', 136, 66, '#9ee8eb', 6);
      sign(ctx, `HULL ${Math.round(12 + reboot * 3)}%`, 136, 84, Math.floor(t * 3) % 2 ? '#f4c576' : '#fca5a5', 7);
      bar(ctx, 58, 96, 156, 0.12 + reboot * 0.03, '#e8784b');
    }
  }
  ctx.restore();

  // impact flash
  if (after >= 0 && after < 0.25) {
    const k = 1 - after / 0.25;
    ctx.fillStyle = rgba('#fff6e0', k * 0.95);
    ctx.fillRect(0, 0, CW, CH);
  }
  grade(ctx, '#ff8a4a', 0.16, '#100810', 0.5);
}
