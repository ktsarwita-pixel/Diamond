/* ================================================================== *
 *  CINEMATIC HUMANS — articulated, high-detail pixel people.
 *  ~60-unit tall figures with jointed limbs (hip/knee/shoulder/elbow),
 *  physically driven walk cycle, 3/4 shaded faces, hair, outfits & props.
 * ================================================================== */
import { INK, R, clamp, mix as mixColor, shade as shadeColor, type HeroHumanOpts } from './cutsceneArt';
import { drawBlob } from './cineKit';
import { cacheGet, cacheSet } from './spriteCache';

export type Outfit = 'default' | 'miner' | 'aether' | 'official';

export interface CineHumanOpts extends HeroHumanOpts {
  /** Rim light colour painted on the back edges (cinematic back-light). */
  rim?: string;
  /** Flat colour silhouette (background crowd / depth). */
  silhouette?: string;
  outfit?: Outfit;
  /** Headlamp on (miner helmets). */
  lampOn?: boolean;
  /** Extra uniform darkening 0..1 (atmospheric depth). */
  dim?: number;
  /** Continuous 0..1 extension for the offered-core reach pose. */
  reachProgress?: number;
}

// Character palettes repeat on every cinematic and gameplay animation frame.
// Memoize the string/material math rather than reparsing the same hex colours.
const humanShade = new Map<string, string>();
const humanMix = new Map<string, string>();
function cachedShade(color: string, amount: number) {
  const value = Math.round(amount * 100) / 100;
  const key = `${color}:${value}`;
  let out = humanShade.get(key);
  if (!out) { out = shadeColor(color, value); humanShade.set(key, out); }
  return out;
}
function cachedMix(a: string, b: string, amount: number) {
  const value = Math.round(amount * 100) / 100;
  const key = `${a}:${b}:${value}`;
  let out = humanMix.get(key);
  if (!out) { out = mixColor(a, b, value); humanMix.set(key, out); }
  return out;
}

interface Seg {
  x: number;
  y: number;
  a: number;
  len: number;
  w: number;
  fill: string;
  lite: string;
  dark: string;
}

const end = (s: { x: number; y: number; a: number; len: number }): [number, number] => [
  s.x + Math.sin(s.a) * s.len,
  s.y + Math.cos(s.a) * s.len,
];

