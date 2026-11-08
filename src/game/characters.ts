import type { FacingDir } from './types';

/* ================================================================== *
 *  CAST — the old humans of the outpost + CUBE-07
 * ================================================================== */
export type SpeakerId = 'mara' | 'gus' | 'ilse' | 'pip' | 'cube';

export interface HumanLook {
  skin: string;
  hair: string;
  shirt: string;
  shirtDark: string;
  pants: string;
  boots: string;
  helmet?: string | null;
  apron?: string | null;
  beard?: boolean;
  glasses?: boolean;
  hairStyle?: 'short' | 'long' | 'bun' | 'bald';
  small?: boolean;
}

export interface CharacterInfo {
  id: SpeakerId;
  name: string;
  role: string;
  accent: string;
  look?: HumanLook;
}

export const CHARACTERS: Record<SpeakerId, CharacterInfo> = {
  mara: {
    id: 'mara',
    name: 'MARA',
    role: 'Refinery Elder',
    accent: '#fbbf24',
    look: {
      skin: '#c98e6b',
      hair: '#dcd6cc',
      shirt: '#6b4a2e',
      shirtDark: '#4a321e',
      pants: '#3d3a4a',
      boots: '#2a1d17',
      apron: '#a0703f',
      hairStyle: 'bun',
    },
  },
  gus: {
    id: 'gus',
    name: 'GUS',
    role: 'Forge Mechanic',
    accent: '#38bdf8',
    look: {
      skin: '#8d5a3b',
      hair: '#2a1d17',
      shirt: '#2f6f9f',
      shirtDark: '#1f4c6e',
      pants: '#2f4a6b',
      boots: '#1c1917',
      helmet: '#eab308',
      beard: true,
      hairStyle: 'short',
    },
  },
  ilse: {
    id: 'ilse',
    name: 'DOC ILSE',
    role: 'Service Bay Medic',
    accent: '#4ade80',
    look: {
      skin: '#f0c7a5',
      hair: '#b5482f',
      shirt: '#e8e4da',
      shirtDark: '#b9b3a6',
      pants: '#4a6b55',
      boots: '#2a2a2a',
      glasses: true,
      hairStyle: 'long',
    },
  },
  pip: {
    id: 'pip',
    name: 'PIP',
    role: 'Outpost Kid',
    accent: '#fb923c',
    look: {
      skin: '#d9a27c',
      hair: '#5a3a1e',
      shirt: '#c2410c',
      shirtDark: '#8a2e08',
      pants: '#4b5563',
      boots: '#292524',
      hairStyle: 'short',
      small: true,
    },
  },
  cube: {
    id: 'cube',
    name: 'CUBE-07',
    role: 'Fallen Aether Unit',
    accent: '#5cc9ff',
  },
};

export const NPC_LINES: Record<Exclude<SpeakerId, 'cube'>, string[]> = {
  mara: [
    "Sulfur's paying well today, Cube.",
    'Deep veins hold the riches Aether forgot.',
    "Bring the ore. We'll handle the rest.",
    'You fell from the sky and still work hard.',
  ],
  gus: [
    'Got new parts on the bench for ya!',
    'That drill holding up? Built it from junk!',
    "Aether's fancy drones can't even dig. Ha!",
    'Bring copper, I need it for your thrusters.',
  ],
  ilse: [
    'Hold still, let me patch that hull.',
    "Mind the sulfur gas... oh, you don't breathe.",
    'Come back in one piece, Cube.',
    'Your welds are holding. Good.',
  ],
  pip: [
    'Cube! Cube! Find a shiny one!',
    'Is it true you fell from the clouds?',
    'When I grow up I wanna mine too!',
    'Can I ride on your treads? Pleeease?',
  ],
};

/* ================================================================== *
 *  HUMAN SPRITE — outlined pixel humans with walk / wave / reach / talk
 * ================================================================== */
export interface HumanAnim {
  time: number;
  walkPhase: number;
  walking: boolean;
  facing: 1 | -1;
  wave?: boolean;
  reach?: boolean;
  cheer?: boolean;
  talking?: boolean;
}

type Part = [number, number, number, number, string];

