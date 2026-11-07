/* ================================================================== *
 *  SCENE 07 — PROJECT MINE 07 (remastered environment)
 *  Four parallax layers: sky/mountains, mid industrial ruins,
 *  main mine yard (headframe, hoist house, rails) and a dark foreground.
 * ================================================================== */
import { CH, CW, INK, R, cartSprite, clamp, hash, heroRobot, rgba, smokeAt, sparksAt } from './cutsceneArt';
import { motes } from './cinematicSets';
import {
  band,
  drawBlob,
  drawPuff,
  grade,
  hex3,
  lerp3,
  makeCanvas,
  makeNoise,
  paintPixelsGen,
  Job,
  sign,
  smooth,
  type RGB3,
} from './cineKit';
import { qn } from './quality';

const GROUND = 258;
interface MineLayers {
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  main: HTMLCanvasElement;
  fore: HTMLCanvasElement;
}



function lineSeg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, w = 1) {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function* buildFar(): Generator<unknown, HTMLCanvasElement, unknown> {
  const W = 680;
  const [c, ctx] = makeCanvas(W, CH);
  const n = makeNoise(707);
  const stops: Array<[number, RGB3]> = [
    [0, hex3('#151025')],
    [0.32, hex3('#3a2645')],
    [0.55, hex3('#87465a')],
    [0.7, hex3('#d47a56')],
    [0.78, hex3('#f2b072')],
  ];
  const skyAt = (y: number): RGB3 => {
    const k = clamp(y / CH);
    let i = 0;
    while (i < stops.length - 2 && k > stops[i + 1][0]) i++;
    return lerp3(stops[i][1], stops[i + 1][1], clamp((k - stops[i][0]) / (stops[i + 1][0] - stops[i][0])));
  };
  const SUNX = 150;
  const SUNY = 214;
  yield* paintPixelsGen(ctx, 0, 0, W, CH, (x, y, o) => {
    let col = skyAt(y);
    const dx = x - SUNX;
    const dy = (y - SUNY) * 1.5;
    const d = Math.sqrt(dx * dx + dy * dy);
    col = lerp3(col, hex3('#ffcf94'), clamp(1 - d / 260) * 0.6);
    // billowing storm clouds lit from below-left
    const cl = n.fbm(x * 0.008, y * 0.018, 5);
    const cov = smooth(0.47, 0.62, cl) * (1 - smooth(150, 215, y));
    if (cov > 0) {
      const under = n.fbm(x * 0.008 - 0.03, (y + 3) * 0.018, 5);
      const lit = clamp((cl - under) * 14 + 0.45) * 0.6 + clamp(1 - d / 360) * 0.5;
      const cc = lerp3(hex3('#2a1c34'), hex3('#ffb880'), band(lit, 5, x, y));
      col = lerp3(col, cc, cov);
    }
    if (d < 18) col = lerp3(col, hex3('#fff3d6'), clamp((18 - d) / 3));
    o[0] = col[0];
    o[1] = col[1];
    o[2] = col[2];
    o[3] = 255;
  });
  // ridged mountain ranges with haze
  function* range(base: number, amp: number, freq: number, seed: number, col: RGB3, hazeA: number) {
    const nn = makeNoise(seed);
    const tops = new Float32Array(W);
    const shades = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      tops[x] = base - nn.ridged(x * freq, seed * 0.1, 5) * amp;
      shades[x] = clamp((nn.ridged((x + 2) * freq, seed * 0.1, 5) - nn.ridged((x - 2) * freq, seed * 0.1, 5)) * 6 + 0.5);
    }
    const dark = lerp3(col, hex3('#1a1020'), 0.5);
    const lite = lerp3(col, hex3('#ffb48a'), 0.25);
    const hz = skyAt(base - 10);
    const y0 = Math.floor(base - amp - 2);
    yield* paintPixelsGen(ctx, 0, y0, W, CH - y0, (x, y, o) => {
      const top = tops[x];
      if (y < top) return;
      let cc = lerp3(dark, lite, band(1 - shades[x], 3, x, y));
      cc = lerp3(cc, hz, hazeA * clamp(1 - (y - top) / 160));
      o[0] = cc[0];
      o[1] = cc[1];
      o[2] = cc[2];
      o[3] = 255;
    });
  }
  yield* range(206, 70, 0.006, 31, hex3('#5a3a55'), 0.7);
  yield* range(226, 48, 0.011, 57, hex3('#4a2e40'), 0.45);
  return c;
}

