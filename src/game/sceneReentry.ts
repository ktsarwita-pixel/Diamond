/* ================================================================== *
 *  SCENE 05 — ATMOSPHERIC RE-ENTRY (remastered)
 *  Phase A  0.0–1.5s  : high altitude, curved Earth limb, thin air glow
 *  Phase B  1.5–4.3s  : peak heating — plasma sheath, bow shock, ablation
 *  Phase C  4.3–5.3s  : punch-through of the cloud deck (whiteout)
 *  Phase D  5.3–6.4s  : below the clouds — wasteland rising, cooling hull
 * ================================================================== */
import { CH, CW, INK, R, clamp, cloudSprite, ease, easeInOut, hash, heroRobot, rgba, type HeroRobotOpts } from './cutsceneArt';
import {
  bar,
  drawBlob,
  drawPuff,
  grade,
  hex3,
  heatShimmer,
  hudPanel,
  lerp,
  lerp3,
  makeCanvas,
  makeNoise,
  paintPixelsGen,
  Job,
  plasmaFront,
  plasmaWake,
  shake,
  sign,
  smooth,
  band,
} from './cineKit';
import { isLite, qn } from './quality';
import { landJob } from './sceneImpact';

/* ---------------- cached Earth-from-altitude texture ---------------- */
export const earthJob = new Job(function* () {
  const W = 900;
  const H = 320;
  const [c, ctx] = makeCanvas(W, H);
  const n = makeNoise(4242);
  const desert = hex3('#b07a4e');
  const ochre = hex3('#8a5a36');
  const toxic = hex3('#4f5a44');
  const sea = hex3('#2d3a46');
  const cloud = hex3('#efe6dc');
  const haze = hex3('#9fb7cc');
  yield* paintPixelsGen(ctx, 0, 0, W, H, (x, y, o) => {
    const d = y / H; // 0 = horizon, 1 = nadir
    const z = 1 / (d + 0.06);
    const u = ((x - W / 2) / W) * z * 0.9;
    const v = z * 0.55;
    const land = n.fbm(u * 1.6 + 3, v * 1.6, 5);
    let col = land > 0.52 ? lerp3(ochre, desert, smooth(0.52, 0.7, land)) : land > 0.45 ? lerp3(toxic, ochre, (land - 0.45) / 0.07) : lerp3(sea, toxic, land / 0.45);
    // canyons / river scars
    const scar = Math.abs(n.noise(u * 5, v * 5) - 0.5);
    if (scar < 0.02 && land > 0.5) col = lerp3(col, hex3('#3b2a22'), 0.6);
    // cloud swirls
    const cl = n.fbm(u * 3.2 + 40, v * 4.5 + 9, 4);
    const ca = smooth(0.55, 0.72, cl);
    col = lerp3(col, cloud, ca * 0.85);
    // cloud shadows
    const cs = smooth(0.55, 0.72, n.fbm(u * 3.2 + 40.05, v * 4.5 + 9.08, 4));
    col = lerp3(col, [col[0] * 0.7, col[1] * 0.7, col[2] * 0.75], (cs - ca) > 0 ? (cs - ca) * 0.6 : 0);
    // atmospheric haze toward the horizon
    col = lerp3(col, haze, clamp(1 - d * 2.2) * 0.85);
    const l = band(0.5 + (n.noise(x * 0.4, y * 0.4) - 0.5) * 0.12, 8, x, y);
    o[0] = col[0] * (0.88 + l * 0.24);
    o[1] = col[1] * (0.88 + l * 0.24);
    o[2] = col[2] * (0.88 + l * 0.24);
    o[3] = 255;
  });
  return c;
});
function getEarth(): HTMLCanvasElement | null {
  return earthJob.peek();
}

/* ---------------- heated hull compositing ---------------- */
let heatLayer: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;
export function heatedRobot(ctx: CanvasRenderingContext2D, opts: HeroRobotOpts, heat: number, ang: number) {
  if (isLite()) {
    heroRobot(ctx, opts);
    if (heat > 0.05) drawBlob(ctx, '#ff8a3a', opts.x + Math.sin(ang) * 10, opts.y + Math.cos(ang) * 10, (opts.s ?? 3) * 12, heat * 0.5);
    return;
  }
  if (!heatLayer) heatLayer = makeCanvas(300, 300);
  const [layer, l] = heatLayer;
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, 300, 300);
  heroRobot(l, { ...opts, x: 150, y: 150 });
  if (heat > 0.01) {
    l.globalCompositeOperation = 'source-atop';
    const dx = Math.sin(ang) * 70;
    const dy = Math.cos(ang) * 70;
    const g = l.createLinearGradient(150 + dx, 150 + dy, 150 - dx, 150 - dy);
    g.addColorStop(0, `rgba(255,236,190,${0.9 * heat})`);
    g.addColorStop(0.35, `rgba(255,140,50,${0.62 * heat})`);
    g.addColorStop(1, `rgba(120,24,10,${0.25 * heat})`);
    l.fillStyle = g;
    l.fillRect(0, 0, 300, 300);
    l.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(layer, opts.x - 150, opts.y - 150);
}