export function drawHuman(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  look: HumanLook,
  anim: HumanAnim
) {
  const parts: Part[] = [];
  const add = (px: number, py: number, w: number, h: number, c: string) => parts.push([px, py, w, h, c]);

  const frame = anim.walking ? Math.floor(anim.walkPhase) % 4 : 0;
  const bob = anim.walking ? (frame % 2 === 1 ? -1 : 0) : Math.sin(anim.time * 2.2) > 0.6 ? -0 : 0;
  const breathe = !anim.walking && Math.sin(anim.time * 2.4) > 0.3 ? 0 : 0;
  const by = bob + breathe;

  // Legs (alternating stride)
  const strideA = anim.walking ? [0, 1, 0, -1][frame] : 0;
  const liftA = anim.walking && frame === 1 ? -1 : 0;
  const liftB = anim.walking && frame === 3 ? -1 : 0;
  add(-2 + strideA, -6 + liftA, 2, 5, look.pants);
  add(0 - strideA, -6 + liftB, 2, 5, look.pants);
  add(-2 + strideA, -1 + liftA, 3, 1, look.boots);
  add(0 - strideA, -1 + liftB, 3, 1, look.boots);

  // Back arm
  const swing = anim.walking ? [0, 1, 0, -1][frame] : 0;
  if (anim.cheer) {
    const c = Math.sin(anim.time * 12) > 0 ? -1 : 0;
    add(-4, -18 + by + c, 2, 6, look.shirtDark);
    add(-4, -19 + by + c, 2, 1, look.skin);
  } else {
    add(-3 - swing, -12 + by, 2, 5, look.shirtDark);
    add(-3 - swing, -7 + by, 2, 1, look.skin);
  }

  // Torso
  add(-3, -13 + by, 6, 7, look.shirt);
  add(-3, -8 + by, 6, 1, look.shirtDark);
  if (look.apron) add(0, -12 + by, 3, 6, look.apron);

  // Head
  add(-2, -19 + by, 5, 6, look.skin);
  // Hair
  const style = look.hairStyle || 'short';
  if (style !== 'bald') {
    add(-2, -19 + by, 5, 1, look.hair);
    add(-2, -18 + by, 2, 2, look.hair);
  }
  if (style === 'long') add(-3, -18 + by, 2, 6, look.hair);
  if (style === 'bun') add(-4, -20 + by, 2, 2, look.hair);
  if (look.beard) add(-1, -15 + by, 4, 2, look.hair);

  // Helmet with lamp
  if (look.helmet) {
    add(-3, -21 + by, 7, 3, look.helmet);
    add(3, -20 + by, 2, 1, '#fff3b0');
  }

  // Front arm
  if (anim.wave || anim.cheer) {
    const w = Math.sin(anim.time * (anim.cheer ? 12 : 9)) > 0 ? 1 : 0;
    add(2, -19 + by, 2, 6, look.shirt);
    add(2 + w, -21 + by, 2, 2, look.skin);
  } else if (anim.reach) {
    add(2, -12 + by, 6, 2, look.shirt);
    add(8, -12 + by, 2, 2, look.skin);
  } else {
    add(0 + swing, -12 + by, 2, 5, look.shirt);
    add(0 + swing, -7 + by, 2, 1, look.skin);
  }

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  const s = look.small ? 0.8 : 1;
  ctx.scale(anim.facing * s, s);

  // Outline pass then color pass = clean readable silhouette
  ctx.fillStyle = '#08060e';
  for (const [px, py, w, h] of parts) ctx.fillRect(px - 1, py - 1, w + 2, h + 2);
  for (const [px, py, w, h, c] of parts) {
    ctx.fillStyle = c;
    ctx.fillRect(px, py, w, h);
  }

  // Face details
  const blink = anim.time % 4.1 < 0.12;
  ctx.fillStyle = '#1a1210';
  if (!blink) ctx.fillRect(1, -17 + by, 1, 1);
  if (look.glasses) {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, -17 + by, 3, 1);
    ctx.fillStyle = '#1a1210';
    if (!blink) ctx.fillRect(1, -17 + by, 1, 1);
  }
  // Mouth (animated while talking)
  const mouthOpen = anim.talking && Math.floor(anim.time * 10) % 2 === 0;
  ctx.fillStyle = mouthOpen ? '#5a1e1e' : shadeHex(look.skin, -0.3);
  ctx.fillRect(1, -15 + by + (look.beard ? -0 : 0), 2, mouthOpen ? 1 : 1);
  // Cheek light
  ctx.fillStyle = shadeHex(look.skin, 0.18);
  ctx.fillRect(-1, -18 + by, 1, 1);

  ctx.restore();
}