function* buildMid(): Generator<unknown, HTMLCanvasElement, unknown> {
  const W = 720;
  const [c, ctx] = makeCanvas(W, CH);
  const n = makeNoise(808);
  const haze = hex3('#a35a5a');
  // rolling hills & tailings terraces
  const hillTop = new Float32Array(W);
  const terrA = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const h = 26 + n.fbm(x * 0.008, 3, 4) * 34;
    const terr = x > 380 && x < 600 ? Math.min(40, Math.min(x - 380, 600 - x) * 0.45) : 0;
    terrA[x] = terr;
    hillTop[x] = 244 - Math.max(h, Math.floor(terr / 8) * 8 + 18);
  }
  const hillBase = hex3('#4e2f38');
  yield* paintPixelsGen(ctx, 0, 150, W, CH - 150, (x, y, o) => {
    const top = hillTop[x];
    if (y < top) return;
    const stripe = terrA[x] > 0 && (y - Math.floor(top)) % 8 < 2 ? 0.12 : 0;
    const cc = lerp3(hillBase, haze, 0.35 + stripe + band(n.noise(x * 0.1, y * 0.1), 3, x, y) * 0.08);
    o[0] = cc[0];
    o[1] = cc[1];
    o[2] = cc[2];
    o[3] = 255;
  });
  const silh = '#3c2430';
  // water tower
  const wt = 250;
  for (const lx of [-14, 14]) lineSeg(ctx, wt + lx, 232, wt + lx * 0.6, 168, silh, 2);
  lineSeg(ctx, wt - 12, 212, wt + 12, 190, silh);
  lineSeg(ctx, wt + 12, 212, wt - 12, 190, silh);
  R(ctx, wt - 20, 140, 40, 28, silh);
  R(ctx, wt - 22, 138, 44, 4, silh);
  ctx.fillStyle = silh;
  ctx.beginPath();
  ctx.moveTo(wt - 22, 138);
  ctx.lineTo(wt, 124);
  ctx.lineTo(wt + 22, 138);
  ctx.fill();
  R(ctx, wt + 6, 144, 3, 22, 'rgba(255,170,120,0.25)');
  // inclined conveyor gantry to tailings
  lineSeg(ctx, 330, 230, 470, 178, silh, 4);
  lineSeg(ctx, 330, 236, 470, 184, silh, 1);
  for (let k = 0; k < 7; k++) {
    const x = 340 + k * 20;
    const y = 226 - k * 7.4;
    lineSeg(ctx, x, y, x, 240, silh, 1.5);
  }
  R(ctx, 462, 168, 22, 18, silh);
  // power pylons with sagging wires
  const pyl = [40, 170, 560, 690];
  pyl.forEach((px) => {
    lineSeg(ctx, px - 7, 240, px, 150, silh, 1.5);
    lineSeg(ctx, px + 7, 240, px, 150, silh, 1.5);
    lineSeg(ctx, px - 12, 162, px + 12, 162, silh, 2);
    lineSeg(ctx, px - 8, 176, px + 8, 176, silh, 1.5);
    for (let y = 182; y < 238; y += 12) {
      lineSeg(ctx, px - 5, y, px + 5, y + 10, silh, 1);
      lineSeg(ctx, px + 5, y, px - 5, y + 10, silh, 1);
    }
  });
  ctx.strokeStyle = 'rgba(40,22,30,0.85)';
  ctx.lineWidth = 1;
  for (let i = 0; i < pyl.length - 1; i++) {
    for (const dy of [0, 14]) {
      ctx.beginPath();
      ctx.moveTo(pyl[i] + 12, 162 + dy);
      ctx.quadraticCurveTo((pyl[i] + pyl[i + 1]) / 2, 196 + dy, pyl[i + 1] - 12, 162 + dy);
      ctx.stroke();
    }
  }
  // ruined silo cluster
  for (const [x, w, h] of [[610, 20, 74], [632, 18, 60], [652, 16, 48]] as const) {
    R(ctx, x, 236 - h, w, h, silh);
    ctx.fillStyle = silh;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, 236 - h, w / 2, 5, 0, Math.PI, 0);
    ctx.fill();
    R(ctx, x + w - 4, 236 - h + 4, 2, h - 8, 'rgba(255,170,120,0.18)');
  }
  // atmospheric haze over the mid layer
  const hz = ctx.createLinearGradient(0, 120, 0, 260);
  hz.addColorStop(0, 'rgba(214,122,96,0)');
  hz.addColorStop(1, 'rgba(214,122,96,0.32)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = hz;
  ctx.fillRect(0, 0, W, CH);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

function* rustPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, base: string) {
  const n = makeNoise(seed);
  const b = hex3(base);
  const rust = hex3('#8a3e1c');
  const dark = hex3('#1c1214');
  yield* paintPixelsGen(ctx, x, y, w, h, (px, py, o) => {
    const lx = px - x;
    const ly = py - y;
    const corr = lx % 6 < 1 ? 0.65 : lx % 6 < 2 ? 1.2 : 1;
    const streak = n.fbm(px * 0.25, py * 0.03, 3);
    let col = lerp3(b, rust, smooth(0.45, 0.75, streak) * 0.8);
    col = lerp3(col, dark, smooth(0.6, 0.9, n.fbm(px * 0.1, py * 0.1, 3)) * 0.5);
    const lit = clamp(0.55 * corr - ly / h * 0.25 + (n.noise(px * 0.6, py * 0.6) - 0.5) * 0.2);
    col = lerp3(dark, col, 0.45 + band(lit, 4, px, py) * 0.7);
    o[0] = col[0];
    o[1] = col[1];
    o[2] = col[2];
    o[3] = 255;
  });
  R(ctx, x - 1, y - 1, w + 2, 1, INK);
  R(ctx, x - 1, y, 1, h, INK);
  R(ctx, x + w, y, 1, h, INK);
}

