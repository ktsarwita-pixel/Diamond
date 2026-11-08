import { clamp, glowAt, heroRobot, mix, shade } from './cutsceneArt';
import { Job, makeCanvas } from './cineKit';
import { isLite, qn } from './quality';
import { cable, ellipse, gear, metal, pixelLine, polygon, px, windowGrid, type Point } from './pixelCraft';

const INK = '#0b0f16';
const STEEL = ['#1b232b', '#2c3943', '#41505b', '#5c6e78', '#8a9ba1'] as const;
const RUST = ['#2f1d17', '#4d2e22', '#6b412d', '#8a5638', '#ad7650'] as const;
const AMBER = ['#6e3f18', '#b9772e', '#eab35a', '#ffdc96', '#fff6da'] as const;
const smoother = (x: number) => { const t = clamp(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const workshopJob = new Job(function* (): Generator<void, HTMLCanvasElement, unknown> {
  const [c, g] = makeCanvas(720, 360);
  px(g, 0, 0, 720, 360, '#141c22');
  // rear wall panels
  for (let x = 0; x < 720; x += 60) {
    metal(g, x, 40, 58, 250, x % 120 ? '#26333a' : '#2b3a41', x, 58);
  }
  // high windows with cold evening light
  for (const x of [84, 258, 432]) {
    windowGrid(g, x, 66, 96, 52, '#8fb6bd');
    px(g, x - 4, 120, 104, 4, STEEL[1]);
  }
  yield;
  // ceiling trusses and service pipes
  for (const y of [18, 30]) {
    px(g, 0, y, 720, 5, INK);
    px(g, 0, y + 1, 720, 1, STEEL[3]);
    for (let x = 20; x < 720; x += 48) px(g, x, y - 3, 6, 11, STEEL[1]);
  }
  cable(g, [0, 44], [720, 44], 10, '#3b4a50', 2);
  // floor with perspective seams
  px(g, 0, 292, 720, 68, '#3a3833');
  px(g, 0, 292, 720, 2, '#6d675a');
  for (let x = -300; x < 1000; x += 90) pixelLine(g, [360 + (x - 360) * 0.25, 294], [x, 360], '#26251f');
  for (const y of [304, 322, 346]) px(g, 0, y, 720, 1, '#555046');
  for (let x = 0; x < 720; x += 24) { px(g, x, 296, 12, 3, '#c8a23c'); px(g, x + 12, 296, 12, 3, '#1c1c1c'); }
  // structural columns
  for (const x of [58, 578]) {
    metal(g, x, 40, 12, 254, STEEL[2], x, 12);
    polygon(g, [[x - 8, 294], [x + 20, 294], [x + 16, 286], [x - 4, 286]], STEEL[1]);
    for (let y = 60; y < 280; y += 40) px(g, x + 2, y, 8, 2, STEEL[4]);
  }
  // overhead crane rail
  metal(g, 60, 52, 530, 10, STEEL[3], 7, 26);
  px(g, 60, 54, 530, 1, STEEL[4]);
  for (let x = 80; x < 590; x += 60) px(g, x, 62, 4, 8, STEEL[1]);
  // parts rack (left)
  for (const x of [82, 206]) metal(g, x, 176, 6, 116, STEEL[2], x, 6);
  for (const y of [206, 246, 284]) { metal(g, 80, y, 134, 5, STEEL[3], y, 134); }
  pixelLine(g, [88, 180], [206, 284], STEEL[1]);
  yield;
  // pegboard + tool cabinet (right)
  metal(g, 430, 140, 130, 84, '#2d3a36', 9, 130);
  for (let x = 438; x < 556; x += 8) for (let y = 148; y < 220; y += 8) px(g, x, y, 1, 1, '#141c18');
  for (const [x, y, w, h, c] of [[444, 156, 4, 26, '#8b93a5'], [456, 160, 14, 4, '#c78c3a'], [480, 154, 4, 30, '#8b93a5'], [500, 166, 22, 4, '#6f7889'], [530, 158, 6, 22, '#9c3b2c']] as const) px(g, x, y, w, h, c);
  metal(g, 446, 250, 112, 42, RUST[2], 11, 16);
  for (const x of [452, 546]) { ellipse(g, x, 296, 6, 6, INK); ellipse(g, x, 296, 3, 3, STEEL[3]); }
  // welding booth glow panel
  metal(g, 606, 150, 70, 100, '#233039', 13, 70);
  px(g, 614, 160, 54, 60, '#101a20');
  px(g, 616, 162, 50, 2, '#7dd3fc');
  return c;
});

interface Key { t: number; x: number; y: number }
const PATH: Key[] = [
  { t: 0, x: 240, y: 112 }, { t: 0.8, x: 142, y: 184 }, { t: 1.1, x: 142, y: 204 },
  { t: 1.45, x: 142, y: 170 }, { t: 2.15, x: 294, y: 187 }, { t: 2.4, x: 294, y: 197 },
  { t: 2.75, x: 294, y: 178 }, { t: 3.05, x: 170, y: 228 }, { t: 3.3, x: 170, y: 248 },
  { t: 3.65, x: 170, y: 205 }, { t: 4.35, x: 350, y: 209 }, { t: 4.6, x: 350, y: 219 },
  { t: 4.95, x: 350, y: 198 }, { t: 5.2, x: 120, y: 238 }, { t: 5.45, x: 120, y: 258 },
  { t: 5.8, x: 120, y: 220 }, { t: 6.4, x: 322, y: 250 }, { t: 6.65, x: 322, y: 260 },
  { t: 7.0, x: 322, y: 225 }, { t: 7.25, x: 492, y: 217 }, { t: 7.5, x: 492, y: 237 },
  { t: 7.85, x: 492, y: 190 }, { t: 8.5, x: 374, y: 188 }, { t: 8.75, x: 374, y: 198 },
  { t: 9.1, x: 430, y: 150 }, { t: 9.6, x: 430, y: 112 },
];
function gripAt(t: number): Point {
  if (t <= PATH[0].t) return [PATH[0].x, PATH[0].y];
  for (let i = 1; i < PATH.length; i++) {
    if (t <= PATH[i].t) {
      const a = PATH[i - 1], b = PATH[i];
      const k = smoother((t - a.t) / (b.t - a.t));
      return [lerp(a.x, b.x, k), lerp(a.y, b.y, k)];
    }
  }
  const l = PATH[PATH.length - 1];
  return [l.x, l.y];
}
const PARTS = [
  { rack: [142, 214] as Point, mount: [294, 207] as Point, grab: 1.1, release: 2.4, weld: [2.25, 2.75], color: '#cbd5e1', w: 18, h: 12 },
  { rack: [170, 258] as Point, mount: [350, 229] as Point, grab: 3.3, release: 4.6, weld: [4.45, 4.95], color: '#d9772a', w: 16, h: 10 },
  { rack: [120, 268] as Point, mount: [322, 270] as Point, grab: 5.45, release: 6.65, weld: [6.5, 7.0], color: '#94a3b8', w: 22, h: 8 },
];
const DRILL = { rack: [492, 247] as Point, mount: [374, 208] as Point, grab: 7.5, release: 8.75, weld: [8.6, 9.1] };

function drawPlate(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, bolts = false) {
  px(g, x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2, INK);
  px(g, x - w / 2, y - h / 2, w, h, color);
  px(g, x - w / 2, y - h / 2, w, 2, shade(color, 0.35));
  px(g, x - w / 2, y + h / 2 - 1, w, 1, shade(color, -0.35));
  if (bolts) for (const dx of [-w / 2 + 2, w / 2 - 3]) { px(g, x + dx, y - 1, 2, 2, '#f4f1e6'); px(g, x + dx + 1, y, 1, 1, '#5a5a5a'); }
}
function drawDrill(g: CanvasRenderingContext2D, x: number, y: number, spin: number) {
  px(g, x - 18, y - 9, 16, 18, INK);
  px(g, x - 16, y - 7, 12, 14, STEEL[3]);
  px(g, x - 16, y - 7, 12, 3, STEEL[4]);
  for (let b = 0; b < 6; b++) {
    const hh = 8 - b;
    px(g, x - 2 + b * 5, y - hh - 1, 5, hh * 2 + 2, INK);
    const c = (b + Math.floor(spin * 8)) % 2 ? '#d97706' : '#f59e0b';
    px(g, x - 1 + b * 5, y - hh, 4, hh * 2, c);
  }
}
function ik(base: Point, target: Point, l1: number, l2: number): Point {
  let dx = target[0] - base[0], dy = target[1] - base[1];
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 1, min = Math.abs(l1 - l2) + 1;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  if (d < min) { dx *= min / (d || 1); dy *= min / (d || 1); d = min; }
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ang = Math.atan2(dy, dx) - a;
  return [base[0] + Math.cos(ang) * l1, base[1] + Math.sin(ang) * l1];
}

export function drawWorkshopScene(ctx: CanvasRenderingContext2D, t: number) {
  // Slow dolly-in on the rig over the whole sequence, with a gentle settle at the end.
  const push = 1 + smoother(t / 9.6) * 0.07;
  ctx.save();
  ctx.translate(326, 230);
  ctx.scale(push, push);
  ctx.translate(-326, -230);
  const backdrop = workshopJob.peek();
  if (backdrop) ctx.drawImage(backdrop, -24, 0);
  else {
    px(ctx, -24, 0, 720, 360, '#1b2830');
    px(ctx, -24, 292, 720, 68, '#3a3833');
    px(ctx, -24, 292, 720, 2, '#6d675a');
  }
  const lite = isLite();
  const [gx, gy] = gripAt(t);
  const benchY = 278;
  const rigX = 326, rigS = 4.6, rigY = benchY - 15 * rigS;
  const released = PARTS.filter(p => t >= p.release).length + (t >= DRILL.release ? 1 : 0);
  const progress = released / 4;
  const drillOn = t >= DRILL.release;

  // warm bay lighting, cooler window fill
  glowAt(ctx, 330, 120, 170, '#f8d39a', 0.14);
  glowAt(ctx, 300, 90, 120, '#9fd3dc', 0.08);
  for (const x of [140, 330, 520]) {
    px(ctx, x - 20, 40, 40, 3, INK);
    px(ctx, x - 18, 43, 36, 2, AMBER[4]);
    if (!lite) { ctx.globalAlpha = 0.05; polygon(ctx, [[x - 18, 45], [x + 18, 45], [x + 70, 292], [x - 70, 292]], AMBER[3]); ctx.globalAlpha = 1; }
  }

  // hydraulic scissor lift, anchored to the floor
  const liftTop = benchY;
  px(ctx, rigX - 62, 300, 124, 8, INK);
  px(ctx, rigX - 60, 301, 120, 5, STEEL[2]);
  const scissorH = 300 - liftTop - 4;
  pixelLine(ctx, [rigX - 48, 298], [rigX + 48, liftTop + 4], INK, 4);
  pixelLine(ctx, [rigX + 48, 298], [rigX - 48, liftTop + 4], INK, 4);
  pixelLine(ctx, [rigX - 48, 298], [rigX + 48, liftTop + 4], STEEL[3], 2);
  pixelLine(ctx, [rigX + 48, 298], [rigX - 48, liftTop + 4], STEEL[3], 2);
  ellipse(ctx, rigX, liftTop + 4 + scissorH / 2, 3, 3, AMBER[2]);
  px(ctx, rigX - 58, liftTop - 4, 116, 6, INK);
  px(ctx, rigX - 56, liftTop - 3, 112, 4, STEEL[3]);
  px(ctx, rigX - 56, liftTop - 3, 112, 1, STEEL[4]);
  for (let x = rigX - 52; x < rigX + 56; x += 12) px(ctx, x, liftTop - 2, 6, 1, AMBER[2]);

  // rack remnants / labels
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = '#9fb3ad';
  ctx.fillText('SALVAGE', 96, 196);
  ctx.fillText('AUGER', 470, 240);

  // robot on lift
  heroRobot(ctx, {
    x: rigX, y: rigY, s: rigS, t,
    state: drillOn ? 'happy' : 'working',
    damage: 0.92 * (1 - progress),
    power: 0.45 + progress * 0.55,
    eye: drillOn ? 'happy' : 'scan',
    drill: drillOn,
    drillAngle: -0.18,
    drillExtend: drillOn ? 0.5 + 0.3 * Math.sin((t - DRILL.release) * 6) : 0,
    drillSpin: drillOn ? (t - DRILL.release) * 3 : 0,
    paintMix: 1,
  });
  // mounted plates
  for (const p of PARTS) if (t >= p.release) drawPlate(ctx, p.mount[0], p.mount[1], p.w, p.h, p.color, true);

  // parts on rack or carried by gripper
  let carrying = false;
  for (const p of PARTS) {
    if (t < p.grab) drawPlate(ctx, p.rack[0], p.rack[1], p.w, p.h, p.color);
    else if (t < p.release) { drawPlate(ctx, gx, gy + 10, p.w, p.h, p.color); carrying = true; }
  }
  if (t < DRILL.grab) drawDrill(ctx, DRILL.rack[0], DRILL.rack[1], 0);
  else if (t < DRILL.release) { drawDrill(ctx, gx, gy + 10, t * 0.5); carrying = true; }

  // gantry trolley + continuous hoist cable + servo gripper
  const tx = clamp(gx, 90, 560);
  px(ctx, tx - 18, 48, 36, 14, INK);
  px(ctx, tx - 16, 50, 32, 9, STEEL[3]);
  px(ctx, tx - 16, 50, 32, 2, STEEL[4]);
  gear(ctx, tx - 10, 62, 4, gx * 0.2, STEEL[4]);
  gear(ctx, tx + 10, 62, 4, gx * 0.2, STEEL[4]);
  px(ctx, tx - 1, 62, 2, Math.max(1, gy - 70), '#2a2e33');
  px(ctx, tx, 62, 1, Math.max(1, gy - 70), STEEL[4]);
  px(ctx, gx - 10, gy - 8, 20, 6, INK);
  px(ctx, gx - 8, gy - 7, 16, 3, AMBER[2]);
  const spread = carrying ? 5 : 9;
  px(ctx, gx - spread - 2, gy - 2, 3, 9, STEEL[4]);
  px(ctx, gx + spread - 1, gy - 2, 3, 9, STEEL[4]);
  px(ctx, gx - spread - 2, gy + 6, 4, 2, INK);
  px(ctx, gx + spread - 2, gy + 6, 4, 2, INK);

  // welding arm on a boom from the right column
  px(ctx, 500, 116, 80, 5, INK);
  px(ctx, 500, 117, 80, 2, STEEL[3]);
  const base: Point = [500, 118];
  let weld: Point | null = null;
  let weldStrength = 0;
  for (const p of [...PARTS.map(x => ({ weld: x.weld, mount: x.mount })), { weld: DRILL.weld, mount: DRILL.mount }]) {
    const [a, b] = p.weld;
    if (t >= a - 0.25 && t <= b + 0.25) {
      const env = smoother((t - (a - 0.25)) / 0.25) * (1 - smoother((t - b) / 0.25));
      weld = [lerp(470, p.mount[0], env), lerp(170, p.mount[1], env)];
      weldStrength = env;
    }
  }
  const target: Point = weld ?? [470, 170];
  const elbow = ik(base, target, 120, 115);
  pixelLine(ctx, base, elbow, INK, 8);
  pixelLine(ctx, elbow, target, INK, 6);
  pixelLine(ctx, base, elbow, STEEL[3], 4);
  pixelLine(ctx, elbow, target, STEEL[4], 3);
  cable(ctx, base, elbow, 8, '#1c2120', 1);
  cable(ctx, elbow, target, 6, '#1c2120', 1);
  ellipse(ctx, base[0], base[1], 5, 5, INK); ellipse(ctx, base[0], base[1], 3, 3, AMBER[2]);
  ellipse(ctx, elbow[0], elbow[1], 4, 4, INK); ellipse(ctx, elbow[0], elbow[1], 2, 2, AMBER[2]);
  if (weld && weldStrength > 0.1) {
    const [wx, wy] = weld;
    // arc flicker: real welds strobe, they don't glow steadily
    const strobe = 0.75 + 0.25 * (Math.sin(t * 61) > 0.1 ? 1 : 0.3);
    const a0 = weldStrength * strobe;
    glowAt(ctx, wx, wy, 34, '#7dd3fc', 0.5 * a0);
    glowAt(ctx, wx, wy, 12, '#ffffff', 0.75 * a0);
    // the arc lights the rig's near face and throws a hard shadow line on the floor
    glowAt(ctx, rigX, rigY + 10, 70, '#8fd8f0', 0.16 * a0);
    ctx.globalAlpha = 0.22 * a0;
    polygon(ctx, [[wx, wy], [rigX - 70, 300], [rigX + 70, 300]], '#bfe8f0');
    ctx.globalAlpha = 1;
    px(ctx, wx - 1, wy - 1, 3, 3, '#f2fbff');
    // spatter: parabolic sparks that bounce once off the lift deck
    for (let i = 0; i < qn(16, 0.4); i++) {
      const life = (t * 2.0 + i / 16) % 1;
      const a = -Math.PI * 0.1 - (i / 16) * Math.PI * 0.8;
      const sp = 20 + (i % 5) * 7;
      let sx = wx + Math.cos(a) * sp * life;
      let sy = wy + Math.sin(a) * sp * life + life * life * 30;
      if (sy > liftTop - 4) { // bounce
        const over = sy - (liftTop - 4);
        sy = liftTop - 4 - over * 0.45;
        sx += (life - 0.5) * 6;
      }
      px(ctx, sx, sy, 1, i % 3 ? 1 : 2, i % 2 ? '#fde047' : '#fff7d6');
    }
    // hot slag glow at the seam that fades after the arc moves on
    px(ctx, wx - 3, wy + 2, 6, 1, `rgba(255,120,40,${0.6 * a0})`);
  }
  // cooling seams: the last welded spot keeps a dull red glow for a moment
  for (const p of [...PARTS.map(x => ({ end: x.weld[1], mount: x.mount })), { end: DRILL.weld[1], mount: DRILL.mount }]) {
    const since = t - p.end;
    if (since > 0 && since < 1.6) {
      const g = (1 - since / 1.6) * 0.5;
      px(ctx, p.mount[0] - 4, p.mount[1] + 3, 8, 1, `rgba(255,90,30,${g})`);
      glowAt(ctx, p.mount[0], p.mount[1], 10, '#ff6a2a', g * 0.5);
    }
  }
  // success flood + diagnostic panel
  if (drillOn) {
    const k = smoother((t - DRILL.release) / 0.8);
    glowAt(ctx, rigX, rigY, 90, '#9fe0b0', 0.12 * k);
    px(ctx, 616, 162, 50, 2, mix('#7dd3fc', '#9fe0b0', k));
  }
  // ambient dust in the light (inside the dolly so it parallaxes with the room)
  for (let i = 0; i < qn(22, 0.4); i++) {
    const x = 80 + ((i * 97 + t * 6) % 520);
    const y = 60 + ((i * 53 + t * 3) % 220);
    ctx.globalAlpha = 0.25 + 0.3 * Math.sin(t + i);
    px(ctx, x, y, 1, 1, '#fff0bb');
  }
  ctx.globalAlpha = 1;
  ctx.restore(); // end dolly

  // ---- diagnostic panel (screen space): live checklist that ticks as parts mount ----
  const items: Array<[string, number]> = [
    ['HULL PLATE A', PARTS[0].release], ['HULL PLATE B', PARTS[1].release], ['SKID ARMOR', PARTS[2].release], ['AUGER DRILL', DRILL.release],
  ];
  px(ctx, 30, 40, 196, 92, 'rgba(12,16,24,0.9)');
  px(ctx, 30, 40, 196, 2, drillOn ? '#9fe0b0' : '#5fc5cf');
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = '#b5ebee';
  ctx.fillText('REPAIR DIAGNOSTIC', 44, 56);
  items.forEach(([label, at], i) => {
    const done = t >= at;
    const active = !done && (i === 0 || t >= items[i - 1][1]);
    const y = 70 + i * 12;
    px(ctx, 44, y - 5, 5, 5, done ? '#9fe0b0' : active && Math.floor(t * 4) % 2 ? '#fbd692' : '#2a3540');
    ctx.fillStyle = done ? '#96e8af' : active ? '#fbd692' : '#5f7078';
    ctx.fillText(label, 54, y);
    if (done) ctx.fillText('OK', 196, y);
  });
  px(ctx, 44, 118, 168, 6, INK);
  px(ctx, 46, 120, 164 * progress, 2, drillOn ? '#9fe0b0' : '#70cbb8');
}