function shadeHex(hex: string, ratio: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(ratio >= 0 ? v + (255 - v) * ratio : v * (1 + ratio))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/* ================================================================== *
 *  CUBE-07 — rebuilt from scrap, with idle personality
 * ================================================================== */
const ARMOR_PALETTES = [
  { body: '#d9772a', light: '#ffb457', dark: '#9c4a0d', deep: '#6d3208', trim: '#3d4453', glow: '#ffcf7a' },
  { body: '#2f8fb8', light: '#7fd8f7', dark: '#1c5a78', deep: '#123d52', trim: '#dbe4ee', glow: '#a9e9ff' },
  { body: '#d9c31e', light: '#fff585', dark: '#8a7a09', deep: '#5d5206', trim: '#2a2833', glow: '#fffab8' },
  { body: '#7741d4', light: '#b489ff', dark: '#472189', deep: '#2e1560', trim: '#e6ecf5', glow: '#d9b8ff' },
  { body: '#f0b829', light: '#fff3b0', dark: '#a06c07', deep: '#6d4905', trim: '#ffffff', glow: '#fffbe0' },
];

const DRILL_PALETTES = [
  { main: '#9ca3af', light: '#f3f4f6', dark: '#4b5563', hot: '#fde68a' },
  { main: '#38bdf8', light: '#e0f2fe', dark: '#075985', hot: '#a5f3fc' },
  { main: '#f59e0b', light: '#fef3c7', dark: '#92400e', hot: '#fff7ed' },
  { main: '#e879f9', light: '#f5d0fe', dark: '#86198f', hot: '#a5f3fc' },
  { main: '#fde047', light: '#ffffff', dark: '#b45309', hot: '#ffedd5' },
];

const chassisCache = new Map<string, HTMLCanvasElement>();

function chassisSprite(tier: number, pristine: boolean, tint: string | null): HTMLCanvasElement {
  const key = `${tier}-${pristine ? 1 : 0}-${tint || 'normal'}`;
  const cached = chassisCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 18;
  canvas.height = 16;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.translate(9, 10);
  const armor = ARMOR_PALETTES[Math.max(0, Math.min(4, tier - 1))];
  const T = (color: string) => tint || color;

  c.fillStyle = '#08060e';
  c.fillRect(-8, -8, 16, 12);
  c.fillRect(-7, -9, 14, 1);
  c.fillRect(-7, 4, 14, 1);
  c.fillStyle = T(armor.body);
  c.fillRect(-7, -8, 14, 11);
  c.fillStyle = T(armor.light);
  c.fillRect(-7, -8, 14, 2);
  c.fillRect(-7, -8, 2, 10);
  c.fillStyle = T(armor.dark);
  c.fillRect(-6, 1, 13, 2);
  c.fillRect(5, -6, 2, 9);
  c.fillStyle = T(armor.deep);
  c.fillRect(-6, 2, 13, 1);
  c.fillRect(-6, -3, 12, 1);
  c.fillStyle = T(armor.trim);
  for (let i = 0; i < 4; i++) c.fillRect(-6 + i * 3, -2, 2, 1);
  c.fillStyle = T(armor.glow);
  for (const [x, y] of [[-6, -7], [5, -7], [-6, 2], [5, 2]]) c.fillRect(x, y, 1, 1);

  if (!pristine && tier <= 2) {
    c.fillStyle = T('#3a2412');
    c.fillRect(1, -1, 6, 4);
    c.fillStyle = T('#8a5a32');
    c.fillRect(2, 0, 4, 2);
    c.fillStyle = T('#b07a48');
    c.fillRect(2, 0, 4, 1);
    c.fillStyle = T('#d9b48a');
    c.fillRect(2, 2, 1, 1);
    c.fillRect(5, 2, 1, 1);
    if (tier === 1) {
      c.fillStyle = T('#cfc5a5');
      for (const [x, y] of [[-6, -7], [-5, -6], [-4, -5], [-4, -7], [-6, -5]]) {
        c.fillRect(x, y, 1, 1);
      }
    }
  }

  // Armor tiers alter the silhouette and exposed hardware, not only its color.
  if (tier >= 2) {
    c.fillStyle = T(armor.trim);
    c.fillRect(-8, -7, 2, 5);
    c.fillRect(6, -7, 2, 5);
    c.fillStyle = T(armor.light);
    c.fillRect(-8, -7, 1, 3);
    c.fillRect(7, -7, 1, 3);
  }
  if (tier >= 3) {
    c.fillStyle = T('#101620');
    c.fillRect(-7, 1, 4, 2);
    c.fillStyle = T(armor.glow);
    c.fillRect(-6, 1, 2, 1);
    c.fillRect(3, -8, 2, 1);
  }
  if (tier >= 4) {
    c.fillStyle = T(armor.light);
    c.fillRect(-9, -4, 2, 4);
    c.fillRect(7, -4, 2, 4);
    c.fillStyle = T(armor.glow);
    c.fillRect(-9, -3, 1, 2);
    c.fillRect(8, -3, 1, 2);
  }

  chassisCache.set(key, canvas);
  return canvas;
}

export interface CubeDrawParams {
  x: number;
  y: number;
  facing: FacingDir;
  aimAngle: number;
  drillSpin: number;
  drillExtend: number;
  thrustPower: number;
  isDrilling: boolean;
  drillTier: number;
  armorTier: number;
  thrusterTier?: number;
  cargoFill: number;
  treadPhase: number;
  bob: number;
  squashX: number;
  squashY: number;
  time: number;
  invuln: boolean;
  tint?: string | null;
  godMode?: boolean;
  /** Seconds without input — drives look-around, breathing, sleep */
  idleTime?: number;
  /** 0..1 battle damage (cutscene crash) */
  damaged?: number;
  /** 0..1 power level (boot-up flicker) */
  power?: number;
  hideDrill?: boolean;
  /** Pristine Aether factory finish (no scrap patches) */
  pristine?: boolean;
  scale?: number;
  rotation?: number;
  eyeOverride?: { dx: number; dy: number } | null;
  emote?: 'happy' | 'surprised' | null;
  combo?: number;
  lowHull?: boolean;
  lowFuel?: boolean;
  cargoFull?: boolean;
  /** World-space collision floor. Visual squash/rotation may not cross it. */
  groundY?: number;
}

/** Computes the lowest transformed tread corner before choosing render height. */
export function cubeGroundPose(p: CubeDrawParams, sx: number, sy: number, angle: number, desiredY: number) {
  const scale = p.scale ?? 1;
  const floor = p.groundY;
  const sin = Math.sin(angle), cos = Math.cos(angle);
  // The track housing occupies x=-8..8, y=3..9 in the sprite.
  const treadMax = Math.max(
    -8 * sx * sin + 3 * sy * cos, 8 * sx * sin + 3 * sy * cos,
    -8 * sx * sin + 9 * sy * cos, 8 * sx * sin + 9 * sy * cos,
  ) * scale;
  // A supplied floor means supported, not merely collision-limited. The old
  // min() allowed wake jolts and breathing to lift the entire track off it.
  const y = floor === undefined ? desiredY : floor - treadMax;
  return { y, treadBottom: y + treadMax, floor, sx, sy, angle, scale };
}

export function drawCubeMiner(ctx: CanvasRenderingContext2D, p: CubeDrawParams) {
  if (p.invuln && Math.floor(p.time * 18) % 3 === 0) return;

  const armor = ARMOR_PALETTES[Math.max(0, Math.min(4, p.armorTier - 1))];
  const drill = DRILL_PALETTES[Math.max(0, Math.min(4, p.drillTier - 1))];
  const tint = p.tint || null;
  const T = (c: string) => tint || c;

  const idle = p.idleTime ?? 0;
  const idling = idle > 1.2 && !p.isDrilling && p.thrustPower < 0.1;
  const sleeping = idle > 9 && !p.lowHull;
  const idleAct = idling && !p.lowHull && !sleeping;
  const idleCycle = idle % 10;
  const dmg = p.damaged ?? 0;
  const power = p.power ?? 1;
  const powered = power > 0.05 && (power >= 1 || Math.sin(p.time * 31) > 1 - power * 2);

  // Breathing — the chassis gently expands while idle, slower when asleep.
  const hurt = !!p.lowHull && !p.godMode;
  const breathe = idling && !hurt ? Math.sin(p.time * (sleeping ? 1.25 : 2.4)) * (sleeping ? 0.05 : 0.028)
    + (idleAct ? Math.sin(p.time * 0.61) * 0.012 : 0) : 0;

  // ---- Low-hull idle: a repeating sleep / wake / DANGER cycle ----
  // Every ~8.4 s the damaged rig gives out, sleeps, then jolts awake with a
  // warning icon over it, and the cycle repeats. This is deliberately unlike
  // the healthy idle (which only breathes) so the state reads at a glance.
  //   0.0-3.4 s  struggling awake (limp, list, coughing, brown-out eyes)
  //   3.4-7.0 s  powered down: eyes shut, deep sag, antenna droops
  //   7.0-8.4 s  jolts awake: red alarm eyes, DANGER icon above, sparks
  const HURT_CYCLE = 8.4;
  // Active whenever hull is low and the rig is not drilling/flying, so the player
  // sees it the moment they stop rather than after the idle grace period.
  const stressed = hurt && !p.isDrilling && p.thrustPower < 0.1;
  const hurtPhase = stressed ? (idle % HURT_CYCLE) : 0;
  const hurtAsleep = stressed && hurtPhase > 3.4 && hurtPhase < 7.0;
  const hurtWaking = stressed && hurtPhase >= 7.0;
  const wakeT = hurtWaking ? (hurtPhase - 7.0) / (HURT_CYCLE - 7.0) : 0;
  const hurtCycle = stressed && !hurtAsleep ? (p.time % 2.6) : 0;
  const hurtHeave = stressed && !hurtAsleep
    ? (hurtCycle < 0.35 ? Math.sin((hurtCycle / 0.35) * Math.PI) : hurtCycle < 0.75 ? Math.sin(((hurtCycle - 0.4) / 0.35) * Math.PI) * 0.7 : 0)
    : 0;
  const hurtSquash = stressed ? hurtHeave * 0.08 - (hurtAsleep ? 0.075 : 0.035) : 0;
  const stutter = stressed && !hurtAsleep && Math.sin(p.time * 17) > 0.92 && Math.sin(p.time * 2.3) > 0.3 ? 1 : 0;
  const sag = stressed ? (hurtAsleep ? 4 : 2) : 0;
  // The jolt: a sharp 3-pixel lift right at the moment it wakes, then settles.
  const jolt = hurtWaking ? Math.round(Math.sin(Math.min(1, wakeT * 4) * Math.PI) * 3) : 0;

  const parentTransform = ctx.getTransform();
  ctx.save();
  // Micro-vibration while the drill bites into rock
  const vib = p.isDrilling ? Math.round(Math.sin(p.time * 62) * 1.2) : 0;
  const list = stressed ? -0.07 - hurtHeave * 0.02 - (hurtAsleep ? 0.05 : 0) : 0;
  // Healthy idle weight shift: a slow lean from one tread to the other, then back.
  const healthyList = idleAct && idleCycle > 5.5 && idleCycle < 7
    ? Math.sin(((idleCycle - 5.5) / 1.5) * Math.PI) * 0.035 : 0;
  const angle = (p.rotation ?? 0) + list + healthyList;
  const sx = p.squashX * (1 - breathe * 0.6 - hurtSquash * 0.7);
  const sy = p.squashY * (1 + breathe + hurtSquash);
  const desiredY = p.y + p.bob * 0.6 + (sleeping ? 1 : 0) + vib * 0.4 + sag + Math.round(hurtHeave * 1.5) - jolt;
  const contact = cubeGroundPose(p, sx, sy, angle, desiredY);
  // Keep the lowest tread corner above the real collision floor in every
  // breathing, shutdown, wake-jolt and landing-squash pose.
  ctx.translate(p.x + vib * 0.6 + stutter, contact.y);
  if (angle) ctx.rotate(angle);
  if (p.scale) ctx.scale(p.scale, p.scale);
  ctx.scale(sx, sy);
  const hullTransform = ctx.getTransform();
  // On low hull, suspension motion belongs to the body. Both tread soles stay
  // level on the ground while the shell leans, compresses and wakes above them.
  const plantedTracks = stressed && p.groundY !== undefined;
  const trackScale = p.scale ?? 1;
  const stableTrackMatrix = plantedTracks
    ? parentTransform.translate(p.x, p.groundY! - 9 * trackScale).scale(trackScale, trackScale)
    : null;

  /* ---- Low-hull sputter: weak coughs of exhaust from the back vent while idle ---- */
  if (stressed && !hurtAsleep && !tint) {
    const k = hurtCycle < 0.5 ? hurtCycle / 0.5 : -1; // one puff per breath cycle
    if (k >= 0) {
      const puffY = 7 + k * 6;
      const puffS = 1 + Math.round(k * 3);
      ctx.globalAlpha = (1 - k) * 0.55;
      ctx.fillStyle = '#9aa3a8';
      ctx.fillRect(-8 - Math.round(k * 2), puffY, puffS, puffS);
      ctx.fillStyle = '#c7ced2';
      ctx.fillRect(-8 - Math.round(k * 2), puffY, 1, 1);
      ctx.globalAlpha = 1;
      // a single ember when the cough starts
      if (k < 0.15) {
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(-7, 8, 1, 1);
      }
    }
  }

  /* ---- Healthy idle exhaust: soft periodic puffs; asleep it breathes slower ---- */
  if ((idleAct || sleeping) && !tint) {
    const period = sleeping ? 7 : 5;
    const k = (idle % period) / period;
    if (k < (sleeping ? 0.2 : 0.3)) {
      const q = k / (sleeping ? 0.2 : 0.3);
      ctx.globalAlpha = (1 - q) * (sleeping ? 0.14 : 0.24);
      ctx.fillStyle = '#9aa3a8';
      ctx.fillRect(-8 - Math.round(q * 2), 7 - Math.round(q * 3), 1 + Math.round(q * 2), 1 + Math.round(q * 2));
      ctx.fillStyle = '#c7ced2';
      ctx.fillRect(-8 - Math.round(q * 2), 7 - Math.round(q * 3), 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  /* ---- Jetpack flames (Distinct visuals per Thruster Tier!) ---- */
  if (p.thrustPower > 0.02) {
    const thrusterTier = p.thrusterTier || 1;
    const power2 = p.thrustPower;
    const flick = 0.72 + 0.28 * Math.sin(p.time * 46 + p.x * 0.1);
    const len = Math.round((4 + power2 * (7 + thrusterTier * 1.5)) * flick);

    ctx.globalCompositeOperation = 'lighter';
    for (const nx of [-6, 3]) {
      if (thrusterTier === 1) {
        // Steam Vent: Orange/Amber with smoke puff
        ctx.fillStyle = 'rgba(249,115,22,0.85)';
        ctx.fillRect(nx, 7, 3, len);
        ctx.fillStyle = 'rgba(253,224,71,0.9)';
        ctx.fillRect(nx + 1, 7, 1, Math.max(1, len - 2));
      } else if (thrusterTier === 2) {
        // Twin Nitro: High-octane Cyan/Blue with bright core
        ctx.fillStyle = 'rgba(3,105,161,0.85)';
        ctx.fillRect(nx, 7, 3, len);
        ctx.fillStyle = 'rgba(56,189,248,0.95)';
        ctx.fillRect(nx + 1, 7, 1, Math.max(1, len - 1));
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(nx + 1, 7, 1, Math.max(1, Math.floor(len * 0.5)));
      } else if (thrusterTier === 3) {
        // Sulfur Turbo Pack: Acidic Yellow-Lime with orange heat
        ctx.fillStyle = 'rgba(234,179,8,0.85)';
        ctx.fillRect(nx, 7, 3, len);
        ctx.fillStyle = 'rgba(217,249,38,0.95)';
        ctx.fillRect(nx + 1, 7, 1, Math.max(1, len - 1));
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(nx + 1, 7, 1, Math.max(1, Math.floor(len * 0.4)));
      } else if (thrusterTier === 4) {
        // Ion Levitator: Electric Violet & Plasma Cyan
        ctx.fillStyle = 'rgba(168,85,247,0.85)';
        ctx.fillRect(nx - 1, 7, 4, len);
        ctx.fillStyle = 'rgba(56,189,248,0.95)';
        ctx.fillRect(nx, 7, 2, Math.max(1, len - 2));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(nx, 7, 2, Math.max(1, Math.floor(len * 0.3)));
      } else {
        // Solar Core: Radiant Blinding White-Gold Coronal Flare!
        ctx.fillStyle = 'rgba(249,115,22,0.9)';
        ctx.fillRect(nx - 1, 7, 5, len + 2);
        ctx.fillStyle = 'rgba(253,224,71,0.95)';
        ctx.fillRect(nx, 7, 3, len);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(nx + 1, 7, 1, Math.max(2, Math.floor(len * 0.6)));
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = T('#08060e');
    ctx.fillRect(-7, 5, 5, 3);
    ctx.fillRect(2, 5, 5, 3);
    ctx.fillStyle = T(armor.trim);
    ctx.fillRect(-6, 6, 3, 1);
    ctx.fillRect(3, 6, 3, 1);
  }

  /* ---- Treads & 3-Bogie Suspension ---- */
  if (stableTrackMatrix) ctx.setTransform(stableTrackMatrix);
  // Hydraulic suspension struts connecting hull to tread frame
  ctx.fillStyle = T('#475569');
  ctx.fillRect(-5, 2, 2, 2);
  ctx.fillRect(3, 2, 2, 2);
  ctx.fillStyle = T('#cbd5e1');
  ctx.fillRect(-4, 2, 1, 2);
  ctx.fillRect(4, 2, 1, 2);

  // Armored mudguard & track housing
  ctx.fillStyle = T('#08060e');
  ctx.fillRect(-8, 3, 16, 6);
  ctx.fillStyle = T('#22262f');
  ctx.fillRect(-7, 4, 14, 4);
  ctx.fillStyle = T('#59606e');
  ctx.fillRect(-7, 3, 14, 1);

  const cleatOff = ((p.treadPhase % 3) + 3) % 3;
  ctx.fillStyle = T('#7c8599');
  for (let tx = -7 + cleatOff; tx < 7; tx += 3) {
    if (tx >= -7 && tx <= 5) ctx.fillRect(Math.round(tx), 4, 1, 4);
  }
  ctx.fillStyle = T('#3a4152');
  ctx.fillRect(-7, 7, 14, 1);

  // 3 bogie road wheels with rotating hub spokes
  for (const wx of [-5, 0, 4]) {
    ctx.fillStyle = T('#08060e');
    ctx.fillRect(wx - 1, 4, 4, 4);
    ctx.fillStyle = T('#94a3b8');
    ctx.fillRect(wx, 5, 2, 2);
    const spoke = ((Math.floor(p.treadPhase * 1.5 + wx) % 4) + 4) % 4;
    ctx.fillStyle = T('#1e293b');
    ctx.fillRect(wx + (spoke === 0 || spoke === 3 ? 1 : 0), 5 + (spoke >= 2 ? 1 : 0), 1, 1);
  }
  // Broken tread segment
  if (dmg > 0.4 && !tint) {
    ctx.fillStyle = '#08060e';
    ctx.fillRect(1, 4, 3, 2);
  }
  if (stableTrackMatrix) ctx.setTransform(hullTransform);

  /* ---- Cached armor chassis; animated loose wire remains live ---- */
  ctx.drawImage(chassisSprite(p.armorTier, Boolean(p.pristine), tint), -9, -10);
  if (!tint && !p.pristine && p.armorTier === 1) {
    const sway = Math.round(Math.sin(p.time * 3.1) * 1.2);
    ctx.fillStyle = '#08060e';
    ctx.fillRect(-9, -3, 1, 2);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-9, -1, 1, 1);
    ctx.fillRect(-9 + sway, 0, 1, 1);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-9 + sway, 1, 1, 1);
  }

  /* ---- Crash damage (cutscene) ---- */
  if (dmg > 0 && !tint) {
    ctx.fillStyle = '#08060e';
    ctx.fillRect(-4, -6, 2, 1);
    ctx.fillRect(3, 1, 2, 1);
    if (dmg > 0.5) {
      // Torn panel exposing wires
      ctx.fillStyle = '#1a1210';
      ctx.fillRect(-6, -1, 4, 3);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-5, 0, 1, 1);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-4, 1, 1, 1);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-3, 0, 1, 1);
    }
  }

  /* ---- Cargo hopper window ---- */
  if (!(dmg > 0.5)) {
    const fillRows = Math.round(p.cargoFill * 4);
    ctx.fillStyle = T('#0b0d14');
    ctx.fillRect(-6, -1, 5, 5);
    if (fillRows > 0) {
      ctx.fillStyle = T('#e6b42c');
      ctx.fillRect(-6, 4 - fillRows, 5, fillRows);
      ctx.fillStyle = T('#fff0a8');
      ctx.fillRect(-6, 4 - fillRows, 5, 1);
    }
    ctx.fillStyle = T(armor.trim);
    ctx.fillRect(-6, -1, 5, 1);
  }

  /* ---- Helmet + headlamp ---- */
  ctx.fillStyle = T('#08060e');
  ctx.fillRect(-5, -11, 10, 3);
  ctx.fillStyle = T(armor.trim);
  ctx.fillRect(-4, -10, 8, 2);

  // Eye / look direction
  let eyeDx = 0;
  let eyeDy = 0;
  if (p.facing === 'right') eyeDx = 1;
  if (p.facing === 'left') eyeDx = -1;
  if (p.facing === 'down') eyeDy = 1;
  if (p.facing === 'up') eyeDy = -1;
  if (idling && !sleeping) {
    // Curious look-around cycle
    eyeDx = Math.max(-1, Math.min(1, Math.round(Math.sin(idle * 0.9) * 1.4)));
    eyeDy = Math.sin(idle * 0.53) > 0.75 ? -1 : 0;
    if (!hurt) {
      // Healthier rigs get distinct glances and tiny saccades, not a metronome sweep.
      const c = idle % 8;
      eyeDx = c < 1.8 ? Math.round(Math.sin(idle * 1.1))
        : c < 2.1 ? -1
        : c < 4.6 ? Math.max(-1, Math.min(1, Math.round(Math.sin(idle * 0.7) * 1.4)))
        : c < 4.9 ? 1 : Math.round(Math.sin(idle * 0.5) * 0.8);
      eyeDy = c > 2.6 && c < 3.4 ? -1 : c > 6.2 && c < 6.8 ? 1 : 0;
    }
  }
  if (p.eyeOverride) {
    eyeDx = p.eyeOverride.dx;
    eyeDy = p.eyeOverride.dy;
  }

  const lampX = eyeDx < 0 ? -4 : eyeDx > 0 ? 2 : -1;
  ctx.fillStyle = T('#08060e');
  ctx.fillRect(lampX - 1, -11, 4, 3);
  ctx.fillStyle = T(powered && !sleeping ? '#fff3b0' : '#5c5340');
  ctx.fillRect(lampX, -10, 2, 2);

  // Side thermal radiator vent (glows hot during drilling or combo frenzy)
  if (!tint && (p.isDrilling || (p.combo && p.combo >= 3))) {
    ctx.fillStyle = p.combo && p.combo >= 5 ? '#fde047' : '#f97316';
    ctx.fillRect(-7, -5, 1, 2);
  }

  // Antenna — rigidly mounted to helmet boss at x=3, y=-11 with connected 2-segment whip
  const sway = Math.max(
    -1,
    Math.min(1, Math.round(Math.sin(p.time * (idling ? 1.7 : 4.5) + 0.5 + (idleAct ? Math.sin(p.time * 0.37) * 0.4 : 0)) * (idling ? 1.1 : 0.45)))
  );
  // Base collar fused into the helmet
  ctx.fillStyle = T('#08060e');
  ctx.fillRect(2, -12, 3, 2);
  ctx.fillRect(3, -14, 2, 3);
  ctx.fillRect(3 + sway, -15, 2, 2);
  ctx.fillStyle = T('#94a3b8');
  ctx.fillRect(3, -13, 1, 2);
  ctx.fillRect(3 + sway, -14, 1, 1);
  const beaconRate = sleeping ? 0.6 : 2.4;
  const beaconOn = powered && Math.floor(p.time * beaconRate) % 2 === 0;
  ctx.fillStyle = T('#08060e');
  ctx.fillRect(2 + sway, -17, 4, 3);
  ctx.fillStyle = T(beaconOn ? (sleeping ? '#818cf8' : '#ff5470') : '#4a1f2a');
  ctx.fillRect(3 + sway, -16, 2, 1);

  /* ---- Visor with Responsive Facial Reactions ---- */
  ctx.fillStyle = T('#08060e');
  ctx.fillRect(0, -7, 8, 5);
  ctx.fillStyle = T('#111a2b');
  ctx.fillRect(1, -6, 6, 3);
  if (!tint) {
    ctx.fillStyle = 'rgba(120,190,255,0.28)';
    ctx.fillRect(1, -6, 6, 1);
  }

  if (powered) {
    const blink = !sleeping && (p.time % 3.6 < 0.11 || (p.time % 9 > 5.1 && p.time % 9 < 5.23));
    let eyeColor = tint || (p.godMode ? '#fde047' : p.isDrilling ? '#ffd23f' : '#5cc9ff');
    if (p.combo && p.combo >= 5) eyeColor = '#ff6b2b'; // Blazing fire eyes during combo frenzy!
    if (p.cargoFull) eyeColor = '#fde047'; // Gold eyes on full cargo

    ctx.fillStyle = eyeColor;
    if (sleeping) {
      // Closed eyes: flat dim lines
      ctx.globalAlpha = 0.6;
      ctx.fillRect(2, -4, 2, 1);
      ctx.fillRect(5, -4, 2, 1);
      ctx.globalAlpha = 1;
    } else if (stressed && hurtAsleep) {
      // Powered down: eyes shut and dark.
      ctx.fillStyle = '#1b2a33';
      ctx.fillRect(2 + eyeDx, -4, 2, 1);
      ctx.fillRect(5 + eyeDx, -4, 1, 1);
    } else if (stressed && hurtWaking) {
      // Jolted awake: hard red alarm eyes for the whole wake window.
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(2 + eyeDx, -6, 2, 3);
      ctx.fillRect(5 + eyeDx, -6, 2, 3);
      ctx.fillStyle = '#ffd0cc';
      ctx.fillRect(2 + eyeDx, -6, 1, 1);
      ctx.fillRect(5 + eyeDx, -6, 1, 1);
    } else if (stressed && hurtCycle > 1.7 && hurtCycle < 2.1) {
      // Alarmed exclamation, shown once per laboured-breath cycle
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(3, -6, 2, 2);
      ctx.fillRect(3, -3, 2, 1);
    } else if (stressed) {
      // Brown-out eyes: half-lidded, dim, flickering with the power stutter
      const flick = stutter ? 0.25 : 0.55 + 0.2 * Math.sin(p.time * 9);
      ctx.globalAlpha = flick;
      ctx.fillStyle = '#4fb0e0';
      ctx.fillRect(2 + eyeDx, -4, 2, 1);
      ctx.fillRect(5 + eyeDx, -4, 1, 1);
      ctx.globalAlpha = 1;
    } else if (p.emote === 'happy') {
      // ^ ^
      ctx.fillRect(2, -4, 1, 1);
      ctx.fillRect(3, -5, 1, 1);
      ctx.fillRect(5, -4, 1, 1);
      ctx.fillRect(6, -5, 1, 1);
    } else if (p.emote === 'surprised') {
      ctx.fillRect(2 + eyeDx, -6, 2, 3);
      ctx.fillRect(5 + eyeDx, -6, 2, 3);
    } else if (p.combo && p.combo >= 5) {
      // Star / Flame eye shape during combo frenzy!
      ctx.fillRect(2 + eyeDx, -6, 2, 3);
      ctx.fillRect(1 + eyeDx, -5, 4, 1);
      ctx.fillRect(5 + eyeDx, -6, 2, 3);
      ctx.fillRect(4 + eyeDx, -5, 3, 1);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(2 + eyeDx, -5, 1, 1);
      ctx.fillRect(5 + eyeDx, -5, 1, 1);
    } else {
      const h = blink ? 1 : 2;
      const ey = -5 + eyeDy + (blink ? 1 : 0);
      ctx.fillRect(2 + eyeDx, ey, 2, h);
      const rightDead = dmg > 0.5 && Math.sin(p.time * 23) < 0.6;
      if (!rightDead) ctx.fillRect(5 + eyeDx, ey, 1, h);
      if (!tint && !blink) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(2 + eyeDx, ey, 1, 1);
      }
    }

    // Idle visor scan sweep
    if (idling && !sleeping && !tint) {
      const cyc = idle % 5;
      if (cyc < 0.6) {
        const gx = 1 + Math.floor((cyc / 0.6) * 6);
        ctx.fillStyle = 'rgba(180,240,255,0.55)';
        ctx.fillRect(gx, -6, 1, 3);
      }
    }
  }

  // ---- DANGER icon while the rig jolts awake from a low-hull shutdown ----
  if (stressed && hurtWaking && !tint) {
    const pulse = 0.7 + 0.3 * Math.sin(p.time * 14);
    const iy = -25;
    ctx.globalAlpha = Math.min(1, wakeT * 3) * (1 - Math.max(0, wakeT - 0.8) * 5);
    // warning triangle
    ctx.fillStyle = '#08060e';
    ctx.beginPath();
    ctx.moveTo(-7, iy + 7); ctx.lineTo(0, iy - 5); ctx.lineTo(7, iy + 7); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-5.5, iy + 6); ctx.lineTo(0, iy - 3); ctx.lineTo(5.5, iy + 6); ctx.closePath();
    ctx.fill();
    // exclamation mark
    ctx.fillStyle = '#08060e';
    ctx.fillRect(-1, iy, 2, 4);
    ctx.fillRect(-1, iy + 5, 2, 1);
    ctx.globalAlpha = 1;
    // Halo follows the triangle instead of covering it with a square light box.
    if (pulse > 0.85) {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-9, iy + 8); ctx.lineTo(0, iy - 7); ctx.lineTo(9, iy + 8); ctx.closePath();
      ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // Low hull: short-circuit sparks from the damaged side panel on each shudder
  if (stressed && !tint && hurtHeave > 0.85) {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = -0.6 - i * 0.5 + Math.sin(p.time * 40 + i) * 0.3;
      const r = 2 + ((p.time * 50 + i * 3) % 4);
      ctx.fillStyle = i % 2 ? '#fde047' : '#ffffff';
      ctx.fillRect(Math.round(-7 + Math.cos(a) * r), Math.round(0 + Math.sin(a) * r), 1, 1);
    }
  }
  // Cracked visor
  if (dmg > 0.3 && !tint) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(5, -6, 1, 1);
    ctx.fillRect(6, -5, 1, 1);
    ctx.fillRect(5, -4, 1, 1);
  }

  /* ---- Articulated drill arm ---- */
  if (!p.hideDrill) {
    ctx.save();
    // Low hull: the drill arm hangs limp toward the ground, twitching with each shudder.
    const droop = stressed ? 0.55 + hurtHeave * 0.08 : 0;
    let aim = stressed ? p.aimAngle * (1 - droop) + (Math.PI / 2 - 0.35) * droop : p.aimAngle;
    if (p.groundY !== undefined && !p.isDrilling && p.thrustPower < 0.1) {
      // A resting auger can droop, but cannot stab through the floor. Retain
      // upward aiming and the chosen left/right facing while limiting down-tilt.
      const local = Math.atan2(Math.sin(aim), Math.abs(Math.cos(aim)));
      const safe = Math.min(local, stressed ? 0.18 + hurtHeave * 0.025 : 0.2);
      aim = Math.cos(aim) < 0 ? Math.PI - safe : safe;
    }
    const cos = Math.cos(aim);
    const sin = Math.sin(aim);
    const mount = 6 + p.drillExtend * 2.5;
    ctx.translate(Math.round(cos * mount), Math.round(sin * mount));
    ctx.rotate(aim);

    ctx.fillStyle = T('#08060e');
    ctx.fillRect(-4, -4, 6, 8);
    ctx.fillStyle = T('#5a6473');
    ctx.fillRect(-3, -3, 4, 6);
    ctx.fillStyle = T('#8f9aab');
    ctx.fillRect(-3, -3, 4, 2);

    const pistonLen = 3 + Math.round(p.drillExtend * 3);
    ctx.fillStyle = T('#08060e');
    ctx.fillRect(1, -2, pistonLen + 1, 4);
    ctx.fillStyle = T('#c3ccd9');
    ctx.fillRect(2, -1, pistonLen - 1, 2);

    ctx.fillStyle = T('#08060e');
    ctx.fillRect(pistonLen, -4, 5, 8);
    ctx.fillStyle = T(drill.dark);
    ctx.fillRect(pistonLen + 1, -3, 3, 6);
    ctx.fillStyle = T(drill.main);
    ctx.fillRect(pistonLen + 1, -3, 3, 3);

    const drillTier = p.drillTier || 1;
    const bitBase = pistonLen + 5;
    // Drill bit length scales from 8px up to 12px for Tier 5!
    const bitLen = 7 + drillTier;

    ctx.fillStyle = T('#08060e');
    ctx.fillRect(bitBase - 1, -4, 2, 8);

    // Render tier-specific geometry
    for (let i = 0; i < bitLen; i++) {
      const t = i / bitLen;
      const halfH = Math.max(1, Math.round((3.2 + drillTier * 0.25) * (1 - t * 0.82)));
      const bx = bitBase + i;
      ctx.fillStyle = T('#08060e');
      ctx.fillRect(bx, -halfH - 1, 1, halfH * 2 + 2);
      ctx.fillStyle = T(i % 2 === 0 ? drill.main : drill.dark);
      ctx.fillRect(bx, -halfH, 1, halfH * 2);
    }

    // High tier special details
    if (drillTier >= 2 && !tint) {
      // Carbide Bore neon ring collar
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(bitBase, -4, 1, 8);
    }
    if (drillTier >= 3 && !tint) {
      // Brimstone Cutter fiery serrations
      ctx.fillStyle = '#f97316';
      ctx.fillRect(bitBase + 2, -5, 2, 1);
      ctx.fillRect(bitBase + 2, 4, 2, 1);
      ctx.fillRect(bitBase + 5, -4, 2, 1);
      ctx.fillRect(bitBase + 5, 3, 2, 1);
    }
    if (drillTier >= 4 && !tint) {
      // Plasma Core Drill energy emitter ring
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(bitBase + 4, -4, 1, 8);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(bitBase + 6, -3, 1, 6);
    }
    if (drillTier >= 5 && !tint) {
      // Solar Annihilator corona flare fins
      ctx.fillStyle = '#fde047';
      ctx.fillRect(bitBase + 1, -6, 2, 1);
      ctx.fillRect(bitBase + 1, 5, 2, 1);
      ctx.fillRect(bitBase + 4, -5, 2, 1);
      ctx.fillRect(bitBase + 4, 4, 2, 1);
      ctx.fillRect(bitBase + 7, -4, 2, 1);
      ctx.fillRect(bitBase + 7, 3, 2, 1);
    }

    if (!tint) {
      for (let k = 0; k < 4; k++) {
        const t = (((p.drillSpin + k / 4) % 1) + 1) % 1;
        const fx = Math.round(bitBase + t * (bitLen - 1));
        const halfH = Math.max(1, Math.round(3.4 * (1 - t * 0.82)));
        ctx.fillStyle = drill.light;
        ctx.fillRect(fx, -halfH, 1, Math.max(1, Math.round(halfH * 0.9)));
        ctx.fillStyle = drill.hot;
        ctx.fillRect(fx, halfH - 1, 1, 1);
      }
    }

    if (p.isDrilling && !tint) {
      const pulse = 0.7 + 0.3 * Math.sin(p.time * 24);
      ctx.globalCompositeOperation = 'lighter';
      if (drillTier <= 2) {
        ctx.fillStyle = `rgba(255,240,190,${pulse})`;
        ctx.fillRect(bitBase + bitLen - 1, -1, 2, 2);
        ctx.fillStyle = 'rgba(255,170,70,0.5)';
        ctx.fillRect(bitBase + bitLen - 3, -3, 5, 6);
      } else if (drillTier === 3) {
        ctx.fillStyle = `rgba(255,120,40,${pulse})`;
        ctx.fillRect(bitBase + bitLen - 1, -2, 3, 4);
        ctx.fillStyle = 'rgba(254,240,138,0.7)';
        ctx.fillRect(bitBase + bitLen - 2, -1, 3, 2);
      } else if (drillTier === 4) {
        // Plasma arc glow
        ctx.fillStyle = `rgba(192,132,252,${pulse})`;
        ctx.fillRect(bitBase + bitLen - 1, -3, 4, 6);
        ctx.fillStyle = 'rgba(56,189,248,0.85)';
        ctx.fillRect(bitBase + bitLen - 1, -1, 3, 2);
      } else {
        // Solar Annihilator radiant coronal burst
        ctx.fillStyle = `rgba(253,224,71,${pulse})`;
        ctx.fillRect(bitBase + bitLen - 2, -4, 6, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bitBase + bitLen - 1, -2, 4, 4);
      }
      ctx.fillStyle = 'rgba(255,120,40,0.18)';
      ctx.fillRect(bitBase + bitLen - 8, -6, 12, 12);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  ctx.restore();
}

/* ================================================================== *
 *  Outpost NPC state
 * ================================================================== */
export interface Npc {
  id: Exclude<SpeakerId, 'cube'>;
  x: number;
  homeX: number;
  range: number;
  targetX: number;
  walkPhase: number;
  facing: 1 | -1;
  wait: number;
  bubble: string | null;
  bubbleTimer: number;
  waveTimer: number;
  greetCooldown: number;
}

export function createNpcs(tile: number): Npc[] {
  const make = (id: Npc['id'], homeTile: number, range: number): Npc => ({
    id,
    x: homeTile * tile,
    homeX: homeTile * tile,
    range,
    targetX: homeTile * tile,
    walkPhase: 0,
    facing: 1,
    wait: Math.random() * 2,
    bubble: null,
    bubbleTimer: 0,
    waveTimer: 0,
    greetCooldown: 2 + Math.random() * 3,
  });
  return [make('mara', 17.5, 28), make('pip', 23.5, 44), make('gus', 44, 32), make('ilse', 54, 18)];
}