function paintCinematicHuman(ctx: CanvasRenderingContext2D, o: CineHumanOpts) {
  const look = o.look;
  const t = o.t;
  const pose = o.pose ?? 'idle';
  const outfit: Outfit = o.outfit ?? (look.helmet ? 'miner' : 'default');
  const sil = o.silhouette;
  const dim = clamp(o.dim ?? 0);
  const C = (c: string) => (sil ? sil : dim > 0 ? cachedMix(c, '#0b0912', dim) : c);
  const ink = sil ? sil : dim > 0 ? cachedMix(INK, '#0b0912', dim) : INK;

  const unit = (o.s ?? 3) * 0.5 * (look.small ? 0.8 : 1);
  const facing = o.facing ?? 1;

  /* ---------------- pose angles ---------------- */
  const phi = pose === 'walk' ? (o.walkPhase ?? t * 4.5) * 1.75 : 0;
  const breathe = pose === 'idle' || pose === 'hold' ? Math.sin(t * 2.1) * 0.35 : 0;
  const sway = pose === 'idle' ? Math.sin(t * 0.9) * 0.025 : 0;

  // legs: [thigh, shin] angles (radians, + = forward)
  let frontLeg: [number, number];
  let backLeg: [number, number];
  if (pose === 'walk') {
    const leg = (p: number): [number, number] => {
      const th = 0.44 * Math.sin(p);
      const bend = 0.95 * Math.pow(Math.max(0, Math.cos(p)), 1.4);
      return [th, th - bend - 0.04];
    };
    frontLeg = leg(phi);
    backLeg = leg(phi + Math.PI);
  } else if (pose === 'kneel') {
    frontLeg = [1.45, 0.05];
    backLeg = [-0.15, -1.45];
  } else if (pose === 'cheer') {
    const hop = Math.max(0, Math.sin(t * 9)) * 0.25;
    frontLeg = [0.12 + hop, -0.1 - hop * 1.6];
    backLeg = [-0.08 + hop, -0.2 - hop * 1.6];
  } else {
    frontLeg = [0.07 + sway, 0.02];
    backLeg = [-0.09 + sway, -0.04];
  }

  // arms: [upper, fore] angles
  let frontArm: [number, number];
  let backArm: [number, number];
  const prop = o.flipProp ?? null;
  const swing = pose === 'walk' ? 0.5 * Math.sin(phi) : 0;
  backArm = pose === 'walk' ? [swing, swing + 0.4] : [-0.08 + breathe * 0.04, 0.12];
  frontArm = pose === 'walk' ? [-swing, -swing + 0.4] : [0.06 - breathe * 0.04, 0.22];
  if (pose === 'wave') {
    frontArm = [2.45, 2.85 + Math.sin(t * 8) * 0.38];
  } else if (pose === 'cheer') {
    frontArm = [2.65, 3.0 + Math.sin(t * 11) * 0.22];
    backArm = [2.5, 2.95 + Math.sin(t * 11 + 1) * 0.22];
  } else if (pose === 'reach') {
    const p = clamp(o.reachProgress ?? 1);
    frontArm = [0.06 + (1.32 - 0.06) * p, 0.22 + (1.56 - 0.22) * p];
  } else if (pose === 'point') {
    frontArm = [1.45, 1.52];
  } else if (pose === 'kneel') {
    frontArm = [0.7, 1.4];
  } else if (pose === 'hold' || prop) {
    if (pose !== 'walk') {
      if (prop === 'lantern') frontArm = [0.55, 1.05];
      else if (prop === 'clipboard') frontArm = [0.35, 1.75];
      else if (prop === 'mug') frontArm = [0.25, 1.9];
      else frontArm = [0.3, 1.25];
    } else if (prop === 'lantern') {
      frontArm = [-swing * 0.4 + 0.3, 0.9];
    }
  }

  /* ---------------- leg geometry & ground contact ---------------- */
  const HIP_Y = -28;
  const THIGH = 13;
  const SHIN = 11;
  const ankle = (leg: [number, number], hx: number): [number, number, number, number] => {
    const kx = hx + Math.sin(leg[0]) * THIGH;
    const ky = HIP_Y + Math.cos(leg[0]) * THIGH;
    return [kx, ky, kx + Math.sin(leg[1]) * SHIN, ky + Math.cos(leg[1]) * SHIN];
  };
  const fA = ankle(frontLeg, 1);
  const bA = ankle(backLeg, -1);
  // Lowest ankle touches the ground (ankle sits 4 units above the soles).
  const lift = -4 - Math.max(fA[3], bA[3]);

  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(facing * unit, unit);
  ctx.translate(0, lift);

  // contact shadow
  if (!sil) {
    ctx.save();
    ctx.translate(0, -lift);
    ctx.globalAlpha = 0.3 * (1 - dim * 0.6);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  const skin = C(look.skin);
  const skinLite = C(cachedShade(look.skin, 0.16));
  const skinDark = C(cachedShade(look.skin, -0.24));
  const isAether = outfit === 'aether';
  const isOfficial = outfit === 'official';
  const shirt = C(look.shirt);
  const shirtLite = C(cachedShade(look.shirt, 0.18));
  const shirtDark = C(look.shirtDark);
  const pants = C(look.pants);
  const pantsLite = C(cachedShade(look.pants, 0.16));
  const pantsDark = C(cachedShade(look.pants, -0.3));
  const boots = C(look.boots);

  const drawSegs = (segs: Seg[]) => {
    for (const s of segs) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(-s.a);
      ctx.fillStyle = ink;
      ctx.fillRect(-s.w / 2 - 1, -1, s.w + 2, s.len + 2);
      ctx.restore();
    }
    for (const s of segs) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(-s.a);
      ctx.fillStyle = s.fill;
      ctx.fillRect(-s.w / 2, 0, s.w, s.len + 0.5);
      ctx.fillStyle = s.lite;
      ctx.fillRect(s.w / 2 - 1.2, 0.5, 1.2, s.len - 0.5);
      ctx.fillStyle = s.dark;
      ctx.fillRect(-s.w / 2, 0.5, 1.2, s.len - 0.5);
      ctx.restore();
    }
  };

  const boot = (ax: number, ay: number, shinA: number, dark: boolean) => {
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(-shinA * 0.45);
    ctx.fillStyle = ink;
    ctx.fillRect(-3.5, -1.5, 9.5, 6);
    ctx.fillStyle = dark ? C(cachedShade(look.boots, -0.25)) : boots;
    ctx.fillRect(-2.5, -0.5, 7.5, 4);
    ctx.fillStyle = C(cachedShade(look.boots, 0.28));
    ctx.fillRect(-2.5, -0.5, 7.5, 1);
    ctx.fillStyle = C('#1a1210');
    ctx.fillRect(-2.5, 3, 8, 1);
    ctx.restore();
  };

  const legSegs = (leg: [number, number], hx: number, dark: boolean, a: [number, number, number, number]): Seg[] => {
    const pf = dark ? pantsDark : pants;
    const pl = dark ? pants : pantsLite;
    const pd = dark ? C(cachedShade(look.pants, -0.45)) : pantsDark;
    return [
      { x: hx, y: HIP_Y, a: leg[0], len: THIGH, w: 5.5, fill: pf, lite: pl, dark: pd },
      { x: a[0], y: a[1], a: leg[1], len: SHIN, w: 4.5, fill: pf, lite: pl, dark: pd },
    ];
  };

  const armSegs = (arm: [number, number], sx: number, sy: number, dark: boolean): { segs: Seg[]; hand: [number, number] } => {
    const sleeve = dark ? shirtDark : shirt;
    const sl = dark ? shirt : shirtLite;
    const sd = dark ? C(cachedShade(look.shirtDark, -0.3)) : shirtDark;
    const upper = { x: sx, y: sy, a: arm[0], len: 10, w: 4.5, fill: sleeve, lite: sl, dark: sd };
    const [ex, ey] = end(upper);
    const fore = { x: ex, y: ey, a: arm[1], len: 9, w: 3.8, fill: sleeve, lite: sl, dark: sd };
    return { segs: [upper, fore], hand: end(fore) };
  };

  const hand = (hx: number, hy: number, dark: boolean) => {
    ctx.fillStyle = ink;
    ctx.fillRect(hx - 2.5, hy - 2, 5, 5);
    ctx.fillStyle = dark ? skinDark : skin;
    ctx.fillRect(hx - 1.5, hy - 1, 3, 3);
    if (!dark) {
      ctx.fillStyle = skinLite;
      ctx.fillRect(hx - 1.5, hy - 1, 3, 1);
    }
    if (isAether || outfit === 'miner') {
      ctx.fillStyle = C(isAether ? '#cbd5e1' : '#6b5a44');
      ctx.fillRect(hx - 1.5, hy - 1, 3, 2);
    }
  };

  /* ---------------- long hair behind the body ---------------- */
  const hs = look.hairStyle ?? 'short';
  const hair = C(look.hair);
  const hairLite = C(cachedShade(look.hair, 0.2));
  const hairDark = C(cachedShade(look.hair, -0.3));

  /* ---------------- back arm ---------------- */
  const SH_Y = -45 + breathe * 0.4;
  const backA = armSegs(backArm, -2.5, SH_Y, true);
  drawSegs(backA.segs);
  hand(backA.hand[0], backA.hand[1], true);

  /* ---------------- legs ---------------- */
  drawSegs(legSegs(backLeg, -1, true, bA));
  boot(bA[2], bA[3], backLeg[1], true);
  drawSegs(legSegs(frontLeg, 1, false, fA));
  boot(fA[2], fA[3], frontLeg[1], false);
  // knee patches / reflective tape on miner trousers
  if (outfit === 'miner' && !sil) {
    ctx.save();
    ctx.translate(fA[0], fA[1]);
    ctx.rotate(-frontLeg[1]);
    ctx.fillStyle = C('#d6d3a0');
    ctx.fillRect(-2.25, 4, 4.5, 1.2);
    ctx.restore();
  }

  /* ---------------- torso ---------------- */
  ctx.save();
  const lean = (pose === 'reach' ? 0.1 * clamp(o.reachProgress ?? 1) : pose === 'point' ? 0.1 : pose === 'walk' ? 0.05 : 0) + sway * 0.5;
  ctx.translate(0, HIP_Y);
  ctx.rotate(lean);
  ctx.translate(0, -HIP_Y + breathe * 0.4);

  if (hs === 'long' && !look.helmet) {
    ctx.fillStyle = ink;
    ctx.fillRect(-7, -57, 7, 18);
    ctx.fillStyle = hair;
    ctx.fillRect(-6, -56, 5, 16);
    ctx.fillStyle = hairDark;
    ctx.fillRect(-6, -48, 2, 8);
  }

  const top = -47;
  const bottom = isOfficial ? -16 : -26;
  const coatLen = isOfficial || look.apron ? 1 : 0;
  // body rows: tapered silhouette (shoulders 14 → waist 11 → hips 12)
  const widthAt = (y: number) => {
    const k = (y - top) / (-26 - top);
    if (y > -26) return 12 + (y + 26) * 0.18; // coat flare
    return k < 0.25 ? 13 + k * 4 : k < 0.7 ? 14 - (k - 0.25) * 6.6 : 11 + (k - 0.7) * 3.3;
  };
  for (let y = top - 1; y <= bottom + 1; y++) {
    const w = widthAt(Math.min(bottom, Math.max(top, y))) + 2;
    ctx.fillStyle = ink;
    ctx.fillRect(-w / 2 - 0.5, y, w, 1.15);
  }
  for (let y = top; y <= bottom; y++) {
    const w = widthAt(y);
    const x0 = -w / 2 - 0.5;
    ctx.fillStyle = shirt;
    ctx.fillRect(x0, y, w, 1.15);
    ctx.fillStyle = shirtLite;
    ctx.fillRect(x0 + w - 3, y, 2, 1.15);
    ctx.fillStyle = shirtDark;
    ctx.fillRect(x0, y, 3, 1.15);
  }
  // shoulder highlight & chest fold
  ctx.fillStyle = shirtLite;
  ctx.fillRect(-4, top, 9, 1);
  ctx.fillStyle = shirtDark;
  ctx.fillRect(1, -40, 1, 6);

  if (isAether) {
    // white clean-suit seams, cyan piping, glowing chest badge
    ctx.fillStyle = C('#38bdf8');
    ctx.fillRect(-7, -38, 14, 1);
    ctx.fillRect(0, -46, 1, 18);
    ctx.fillStyle = C('#0f172a');
    ctx.fillRect(2, -44, 4, 3);
    ctx.fillStyle = C('#7dd3fc');
    ctx.fillRect(3, -43, 2, 1);
    if (!sil) drawBlob(ctx, '#38bdf8', 4, -43, 4, 0.35);
  } else if (isOfficial) {
    // long tailored coat with lapels and buttons
    ctx.fillStyle = shirtDark;
    ctx.fillRect(-1, -46, 1, 30);
    ctx.fillStyle = C('#e2e8f0');
    ctx.fillRect(0, -46, 3, 5);
    ctx.fillStyle = C('#1e293b');
    ctx.fillRect(1, -46, 1, 6);
    for (let by = -38; by < -20; by += 5) {
      ctx.fillStyle = C('#cbd5e1');
      ctx.fillRect(1, by, 1, 1);
    }
    ctx.fillStyle = C('#38bdf8');
    ctx.fillRect(3, -41, 3, 1);
  } else {
    // collar
    ctx.fillStyle = C(cachedShade(look.shirt, -0.32));
    ctx.fillRect(-2, -47, 6, 2);
    ctx.fillStyle = skinDark;
    ctx.fillRect(0, -47, 2, 2);
    // open-front jacket line & chest pocket with flap
    ctx.fillStyle = shirtDark;
    ctx.fillRect(1, -45, 1, 17);
    ctx.fillRect(3, -42, 3, 3);
    ctx.fillStyle = shirtLite;
    ctx.fillRect(3, -42, 3, 1);
    if (outfit === 'miner') {
      // hi-vis reflective bands
      ctx.fillStyle = C('#e8e3a2');
      ctx.fillRect(-6.5, -36, 13, 1.5);
      ctx.fillStyle = C('#f8f5c8');
      ctx.fillRect(3, -36, 3, 1.5);
    }
  }
  if (!isOfficial) {
    // belt, buckle, hip pouch
    ctx.fillStyle = C('#2a1d16');
    ctx.fillRect(-6.5, -29, 13, 2.5);
    ctx.fillStyle = C('#d6b04c');
    ctx.fillRect(2, -29, 2, 2.5);
    ctx.fillStyle = C('#5a4030');
    ctx.fillRect(-6, -28, 4, 4);
    ctx.fillStyle = C('#7a5840');
    ctx.fillRect(-6, -28, 4, 1);
  }
  if (look.apron) {
    const ap = C(look.apron);
    ctx.fillStyle = ink;
    ctx.fillRect(-2, -43, 9, 25);
    ctx.fillStyle = ap;
    ctx.fillRect(-1, -42, 7, 23);
    ctx.fillStyle = C(cachedShade(look.apron, 0.22));
    ctx.fillRect(4, -42, 2, 23);
    ctx.fillStyle = C(cachedShade(look.apron, -0.25));
    ctx.fillRect(-1, -42, 1, 23);
    ctx.fillRect(0, -32, 5, 1);
    // strap
    ctx.fillStyle = C(cachedShade(look.apron, -0.35));
    ctx.fillRect(-3, -47, 2, 6);
  }
  if (o.rim && !sil) {
    ctx.fillStyle = o.rim;
    ctx.globalAlpha = 0.75;
    for (let y = top; y <= bottom; y++) {
      const w = widthAt(y);
      ctx.fillRect(-w / 2 - 0.5, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  void coatLen;

  /* ---------------- neck & head ---------------- */
  ctx.fillStyle = ink;
  ctx.fillRect(-2, -50, 5, 4);
  ctx.fillStyle = skinDark;
  ctx.fillRect(-1, -50, 3, 3);

  const HY = -60; // head top
  // rounded head shape (9 wide x 11 tall)
  const headRows: Array<[number, number]> = [
    [-3, 7], [-4, 9], [-4, 9], [-4, 9], [-4, 10], [-4, 10], [-4, 10], [-4, 9], [-3, 8], [-3, 7], [-2, 5],
  ];
  headRows.forEach(([x0, w], i) => {
    ctx.fillStyle = ink;
    ctx.fillRect(x0 - 1, HY + i - (i === 0 ? 1 : 0), w + 2, 1 + (i === 0 ? 1 : 0));
  });
  ctx.fillStyle = ink;
  ctx.fillRect(-2, HY + 11, 6, 1);
  headRows.forEach(([x0, w], i) => {
    ctx.fillStyle = skin;
    ctx.fillRect(x0, HY + i, w, 1.15);
    ctx.fillStyle = skinDark;
    ctx.fillRect(x0, HY + i, 2, 1.15);
    if (i > 1 && i < 7) {
      ctx.fillStyle = skinLite;
      ctx.fillRect(x0 + w - 3, HY + i, 2, 1);
    }
  });
  // jaw shadow & ear
  ctx.fillStyle = skinDark;
  ctx.fillRect(-2, HY + 9, 5, 1);
  ctx.fillRect(-2, HY + 4, 1, 3);
  ctx.fillStyle = C(cachedShade(look.skin, -0.38));
  ctx.fillRect(-2, HY + 5, 1, 1);
  // nose (protrudes in 3/4 view)
  ctx.fillStyle = ink;
  ctx.fillRect(7, HY + 4, 1, 3);
  ctx.fillStyle = skin;
  ctx.fillRect(6, HY + 4, 1, 3);
  ctx.fillStyle = skinDark;
  ctx.fillRect(6, HY + 6, 1, 1);

  // eyes
  const blink = (t + (look.skin.charCodeAt(2) % 7) * 0.31) % 4.1 < 0.12;
  const faceInk = C('#1d120d');
  if (!sil) {
    if (blink) {
      ctx.fillStyle = faceInk;
      ctx.fillRect(1, HY + 5, 2, 1);
      ctx.fillRect(4, HY + 5, 1, 1);
    } else {
      ctx.fillStyle = C('#f4efe6');
      ctx.fillRect(1, HY + 4, 2, 2);
      ctx.fillRect(4, HY + 4, 1, 2);
      ctx.fillStyle = faceInk;
      ctx.fillRect(2, HY + 4, 1, 2);
      ctx.fillRect(4, HY + 4, 1, 2);
      ctx.fillStyle = C('#ffffff');
      ctx.fillRect(2, HY + 4, 1, 1);
    }
    // brows
    ctx.fillStyle = hairDark;
    ctx.fillRect(1, HY + 3, 2, 1);
    ctx.fillRect(4, HY + 3, 1, 1);
    // cheek warmth
    ctx.fillStyle = C(cachedMix(look.skin, '#d65a4a', 0.28));
    ctx.fillRect(3, HY + 7, 2, 1);
    // mouth
    const talk = pose === 'cheer' || (o.talking && Math.floor(t * 9) % 3 !== 1);
    if (talk) {
      ctx.fillStyle = ink;
      ctx.fillRect(2, HY + 8, 3, 2);
      ctx.fillStyle = C('#7a2a24');
      ctx.fillRect(3, HY + 8, 2, 1);
    } else {
      ctx.fillStyle = C(cachedShade(look.skin, -0.42));
      ctx.fillRect(2, HY + 8, 3, 1);
    }
  }

  // glasses
  if (look.glasses && !sil) {
    ctx.fillStyle = C('#d6dde6');
    ctx.fillRect(0, HY + 3, 4, 1);
    ctx.fillRect(0, HY + 6, 3, 1);
    ctx.fillRect(0, HY + 3, 1, 4);
    ctx.fillRect(3, HY + 3, 1, 4);
    ctx.fillRect(4, HY + 4, 2, 1);
    ctx.fillRect(-2, HY + 4, 2, 1);
  }

  // beard
  if (look.beard) {
    ctx.fillStyle = ink;
    ctx.fillRect(-2, HY + 7, 8, 5);
    ctx.fillStyle = hair;
    ctx.fillRect(-1, HY + 7, 7, 4);
    ctx.fillStyle = hairLite;
    ctx.fillRect(3, HY + 7, 2, 1);
    ctx.fillStyle = hairDark;
    ctx.fillRect(-1, HY + 10, 7, 1);
    ctx.fillStyle = C('#3a1f1a');
    ctx.fillRect(2, HY + 8, 3, 1);
  }

  // hair
  if (hs === 'bald') {
    ctx.fillStyle = hair;
    ctx.fillRect(-4, HY + 3, 3, 4);
    ctx.fillStyle = C(cachedShade(look.skin, 0.32));
    ctx.fillRect(1, HY, 3, 1);
  } else {
    ctx.fillStyle = hair;
    ctx.fillRect(-4, HY - 1, 9, 3);
    ctx.fillRect(-5, HY, 3, 7);
    ctx.fillRect(4, HY + 1, 2, 2);
    ctx.fillStyle = hairLite;
    ctx.fillRect(-1, HY - 1, 4, 1);
    ctx.fillRect(2, HY, 3, 1);
    ctx.fillStyle = hairDark;
    ctx.fillRect(-5, HY + 4, 2, 3);
    if (hs === 'bun') {
      ctx.fillStyle = ink;
      ctx.fillRect(-8, HY - 2, 5, 5);
      ctx.fillStyle = hair;
      ctx.fillRect(-7, HY - 1, 3, 3);
      ctx.fillStyle = hairLite;
      ctx.fillRect(-6, HY - 1, 2, 1);
    } else if (hs === 'long') {
      ctx.fillStyle = hair;
      ctx.fillRect(-5, HY + 6, 3, 6);
    }
  }

  // helmet / hood
  if (isAether && !look.helmet) {
    ctx.fillStyle = ink;
    ctx.fillRect(-6, HY - 3, 13, 9);
    ctx.fillStyle = C('#e2e8f0');
    ctx.fillRect(-5, HY - 2, 11, 7);
    ctx.fillStyle = C('#ffffff');
    ctx.fillRect(1, HY - 2, 4, 1);
    ctx.fillStyle = C('#0f172a');
    ctx.fillRect(0, HY + 3, 7, 3);
    ctx.fillStyle = C('#22d3ee');
    ctx.fillRect(1, HY + 4, 5, 1);
    if (!sil) drawBlob(ctx, '#22d3ee', 4, HY + 4, 5, 0.3);
  } else if (look.helmet) {
    const hm = C(look.helmet);
    ctx.fillStyle = ink;
    ctx.fillRect(-6, HY - 4, 13, 7);
    ctx.fillRect(-7, HY + 1, 16, 3);
    ctx.fillStyle = hm;
    ctx.fillRect(-5, HY - 3, 11, 5);
    ctx.fillRect(-6, HY + 2, 14, 1);
    ctx.fillStyle = C(cachedShade(look.helmet, 0.35));
    ctx.fillRect(-2, HY - 3, 6, 1);
    ctx.fillRect(1, HY - 2, 1, 4);
    ctx.fillStyle = C(cachedShade(look.helmet, -0.3));
    ctx.fillRect(-5, HY, 2, 2);
    // headlamp
    ctx.fillStyle = ink;
    ctx.fillRect(5, HY - 2, 4, 4);
    ctx.fillStyle = C('#fff3b0');
    ctx.fillRect(6, HY - 1, 2, 2);
    if (o.lampOn && !sil) drawBlob(ctx, '#ffe9a8', 8, HY, 9, 0.55);
  }

  if (o.rim && !sil) {
    ctx.fillStyle = o.rim;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-5, HY + 1, 1, 8);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  /* ---------------- front arm + prop ---------------- */
  ctx.save();
  ctx.translate(0, HIP_Y);
  ctx.rotate(lean);
  ctx.translate(0, -HIP_Y + breathe * 0.4);
  const front = armSegs(frontArm, 2.5, SH_Y + 0.5, false);
  drawSegs(front.segs);
  const [hx, hy] = front.hand;
  if (prop === 'lantern') {
    // lantern hangs from the hand
    ctx.fillStyle = ink;
    ctx.fillRect(hx - 0.5, hy, 1, 4);
    ctx.fillRect(hx - 3.5, hy + 3, 7, 10);
    ctx.fillStyle = C('#4a5567');
    ctx.fillRect(hx - 2.5, hy + 4, 5, 1);
    ctx.fillRect(hx - 2.5, hy + 11, 5, 1);
    ctx.fillStyle = C('#ffe9a8');
    ctx.fillRect(hx - 2.5, hy + 5, 5, 6);
    ctx.fillStyle = C('#fff9e0');
    ctx.fillRect(hx - 1, hy + 6, 2, 3);
    if (!sil) drawBlob(ctx, '#ffcf70', hx, hy + 8, 22, 0.42 + Math.sin(t * 13) * 0.04);
  } else if (prop === 'wrench') {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(-frontArm[1] + 0.25);
    ctx.fillStyle = ink;
    ctx.fillRect(-1.5, -14, 3, 16);
    ctx.fillRect(-3.5, -18, 7, 6);
    ctx.fillStyle = C('#a8b0bd');
    ctx.fillRect(-0.5, -13, 1.5, 14);
    ctx.fillRect(-2.5, -17, 5, 4);
    ctx.fillStyle = ink;
    ctx.fillRect(-1, -18, 2, 3);
    ctx.restore();
  } else if (prop === 'clipboard') {
    ctx.fillStyle = ink;
    ctx.fillRect(hx - 1, hy - 9, 8, 11);
    ctx.fillStyle = C('#8a6a44');
    ctx.fillRect(hx, hy - 8, 6, 9);
    ctx.fillStyle = C('#efe6cf');
    ctx.fillRect(hx + 0.5, hy - 7, 5, 7);
    ctx.fillStyle = C('#6a6a7a');
    ctx.fillRect(hx + 1, hy - 5, 4, 0.8);
    ctx.fillRect(hx + 1, hy - 3, 3, 0.8);
    ctx.fillStyle = C('#cbd5e1');
    ctx.fillRect(hx + 2, hy - 9, 2, 1.5);
  } else if (prop === 'mug') {
    ctx.fillStyle = ink;
    ctx.fillRect(hx - 1, hy - 5, 6, 7);
    ctx.fillStyle = C('#c9a06a');
    ctx.fillRect(hx, hy - 4, 4, 5);
    ctx.fillStyle = C('#5b3a20');
    ctx.fillRect(hx, hy - 4, 4, 1);
  } else if (prop === 'drill') {
    ctx.fillStyle = ink;
    ctx.fillRect(hx - 2, hy - 3, 12, 6);
    ctx.fillStyle = C('#64748b');
    ctx.fillRect(hx - 1, hy - 2, 7, 4);
    ctx.fillStyle = C('#f59e0b');
    ctx.fillRect(hx + 6, hy - 1, 4, 2);
  }
  if (pose === 'reach') {
    // glowing Aether power core offered in the palm
    ctx.fillStyle = ink;
    ctx.fillRect(hx + 1, hy - 4, 6, 6);
    ctx.fillStyle = C('#fde047');
    ctx.fillRect(hx + 2, hy - 3, 4, 4);
    ctx.fillStyle = C('#ffffff');
    ctx.fillRect(hx + 2, hy - 3, 2, 2);
    if (!sil) drawBlob(ctx, '#fde047', hx + 4, hy - 1, 10 + Math.sin(t * 6) * 2, 0.55);
  }
  hand(hx, hy, false);
  if (pose === 'point') {
    ctx.fillStyle = ink;
    ctx.fillRect(hx + 1, hy - 1, 5, 3);
    ctx.fillStyle = skin;
    ctx.fillRect(hx + 1, hy, 4, 1);
  }
  ctx.restore();

  ctx.restore();
}

const humanIds = new WeakMap<object, number>();
let nextHumanId = 1;
const cinematicFrames = new Map<string, HTMLCanvasElement>();
const FRAME_ORIGIN_X = 32;
const FRAME_GROUND_Y = 86;
const FRAME_W = 96;
const FRAME_H = 96;

/** Draw a cached pose frame; humans have discrete pixel-art joints by design. */
export function cinematicHuman(ctx: CanvasRenderingContext2D, o: CineHumanOpts) {
  const look = o.look;
  let id = humanIds.get(look);
  if (!id) { id = nextHumanId++; humanIds.set(look, id); }
  const pose = o.pose ?? 'idle';
  const walkingPhase = o.walkPhase ?? o.t * 4.5;
  let frame: number;
  let frameTime: number;
  let frameCount: number;
  if (pose === 'walk') {
    frameCount = 8;
    frame = ((Math.floor(walkingPhase * 1.75 / (Math.PI * 2) * frameCount) % frameCount) + frameCount) % frameCount;
    frameTime = 0.9;
  } else if (pose === 'wave') {
    frameCount = 8;
    frame = Math.floor(o.t * 8) % frameCount;
    frameTime = frame / 8;
  } else if (pose === 'cheer') {
    frameCount = 8;
    frame = Math.floor(o.t * 11) % frameCount;
    frameTime = frame * (Math.PI * 2 / 11) / 8;
  } else if (pose === 'idle' || pose === 'hold') {
    frameCount = 33;
    frame = Math.floor(o.t * 8) % frameCount;
    frameTime = frame / 8;
  } else {
    frameCount = o.talking ? 12 : 1;
    frame = o.talking ? Math.floor(o.t * 9) % frameCount : 0;
    frameTime = frame / 9;
  }
  const scale = (o.s ?? 3) * 0.5 * (look.small ? 0.8 : 1);
  const dim = Math.round(clamp(o.dim ?? 0) * 20) / 20;
  const reachProgress = pose === 'reach' ? Math.round(clamp(o.reachProgress ?? 1) * 24) / 24 : 1;
  // The source sprite is always painted at s=2. Destination scale belongs on
  // the transform, not in the cache key (continuous doorway depth used to mint
  // hundreds of identical atlases and evict the entire cast).
  const key = [id, pose, frame, o.outfit ?? '', o.rim ?? '',
    o.silhouette ?? '', dim, o.flipProp ?? '', o.talking ? 1 : 0, o.lampOn ? 1 : 0, reachProgress].join(':');
  let sprite = cacheGet(cinematicFrames, key);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = FRAME_W;
    sprite.height = FRAME_H;
    const g = sprite.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    paintCinematicHuman(g, {
      ...o,
      x: FRAME_ORIGIN_X,
      y: FRAME_GROUND_Y,
      s: 2,
      t: frameTime,
      walkPhase: pose === 'walk' ? frame / frameCount * Math.PI * 2 / 1.75 : 0,
      reachProgress,
      facing: 1,
    });
    cacheSet(cinematicFrames, key, sprite, 384);
  }
  const facing = o.facing ?? 1;
  ctx.save();
  ctx.translate(Math.round(o.x), Math.round(o.y));
  ctx.scale(facing * scale, scale);
  ctx.drawImage(sprite, -FRAME_ORIGIN_X, -FRAME_GROUND_Y);
  ctx.restore();
}

/* ------------------------------ doorway reveal ------------------------------ */
export interface DoorwayOpts {
  /** Screen-space opening rectangle (the hole people pass through). */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Floor y where feet land (sill). */
  sill: number;
  /** 0 = deep inside, 1 = standing in the threshold plane, >1 = out on the ground. */
  k: number;
  /** Colour of the interior gloom the figure emerges from. */
  gloom?: string;
}

/**
 * Draw a human emerging from (or retreating into) a doorway with continuous
 * motion: while k < 1 the sprite is clipped to the opening, scaled down for
 * depth, dimmed into the interior gloom and raised a little up the floor
 * plane; it slides to the threshold and only then walks free. No pop-in.
 */
export function humanThroughDoorway(ctx: CanvasRenderingContext2D, d: DoorwayOpts, o: CineHumanOpts) {
  if (d.k <= 0) return; // still fully inside / not yet visible
  const inside = d.k < 1;
  const gloom = d.gloom ?? '#0b1016';

  // Depth is continuous now that scale is independent of the pose cache.
  // Figures stay slightly compressed while framed by the vault, then grow to
  // full scale over the first steps outside so heads never pop through the lintel.
  const k = clamp(d.k);
  const depth = inside ? 0.7 + 0.24 * k : Math.min(1, 0.94 + (d.k - 1) * 0.6);
  const recede = inside ? 1 - k : 0;

  ctx.save();
  // Fade up out of the interior gloom instead of appearing on the first frame.
  ctx.globalAlpha = inside ? clamp(d.k * 5) : 1;
  if (inside) {
    ctx.beginPath();
    ctx.rect(d.left, d.top, d.width, d.height);
    ctx.clip();
  }
  // Deeper in the room = higher on the floor plane and further up the wall.
  const rise = recede * d.height * 0.16;
  cinematicHuman(ctx, {
    ...o,
    s: (o.s ?? 3) * depth,
    y: d.sill - rise,
    dim: Math.max(o.dim ?? 0, recede * 0.55),
  });
  // Atmospheric veil: a gradient (not a flat box) so the gloom densest at the
  // back of the shelter and fully clear at the threshold the figure walks to.
  const veil = recede * 0.5;
  if (veil > 0.02) {
    const g = ctx.createLinearGradient(d.left, 0, d.left + d.width, 0);
    g.addColorStop(0, hexA(gloom, veil));
    g.addColorStop(0.75, hexA(gloom, veil * 0.35));
    g.addColorStop(1, hexA(gloom, 0));
    ctx.fillStyle = g;
    ctx.fillRect(d.left, d.top, d.width, d.height);
  }
  ctx.restore();
}

/** `#rrggbb` + alpha -> `rgba()` string (no allocation-heavy parsing). */
function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a.toFixed(3)})`;
}

/* ------------------------------ looks ------------------------------ */
type Look = HeroHumanOpts['look'];

export const AETHER_TECH: Look = {
  skin: '#e2b896',
  hair: '#2b2230',
  shirt: '#eef2f7',
  shirtDark: '#9aa8ba',
  pants: '#cfd8e3',
  boots: '#64748b',
  hairStyle: 'short',
};
export const AETHER_TECH_B: Look = {
  skin: '#a8714f',
  hair: '#1c1418',
  shirt: '#f1f5f9',
  shirtDark: '#94a3b8',
  pants: '#cbd5e1',
  boots: '#475569',
  hairStyle: 'bun',
};
export const AETHER_OFFICIAL: Look = {
  skin: '#d9a888',
  hair: '#c9c3bb',
  shirt: '#334155',
  shirtDark: '#1e293b',
  pants: '#1f2937',
  boots: '#0f172a',
  hairStyle: 'short',
  glasses: true,
};
export const AETHER_OFFICIAL_B: Look = {
  skin: '#8d5a3e',
  hair: '#141018',
  shirt: '#e2e8f0',
  shirtDark: '#94a3b8',
  pants: '#475569',
  boots: '#1e293b',
  hairStyle: 'long',
};

/** Survivor crowd variants (for background workers). */
export const CROWD: Look[] = [
  { skin: '#c48a68', hair: '#3a2a22', shirt: '#6f6255', shirtDark: '#4a4038', pants: '#3b3a46', boots: '#241a16', helmet: '#d9a23a', hairStyle: 'short' },
  { skin: '#8a5a40', hair: '#1a1214', shirt: '#5d6e7c', shirtDark: '#3c4954', pants: '#33313d', boots: '#1e1714', hairStyle: 'bun' },
  { skin: '#e0b090', hair: '#7a4a2a', shirt: '#7a5a5f', shirtDark: '#523c40', pants: '#3e3a32', boots: '#2a1d17', hairStyle: 'long' },
  { skin: '#a8724f', hair: '#2a2a2a', shirt: '#66704f', shirtDark: '#454d35', pants: '#2f3038', boots: '#201814', helmet: '#c8c2b0', beard: true, hairStyle: 'short' },
  { skin: '#d49a78', hair: '#b8b0a4', shirt: '#7d6a4d', shirtDark: '#574a35', pants: '#3a3644', boots: '#231a15', hairStyle: 'bald', beard: true },
  { skin: '#6e4632', hair: '#120c0e', shirt: '#8a4f3a', shirtDark: '#5e3426', pants: '#2c2b34', boots: '#1a1412', hairStyle: 'short', small: true },
];

export function crowdLook(i: number): Look {
  return CROWD[((i % CROWD.length) + CROWD.length) % CROWD.length];
}

const worldFrames = new Map<string, HTMLCanvasElement>();

/** The gameplay atlas is rendered from the SAME articulated figures as the story. */
export function drawWorldHuman(ctx: CanvasRenderingContext2D, id: string, x: number, groundY: number, look: Look,
  pose: 'idle' | 'walk' | 'wave' | 'hold' | 'kneel', phase: number, facing: 1 | -1,
  prop: HeroHumanOpts['flipProp'] = null, talking = false) {
  const count = pose === 'walk' ? 12 : 8;
  const frame = Math.floor(Math.abs(phase) * (pose === 'walk' ? 15 : pose === 'wave' ? 8 : 3)) % count;
  const key = `${id}:${look.shirt}:${look.helmet}:${pose}:${frame}:${prop}:${talking}`;
  let sprite = cacheGet(worldFrames, key);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = 112;
    sprite.height = 112;
    const g = sprite.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    cinematicHuman(g, {
      x: 56, y: 100, s: 2.3,
      t: pose === 'walk' ? frame / 12 : frame * 0.54,
      walkPhase: frame / count * Math.PI * 2 / 1.75,
      look, pose, facing: 1, flipProp: prop, talking,
      rim: '#d5ac76', lampOn: true,
    });
    cacheSet(worldFrames, key, sprite, 320);
  }
  ctx.save();
  ctx.translate(Math.round(x), Math.round(groundY));
  ctx.scale(facing, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, -28, -50, 56, 56);
  ctx.restore();
}

export { R };