function* buildMain(): Generator<unknown, HTMLCanvasElement, unknown> {
  const W = 760;
  const [c, ctx] = makeCanvas(W, CH);
  const n = makeNoise(909);

  /* ---- hoist house (brick, broken lit windows) ---- */
  const hhx = 640;
  yield* rustPanel(ctx, hhx, 168, 120, 90, 41, '#6a3a2e');
  for (let by = 170; by < 256; by += 5) for (let bx = hhx + ((by / 5) % 2) * 5; bx < hhx + 120; bx += 10) R(ctx, bx, by, 1, 4, 'rgba(20,10,10,0.35)');
  R(ctx, hhx - 6, 160, 132, 9, INK);
  R(ctx, hhx - 4, 162, 128, 5, '#4a3a3e');
  for (let i = 0; i < 3; i++) {
    const wx = hhx + 14 + i * 36;
    R(ctx, wx - 1, 186, 24, 30, INK);
    R(ctx, wx, 187, 22, 28, '#24161a');
    R(ctx, wx + 1, 188, 9, 12, i === 1 ? '#ffcf7a' : '#3a2a30');
    R(ctx, wx + 12, 202, 9, 12, '#3a2a30');
    if (i !== 1) R(ctx, wx + 4, 190, 2, 2, '#ffb36a');
  }
  // cable from hoist house drum up to the sheave
  lineSeg(ctx, hhx + 10, 196, 560, 56, '#1a1214', 1.5);

  /* ---- headframe (A-frame steel lattice) ---- */
  const hx0 = 480;
  const hx1 = 610;
  const top = 50;
  const legL = (y: number) => hx0 + (y - GROUND) * -0.12;
  const legR = (y: number) => hx1 - (y - GROUND) * -0.12;
  const steel = '#7a4a32';
  const steelLite = '#b8784a';
  const steelDark = '#3a2018';
  for (const leg of [legL, legR]) {
    for (let y = top; y < GROUND; y++) {
      const x = leg(y);
      R(ctx, x - 5, y, 10, 1, INK);
      R(ctx, x - 4, y, 8, 1, steel);
      R(ctx, x - 4, y, 2, 1, steelLite);
      R(ctx, x + 2, y, 2, 1, steelDark);
      if (hash(y * 3.1 + x) > 0.93) R(ctx, x - 3, y, 3, 2, '#9a4a1e');
    }
  }
  // back brace leg toward hoist house
  for (let k = 0; k <= 1; k += 0.004) {
    const x = 590 + k * 110;
    const y = 70 + k * (GROUND - 70);
    R(ctx, x - 3, y, 6, 2, INK);
    R(ctx, x - 2, y, 4, 2, steelDark);
  }
  // lattice cross-bracing
  for (let y = top + 18; y < GROUND - 10; y += 26) {
    const xl = legL(y);
    const xr = legR(y);
    const xl2 = legL(y + 26);
    const xr2 = legR(y + 26);
    R(ctx, xl, y - 2, xr - xl, 5, INK);
    R(ctx, xl, y - 1, xr - xl, 3, steel);
    R(ctx, xl, y - 1, xr - xl, 1, steelLite);
    lineSeg(ctx, xl, y, xr2, y + 26, INK, 3);
    lineSeg(ctx, xr, y, xl2, y + 26, INK, 3);
    lineSeg(ctx, xl, y, xr2, y + 26, steelDark, 1.5);
    lineSeg(ctx, xr, y, xl2, y + 26, steelDark, 1.5);
    for (const rx of [xl + 3, xr - 4]) R(ctx, rx, y, 2, 2, '#e0a070');
  }
  // sheave deck & railing
  R(ctx, hx0 - 26, top - 6, hx1 - hx0 + 52, 10, INK);
  R(ctx, hx0 - 24, top - 4, hx1 - hx0 + 48, 6, '#8a5a3a');
  R(ctx, hx0 - 24, top - 4, hx1 - hx0 + 48, 2, steelLite);
  for (let x = hx0 - 22; x < hx1 + 24; x += 9) R(ctx, x, top - 16, 1.5, 12, '#2a1a16');
  R(ctx, hx0 - 24, top - 17, hx1 - hx0 + 48, 2, '#3a2420');
  // sheave housing (the wheel itself is drawn live)
  R(ctx, 534, top - 40, 52, 36, INK);
  R(ctx, 537, top - 37, 46, 30, '#4a3024');
  // shaft collar & dark mouth
  R(ctx, hx0 + 10, GROUND - 26, hx1 - hx0 - 20, 26, INK);
  R(ctx, hx0 + 12, GROUND - 24, hx1 - hx0 - 24, 24, '#6a625c');
  R(ctx, hx0 + 12, GROUND - 24, hx1 - hx0 - 24, 3, '#9a928a');
  R(ctx, hx0 + 30, GROUND - 20, hx1 - hx0 - 60, 20, '#08060a');
  R(ctx, hx0 + 32, GROUND - 18, hx1 - hx0 - 64, 3, '#1a1416');
  // hoist cables down into the shaft
  lineSeg(ctx, 548, top - 4, 548, GROUND - 20, '#1a1214', 1);
  lineSeg(ctx, 572, top - 4, 572, GROUND - 20, '#1a1214', 1);
  // DANGER sign on the collar
  R(ctx, hx0 + 82, GROUND - 46, 30, 18, INK);
  R(ctx, hx0 + 83, GROUND - 45, 28, 16, '#d9a520');
  R(ctx, hx0 + 83, GROUND - 45, 28, 4, '#a02020');

  /* ---- rusted generator shed (left) ---- */
  yield* rustPanel(ctx, 40, 196, 128, 62, 51, '#5a5450');
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(32, 198);
  ctx.lineTo(104, 176);
  ctx.lineTo(176, 198);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6a3a28';
  ctx.beginPath();
  ctx.moveTo(36, 197);
  ctx.lineTo(104, 179);
  ctx.lineTo(172, 197);
  ctx.closePath();
  ctx.fill();
  for (let x = 40; x < 170; x += 7) lineSeg(ctx, x, 197, 104 + (x - 104) * 0.1, 181, 'rgba(30,14,10,0.4)');
  R(ctx, 64, 214, 40, 44, INK);
  R(ctx, 66, 216, 36, 42, '#140c0e');
  // door hanging off one hinge
  ctx.save();
  ctx.translate(66, 216);
  ctx.rotate(0.18);
  R(ctx, 0, 0, 17, 40, '#4a3a34');
  R(ctx, 0, 0, 17, 2, '#6a5a50');
  R(ctx, 12, 18, 3, 2, '#9a8a7a');
  ctx.restore();
  R(ctx, 118, 212, 30, 14, INK);
  R(ctx, 120, 214, 26, 10, '#2a2228');
  R(ctx, 121, 215, 10, 8, '#4a5560');
  sign(ctx, 'GEN-2', 132, 244, '#c8b89a', 5);

  /* ---- chain-link fence with barbed wire ---- */
  for (let x = 190; x < 450; x += 34) {
    R(ctx, x, 206, 3, 48, INK);
    R(ctx, x + 1, 206, 1, 48, '#6a625c');
    lineSeg(ctx, x, 206, x + 6, 200, '#2a2224');
  }
  ctx.save();
  ctx.globalAlpha = 0.32;
  for (let x = 190; x < 450; x += 4) {
    lineSeg(ctx, x, 212, x + 14, 252, '#8a827a', 0.6);
    lineSeg(ctx, x + 14, 212, x, 252, '#8a827a', 0.6);
  }
  ctx.restore();
  // torn section
  R(ctx, 320, 222, 26, 30, 'rgba(0,0,0,0)');
  ctx.strokeStyle = '#2a2224';
  ctx.lineWidth = 1;
  for (const y of [201, 205]) {
    ctx.beginPath();
    ctx.moveTo(190, y);
    for (let x = 190; x < 452; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.7) * 1.5 + ((x - 190) % 34) * 0.06);
    ctx.stroke();
  }

  /* ---- floodlight tower ---- */
  R(ctx, 232, 160, 4, GROUND - 160, INK);
  R(ctx, 233, 160, 2, GROUND - 160, '#4a4244');
  lineSeg(ctx, 234, 180, 214, GROUND, '#2a2224');
  lineSeg(ctx, 234, 180, 254, GROUND, '#2a2224');
  R(ctx, 222, 154, 24, 8, INK);
  R(ctx, 224, 156, 9, 4, '#3a3234');
  R(ctx, 235, 156, 9, 4, '#3a3234');

  /* ---- ground ---- */
  const dirt = hex3('#6a4632');
  const dirtDark = hex3('#2e1e18');
  const dirtLite = hex3('#b07a52');
  yield* paintPixelsGen(ctx, 0, GROUND - 4, W, CH - GROUND + 4, (x, y, o) => {
    const edge = n.fbm(x * 0.05, 1, 3) * 6;
    if (y < GROUND - 4 + edge * 0.6) {
      o[3] = 0;
      return;
    }
    const d = (y - GROUND) / (CH - GROUND);
    const z = 1 / (d + 0.12);
    const m = n.fbm(x * 0.03 * z * 0.3, y * 0.12, 4);
    let col = lerp3(dirt, m > 0.5 ? dirtLite : dirtDark, Math.abs(m - 0.5) * 1.2);
    col = lerp3(col, dirtDark, clamp(d * 0.9));
    if (hash(x * 7.3 + y * 3.9) > 0.985) col = lerp3(col, hex3('#c8a080'), 0.5);
    if (hash(x * 1.3 + y * 9.1) > 0.99) col = dirtDark;
    const l = band(0.5 + (n.noise(x * 0.4, y * 0.4) - 0.5) * 0.3, 5, x, y);
    o[0] = col[0] * (0.88 + l * 0.24);
    o[1] = col[1] * (0.88 + l * 0.24);
    o[2] = col[2] * (0.88 + l * 0.24);
    o[3] = 255;
  });
  // rail track (ties + rail)
  for (let tx = 0; tx < W; tx += 13) {
    R(ctx, tx, GROUND, 9, 4, INK);
    R(ctx, tx + 1, GROUND, 7, 3, '#4a3020');
    R(ctx, tx + 1, GROUND, 7, 1, '#6a4a30');
  }
  R(ctx, 0, GROUND - 2, W, 3, '#2a2224');
  R(ctx, 0, GROUND - 2, W, 1, '#a8a29e');
  for (let x = 0; x < W; x += 3) if (hash(x) > 0.6) R(ctx, x, GROUND - 1, 2, 1, '#8a4a2a');

  /* ---- yard clutter ---- */
  const barrel = (x: number, y: number, col: string, tipped = false) => {
    if (tipped) {
      R(ctx, x - 1, y - 11, 20, 12, INK);
      R(ctx, x, y - 10, 18, 10, col);
      R(ctx, x, y - 10, 18, 2, rgba('#ffffff', 0.18));
      R(ctx, x + 5, y - 10, 1, 10, INK);
      R(ctx, x + 12, y - 10, 1, 10, INK);
      R(ctx, x + 18, y - 9, 2, 8, '#1a1214');
      return;
    }
    R(ctx, x - 1, y - 19, 14, 20, INK);
    R(ctx, x, y - 18, 12, 18, col);
    R(ctx, x + 8, y - 18, 3, 18, rgba('#ffffff', 0.15));
    R(ctx, x, y - 13, 12, 1, INK);
    R(ctx, x, y - 6, 12, 1, INK);
    R(ctx, x + 2, y - 11, 3, 3, '#e0c040');
  };
  barrel(176, GROUND + 2, '#5a6a3a');
  barrel(190, GROUND + 2, '#7a3a2a');
  barrel(196, GROUND + 6, '#4a5560', true);
  barrel(452, GROUND + 1, '#7a5a2a');
  // crates
  for (const [x, y, s] of [[612, GROUND, 18], [628, GROUND, 14], [618, GROUND - 14, 13]] as const) {
    R(ctx, x - 1, y - s - 1, s + 2, s + 2, INK);
    R(ctx, x, y - s, s, s, '#7a5a3a');
    R(ctx, x, y - s, s, 2, '#a07a52');
    lineSeg(ctx, x, y - s, x + s, y, '#4a3020');
  }
  ctx.drawImage(cartSprite(), 556, 226, 70, 48);
  return c;
}