/* ---------------- scene ---------------- */
const WARM_CLOUD: [string, string, string] = ['#ffe2c4', '#d99a86', '#6d4a66'];
const COOL_CLOUD: [string, string, string] = ['#f4f7ff', '#b9c6dd', '#7586a6'];
const DUSK_CLOUD: [string, string, string] = ['#f6c8a0', '#a8707a', '#4a3450'];

export function drawReentry(ctx: CanvasRenderingContext2D, t: number, duration: number) {
  const f = clamp(t / duration);
  const heat = smooth(0.5, 2.0, t) * (1 - smooth(4.6, 6.2, t) * 0.72);
  const deck = clamp((t - 4.25) / 1.05);
  const below = smooth(4.85, 5.8, t);
  const altitude = Math.max(0.4, 82 - ease(f) * 79);

  const shakeAmp = heat * 2.4 + Math.sin(deck * Math.PI) * 3.5;
  const [sx, sy] = shake(t, shakeAmp);

  ctx.save();
  ctx.translate(sx, sy);

  /* ---- sky ---- */
  const hi = lerp3(hex3('#03040f'), hex3('#1c0f24'), smooth(1, 4, t));
  const mid = lerp3(lerp3(hex3('#0e2152'), hex3('#4a2240'), smooth(1, 4, t)), hex3('#6a3346'), below);
  const low = lerp3(lerp3(hex3('#5d9ad0'), hex3('#c9643c'), smooth(1, 4.2, t)), hex3('#e89a5c'), below);
  const toCss = (c: number[]) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const sky = ctx.createLinearGradient(0, -20, 0, CH + 20);
  sky.addColorStop(0, toCss(hi));
  sky.addColorStop(0.55, toCss(mid));
  sky.addColorStop(1, toCss(low));
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, CW + 40, CH + 40);

  // Stars at the edge of space
  const starA = 1 - smooth(0.2, 2.2, t);
  if (starA > 0) {
    for (let i = 0; i < qn(90, 0.4); i++) {
      const x = hash(i * 3.3) * CW;
      const y = hash(i * 7.1) * 200 - t * 6;
      const tw = 0.55 + 0.45 * Math.sin(t * 3 + i);
      ctx.globalAlpha = starA * tw * (1 - y / 220);
      R(ctx, x, y, i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1, '#e8eeff');
    }
    ctx.globalAlpha = 1;
  }

  /* ---- Earth limb (curvature flattens as we descend) ---- */
  const limbA = 1 - smooth(3.8, 4.8, t);
  if (limbA > 0) {
    const k = easeInOut(clamp(t / 4.4));
    const limbY = lerp(236, 120, k);
    const Rr = lerp(1250, 5200, k);
    const cx = CW / 2 + 40;
    ctx.save();
    ctx.globalAlpha = limbA;
    if (isLite()) {
      // Lite: flat horizon band + single rim line (no giant-arc clipping per frame)
      const tex0 = getEarth();
      if (tex0) ctx.drawImage(tex0, -130 - ((t * 26) % 60) * 0.4, limbY, 900, CH - limbY + 40);
      else { ctx.fillStyle = '#6f5a46'; ctx.fillRect(-20, limbY, CW + 40, CH - limbY + 40); }
      ctx.fillStyle = rgba('#bfe6ff', 0.55);
      ctx.fillRect(-20, limbY - 2, CW + 40, 3);
      ctx.fillStyle = rgba('#3b82f6', 0.18);
      ctx.fillRect(-20, limbY - 10, CW + 40, 8);
      ctx.restore();
    } else {
    // Visible stretch of the planet's limb as a short polyline (cheap to clip/stroke).
    const limbAt = (x: number, extra = 0) => limbY + Rr - Math.sqrt(Math.max(0, (Rr + extra) ** 2 - (x - cx) ** 2)) - extra * 0;
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const x = -24 + (i / 32) * (CW + 48);
      if (i === 0) ctx.moveTo(x, limbAt(x));
      else ctx.lineTo(x, limbAt(x));
    }
    ctx.lineTo(CW + 24, CH + 30);
    ctx.lineTo(-24, CH + 30);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    const tex = getEarth();
    const scroll = (t * 26) % 60;
    if (tex) ctx.drawImage(tex, -130 - scroll * 0.4, limbY - 2, 900, CH - limbY + 40);
    else { ctx.fillStyle = '#6f5a46'; ctx.fillRect(-20, limbY - 2, CW + 40, CH - limbY + 40); }
    // terminator & warm scattering near the limb
    const sc = ctx.createLinearGradient(0, limbY, 0, limbY + 70);
    sc.addColorStop(0, 'rgba(170,205,235,0.75)');
    sc.addColorStop(1, 'rgba(170,205,235,0)');
    ctx.fillStyle = sc;
    ctx.fillRect(-20, limbY - 4, CW + 40, 80);
    ctx.restore();
    // atmosphere rim glow (layered)
    for (const [w, col, a] of [[26, '#3b82f6', 0.16], [14, '#7cc8ff', 0.25], [6, '#bfe6ff', 0.45], [2, '#f0fbff', 0.8]] as const) {
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i <= 32; i++) {
        const x = -24 + (i / 32) * (CW + 48);
        const y = limbAt(x) + w * 0.3;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    }
  }

  /* ---- below-the-clouds wasteland ---- */
  if (below > 0) {
    const land = landJob.peek();
    ctx.save();
    ctx.globalAlpha = below;
    const off = lerp(150, 40, ease(clamp((t - 4.85) / 1.55)));
    if (land) ctx.drawImage(land, 0, 0, CW, CH, -10, -10, CW + 20, CH + 20 + off);
    else { ctx.fillStyle = '#7a4a3a'; ctx.fillRect(-10, 150 + off, CW + 20, CH); }
    // aerial haze
    const hz = ctx.createLinearGradient(0, off * 1.4 + 150, 0, CH);
    hz.addColorStop(0, 'rgba(232,160,110,0.55)');
    hz.addColorStop(1, 'rgba(120,70,60,0.15)');
    ctx.fillStyle = hz;
    ctx.fillRect(-20, off + 150, CW + 40, CH);
    ctx.restore();
  }

  /* ---- clouds rushing upward past the camera ---- */
  const travel = t * 120 + t * t * 34;
  const pal = heat > 0.45 ? WARM_CLOUD : below > 0.3 ? DUSK_CLOUD : COOL_CLOUD;
  const cloudA = smooth(0.8, 2.2, t);
  if (cloudA > 0) {
    for (let i = 0; i < 9; i++) {
      const depth = 0.5 + hash(i + 3) * 0.9;
      const w = Math.round(110 * depth);
      const h = Math.round(42 * depth);
      const spr = cloudSprite(i * 11 + 5, w, h, pal[0], pal[1], pal[2]);
      const span = CH + 260;
      const y = ((((hash(i * 5.1) * span - travel * depth) % span) + span) % span) - 120;
      const x = hash(i * 9.7) * (CW + 120) - 60;
      ctx.globalAlpha = cloudA * (0.5 + depth * 0.35) * (1 - below * 0.5);
      ctx.drawImage(spr, Math.round(x), Math.round(y));
    }
    ctx.globalAlpha = 1;
  }

  /* ---- the falling unit ---- */
  const ang = lerp(0.34 + Math.sin(t * 0.8) * 0.05, 0.857, smooth(4.9, 6.4, t));
  const scale = lerp(2.7, 4.3, easeInOut(f));
  const R0 = scale * 12.5;
  const rx = 316 + Math.sin(t * 1.7) * 9 - below * 18;
  const ry = 168 + Math.sin(t * 2.3) * 5 - smooth(0, 1.2, t) * 12;
  const wx = -Math.sin(ang);
  const wy = -Math.cos(ang);

  // Refraction of everything behind the hot wake
  heatShimmer(ctx, rx - R0 * 2.8 + wx * R0 * 2, ry - R0 * 6, R0 * 5.6, R0 * 6.5, t, heat * 3.2);

  // Smoke & ablation trail (normal blending, behind the fire)
  const smokeAmt = smooth(1.6, 3.4, t);
  if (smokeAmt > 0) {
    for (let i = 0; i < qn(34, 0.4); i++) {
      const age = (t * 0.85 + hash(i * 3.1)) % 1;
      const dist = R0 * 1.2 + age * 560;
      const spread = (hash(i * 1.7) - 0.5) * age * R0 * 3.2 + Math.sin(t * 2 + i) * 6 * age;
      const px = rx + wx * dist - wy * spread;
      const py = ry + wy * dist + wx * spread;
      const size = R0 * (0.7 + age * 2.6);
      drawPuff(ctx, i, '#7d6a66', '#2a2026', px, py, size, smokeAmt * (1 - age) * 0.5 * clamp(age * 5));
    }
  }

  // Ablating fragments with their own micro-trails
  for (let i = 0; i < qn(14, 0.5); i++) {
    const spawn = 1.4 + hash(i * 7.3) * 3.6;
    const age = t - spawn;
    if (age < 0 || age > 1.3) continue;
    const sp = 230 + hash(i * 2.2) * 160;
    const lat = (hash(i * 4.4) - 0.5) * 140 * age;
    const px = rx + wx * (R0 * 0.6 + sp * age) - wy * lat;
    const py = ry + wy * (R0 * 0.6 + sp * age) + wx * lat;
    const hot = clamp(1 - age * 1.1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba('#ff9a3d', 0.55 * hot);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + wx * 26, py + wy * 26);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(t * (6 + i) + i);
    const s = 2 + (i % 3);
    R(ctx, -s, -s * 0.6, s * 2, s * 1.2, INK);
    R(ctx, -s + 1, -s * 0.6 + 1, s * 2 - 2, Math.max(1, s * 1.2 - 2), i % 3 === 0 ? '#e9eef5' : '#7a4a2a');
    ctx.restore();
    drawBlob(ctx, '#ff8a2a', px, py, 7, 0.5 * hot);
  }

  // Plasma wake (behind), heated hull, shock cap (front)
  plasmaWake(ctx, rx, ry, ang, heat, t, R0);
  const paint = smooth(1.4, 4.0, t);
  heatedRobot(
    ctx,
    {
      x: rx,
      y: ry,
      s: scale,
      t,
      state: 'falling',
      rot: Math.sin(t * 1.3) * 0.5 + t * 0.55,
      eye: t > 5.2 ? 'scan' : 'surprised',
      damage: 0.2 + f * 0.75,
      paintMix: paint,
      drill: false,
    },
    heat * 0.58 + (1 - heat) * smooth(4.6, 6.4, t) * 0.3,
    ang
  );
  plasmaFront(ctx, rx, ry, ang, heat * 0.78, t, R0);

  // Peeling white paint flakes → glowing slag
  for (let i = 0; i < qn(22, 0.45); i++) {
    const life = (t * 0.9 + hash(i + 24)) % 1;
    const lat = (hash(i + 45) - 0.5) * life * 150;
    const px = rx + wx * life * 190 - wy * lat;
    const py = ry + wy * life * 190 + wx * lat;
    const white = life < 0.35 && paint < 0.75;
    R(ctx, px, py, 2, 2, white ? '#f1f5f9' : i % 2 ? '#fb923c' : '#fde047');
  }

  /* ---- cloud deck punch-through ---- */
  if (deck > 0 && deck < 1) {
    const bandY = lerp(CH + 160, -280, deck);
    for (let i = 0; i < qn(16, 0.6); i++) {
      const w = 220 + hash(i * 3.3) * 120;
      const h = Math.round(w * 0.38);
      const spr = cloudSprite(200 + i * 7, Math.round(w), h, WARM_CLOUD[0], WARM_CLOUD[1], WARM_CLOUD[2]);
      const x = hash(i * 1.9) * (CW + 200) - 160;
      const y = bandY + (hash(i * 6.1) - 0.5) * 300;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(spr, Math.round(x), Math.round(y));
    }
    ctx.globalAlpha = 1;
    // fire-lit whiteout inside the cloud
    const wo = Math.sin(deck * Math.PI);
    R(ctx, -20, -20, CW + 40, CH + 40, rgba('#ffe6cc', wo * 0.62));
    drawBlob(ctx, '#ff9a4a', rx, ry, 220, wo * 0.4);
  }

  // Fire-light spilling over everything near the unit
  drawBlob(ctx, '#ff7a26', rx, ry, 260, heat * 0.22);
  ctx.restore();

  /* ---- telemetry HUD ---- */
  hudPanel(ctx, 22, 30, 196, 72, '#f97316');
  sign(ctx, `HULL TEMP ${Math.round(380 + heat * 1520 + f * 120)}C`, 120, 48, '#fed7aa', 6);
  sign(ctx, `ALT ${altitude.toFixed(1)} KM`, 120, 63, '#fdba74', 6);
  sign(ctx, paint > 0.7 ? 'COATING: SCORCHED' : heat > 0.3 ? 'THERMAL ABLATION' : 'ENTRY INTERFACE', 120, 78, heat > 0.5 && Math.floor(t * 6) % 2 ? '#fecaca' : '#fb923c', 5);
  bar(ctx, 38, 87, 164, paint, '#ea580c');

  grade(ctx, '#ff7a3a', 0.12 + heat * 0.18, '#12060c', 0.5);
}