function* buildFore(): Generator<unknown, HTMLCanvasElement, unknown> {
  const W = 800;
  const [c, ctx] = makeCanvas(W, CH);
  const n = makeNoise(1111);
  // dark foreground mounds with dry grass, out of the key light
  yield* paintPixelsGen(ctx, 0, 300, W, 60, (x, y, o) => {
    const h = 330 - n.fbm(x * 0.01, 2, 4) * 40 - (Math.sin(x * 0.012) > 0.6 ? 14 : 0);
    if (y < h) {
      o[3] = 0;
      return;
    }
    const col = lerp3(hex3('#2a1a16'), hex3('#120a0c'), clamp((y - h) / 20));
    const rim = y - h < 1.5 ? 0.6 : 0;
    const cc = lerp3(col, hex3('#c87a50'), rim);
    o[0] = cc[0];
    o[1] = cc[1];
    o[2] = cc[2];
    o[3] = 255;
  });
  // grass tufts
  for (let i = 0; i < 60; i++) {
    const x = hash(i * 4.7) * W;
    const base = 330 - n.fbm(x * 0.01, 2, 4) * 40 + 4;
    for (let b = 0; b < 6; b++) {
      const lean = (hash(i * 9 + b) - 0.5) * 6;
      const h = 6 + hash(i + b * 3) * 12;
      lineSeg(ctx, x + b * 1.5, base, x + b * 1.5 + lean, base - h, b % 2 ? '#3a2418' : '#5a3a22', 1);
    }
  }
  // broken fence post close to camera
  R(ctx, 140, 270, 9, 70, '#140c0c');
  R(ctx, 141, 270, 2, 70, '#5a3a2a');
  lineSeg(ctx, 144, 280, 230, 296, '#1a1010', 1);
  return c;
}

export const mineJob = new Job(function* (): Generator<unknown, MineLayers, unknown> {
  const far = yield* buildFar();
  const mid = yield* buildMid();
  const main = yield* buildMain();
  const fore = yield* buildFore();
  return { far, mid, main, fore };
});
export function getMineLayers(): MineLayers {
  return mineJob.get();
}

/* ---------------- live FX helpers ---------------- */
function tumbleweed(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = '#6a4a2e';
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (0.6 + hash(i) * 0.4), r * (0.4 + hash(i + 3) * 0.5), i * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#a07a4a';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, 0.3, 1.6);
  ctx.stroke();
  ctx.restore();
}

function crow(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, s: number) {
  const flap = Math.sin(t * 9);
  ctx.fillStyle = '#120a10';
  ctx.beginPath();
  ctx.ellipse(x, y, 3 * s, 1.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#120a10';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(x - 1, y);
  ctx.lineTo(x - 4 * s, y - flap * 4 * s);
  ctx.lineTo(x - 7 * s, y - flap * 2 * s);
  ctx.moveTo(x + 1, y);
  ctx.lineTo(x + 3 * s, y - flap * 4 * s);
  ctx.lineTo(x + 6 * s, y - flap * 2.5 * s);
  ctx.stroke();
}

/* ---------------- scene ---------------- */
export function drawMineScene(ctx: CanvasRenderingContext2D, t: number) {
  const L = mineJob.peek();
  if (!L) {
    R(ctx, 0, 0, CW, CH, '#2b1c2a');
    R(ctx, 0, 258, CW, CH - 258, '#4e2f38');
    return;
  }
  const raw = clamp(t / 6.3);
  const lurch = t * 5.5;
  const dist = clamp(raw + Math.sin(lurch) * 0.008 * (1 - raw));
  const pan = 2 + dist * 75;

  ctx.drawImage(L.far, -Math.round(pan * 0.15), 0);
  // slow drifting cloud shadows
  for (let i = 0; i < 3; i++) drawBlob(ctx, '#ffb27a', ((i * 260 + t * 8) % 900) - 120, 120 + i * 18, 90, 0.05);
  ctx.drawImage(L.mid, -Math.round(pan * 0.5), 0);

  // wind-blown dust sheets low across the mid-ground
  ctx.save();
  for (let i = 0; i < qn(26, 0.4); i++) {
    const y = 200 + hash(i * 3.3) * 70;
    const x = ((hash(i) * 900 + t * (90 + hash(i * 2) * 80)) % 900) - 130;
    ctx.globalAlpha = 0.12 + hash(i * 5) * 0.12;
    R(ctx, x, y, 40 + hash(i * 7) * 70, 1, '#e8b088');
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-Math.round(pan), 0);
  ctx.drawImage(L.main, 0, 0);

  // sheave wheel turning slowly (wind) with spokes
  const wx = 560;
  const wy = 28;
  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(Math.sin(t * 0.6) * 0.4 + t * 0.15);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#9a6a42';
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctx.strokeStyle = '#5a3a28';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
    ctx.stroke();
  }
  R(ctx, -3, -3, 6, 6, '#c8a070');
  ctx.restore();

  // swinging chain & hook under the deck
  const sw = Math.sin(t * 1.6) * 0.22;
  const hx = 510 + Math.sin(sw) * 34;
  const hy = 48 + Math.cos(sw) * 34;
  ctx.strokeStyle = '#2a1e1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(510, 48);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  R(ctx, hx - 2, hy, 4, 5, '#4a3a34');

  // MINE 07 timber placard on the headframe cross-beam
  const signX = 544;
  R(ctx, signX - 58, 198, 116, 22, '#241816');
  R(ctx, signX - 55, 200, 110, 18, '#957450');
  R(ctx, signX - 55, 200, 110, 2, '#c2a075');
  for (let k = 0; k < 5; k++) R(ctx, signX - 50 + k * 24, 205 + (k % 2) * 6, 12, 1, 'rgba(60,40,24,0.35)');
  R(ctx, signX - 52, 202, 2, 2, '#3a2a20');
  R(ctx, signX + 50, 202, 2, 2, '#3a2a20');
  sign(ctx, 'MINE 07', signX, 213, '#2b1e1a', 8);

  // flickering floodlight with volumetric cone
  const flick = Math.sin(t * 31) > -0.6 && Math.sin(t * 7.3) > -0.85 ? 1 : 0.15;
  R(ctx, 236, 156, 7, 4, flick > 0.5 ? '#fff1c0' : '#5a5040');
  if (flick > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(240, 158, 300, GROUND);
    g.addColorStop(0, 'rgba(255,236,180,0.28)');
    g.addColorStop(1, 'rgba(255,236,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(236, 160);
    ctx.lineTo(244, 160);
    ctx.lineTo(330, GROUND);
    ctx.lineTo(250, GROUND);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawBlob(ctx, '#ffe6b0', 240, 158, 20, 0.6);
  }
  // hoist house window glow
  drawBlob(ctx, '#ffb060', 690, 194, 22, 0.35 + 0.05 * Math.sin(t * 9));

  /* ---- CUBE-07 crawling on its broken tread ---- */
  const x = 92 + dist * 274 + pan;
  for (let tx = 24 + pan * 0; tx < x - 28; tx += 9) {
    R(ctx, tx, GROUND + 1, 5, 2, '#3b2820');
    R(ctx, tx + 1, GROUND + 3, 4, 1, '#241814');
  }
  const catchPhase = Math.sin(lurch);
  heroRobot(ctx, {
    x,
    y: GROUND - 15 * 3.6,
    s: 3.6,
    t,
    state: 'sad',
    damage: 0.82,
    eye: t > 5 ? 'scan' : 'normal',
    drill: false,
    look: t > 4.4 ? 1 : 0,
    rot: catchPhase * 0.032,
    paintMix: 1,
    wheelPhase: dist * 18,
    brokenWheel: true,
  });
  // warm key-light rim from the low sun (left) & cold fill on the right
  drawBlob(ctx, '#ffb070', x - 30, GROUND - 40, 40, 0.12);
  if (raw < 0.96 && catchPhase > 0.55) sparksAt(ctx, x + 22, GROUND - 3, t, 41, 7, 14);
  for (let i = 0; i < 6; i++) {
    const age = (t * 1.3 + i / 6) % 1;
    drawPuff(ctx, i, '#b08a68', '#4a3428', x - 30 - age * 40, GROUND - 4 - age * 14, 8 + age * 16, (1 - age) * 0.45);
  }
  smokeAt(ctx, x - 16, GROUND - 41, t, 19, '#a29a95', 5, 36);
  ctx.restore();

  // tumbleweed bouncing across
  const tw = (t * 70) % 900 - 100;
  const bounce = Math.abs(Math.sin(t * 4)) * 14;
  tumbleweed(ctx, tw, GROUND + 6 - bounce, 8, t * 6);

  // crows wheeling over the headframe
  for (let i = 0; i < 4; i++) {
    const a = t * (0.5 + i * 0.07) + i * 1.6;
    crow(ctx, 470 - pan * 0.8 + Math.cos(a) * (50 + i * 14), 60 + Math.sin(a) * 18 + i * 6, t + i, 1 - i * 0.12);
  }

  ctx.drawImage(L.fore, -Math.round(pan * 1.6), 0);
  motes(ctx, t, 34, '#f0c8a0', 60, 300);

  // sunset grade: warm from the left, cool shadow from the right
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const g = ctx.createLinearGradient(0, 0, CW, 0);
  g.addColorStop(0, 'rgba(255,170,100,0.35)');
  g.addColorStop(1, 'rgba(60,40,110,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
  ctx.restore();
  grade(ctx, '#ff9a5a', 0.06, '#180c18', 0.48);
}

export { rgba };
