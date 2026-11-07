import { CHARACTERS, type HumanLook } from './characters';
import {
  CH,
  CW,
  INK,
  R,
  birds,
  clamp,
  ease,
  easeInOut,
  glowAt,
  hash,
  heroHuman,
  heroRobot,
  lightShaft,
  rgba,
  shade,
  skyCanvas,
  smokeAt,
  sparksAt,
} from './cutsceneArt';
import {
  cloudLayer,
  drawSetAt,
  filmLighting,
  getSet,
  getShaftWall,
  motes,
  type SetName,
} from './cinematicSets';

export const CS_W = CW;
export const CS_H = CH;

export interface CutsceneScene {
  id: string;
  chapter: string;
  duration: number;
  text: string;
  speaker?: 'mara' | 'cube';
  set: SetName | null;
  sfx?: 'whoosh' | 'impact' | 'boot' | 'weld' | 'cheer' | 'wind';
  draw: (ctx: CanvasRenderingContext2D, t: number, duration: number) => void;
}

const human = (id: 'mara' | 'gus' | 'ilse' | 'pip'): HumanLook => CHARACTERS[id].look!;

function sign(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 7) {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0b0910';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, fraction: number, color: string) {
  R(ctx, x, y, width, 7, INK);
  R(ctx, x + 2, y + 2, width - 4, 3, '#272338');
  R(ctx, x + 2, y + 2, (width - 4) * clamp(fraction), 3, color);
  for (let tick = x + 13; tick < x + width - 3; tick += 14) R(ctx, tick, y + 2, 1, 3, '#161220');
}

const FEET = 15;
const stand = (surface: number, scale: number) => surface - FEET * scale;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function camera(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, draw: () => void) {
  ctx.save();
  ctx.translate(CW / 2 + x, CH / 2 + y);
  ctx.scale(zoom, zoom);
  ctx.translate(-CW / 2, -CH / 2);
  draw();
  ctx.restore();
}

/**
 * Atmospheric re-entry meteor renderer (Scenes 5 & 6):
 * Draws a supersonic plasma bow-shock wave ahead of the falling robot,
 * roaring re-entry fire wake, ablating paint flakes, and transitions
 * `paintMix` from white Aether ceramic (0) to scorched brown (1).
 */
function reentryMeteor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  scale: number,
  damage: number,
  paintMix: number,
  heatIntensity = 1
) {
  // Trailing plasma & fire wake streaking upward behind the falling unit
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const age = i / 16;
    const w = (18 + age * 22) * heatIntensity;
    const wob = Math.sin(t * 20 + i * 0.9) * (3 + age * 5);
    R(ctx, x - w / 2 + wob, y - 22 - age * 115, w, 10, rgba('#ff6b1a', (1 - age) * 0.45 * heatIntensity));
    R(ctx, x - w * 0.28 + wob * 0.5, y - 24 - age * 105, w * 0.56, 8, rgba('#fde047', (1 - age) * 0.42 * heatIntensity));
    if (i < 6) {
      R(ctx, x - 4 + wob * 0.3, y - 20 - age * 70, 8, 7, rgba('#e0f2fe', (1 - age * 2) * 0.5 * heatIntensity));
    }
  }
  ctx.restore();

  glowAt(ctx, x, y + 6, 72 * heatIntensity, '#ff7b24', 0.48 * heatIntensity);

  // Tumbling robot hull (transitions from white to brown via paintMix)
  heroRobot(ctx, {
    x,
    y,
    s: scale,
    t,
    state: 'falling',
    rot: t * 3.2,
    eye: 'surprised',
    damage,
    paintMix,
    drill: false,
  });

  // Supersonic bow-shock compression wave in front of (below) the falling hull
  if (heatIntensity > 0.2) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const shockY = y + scale * 11;
    // Outer orange-gold plasma crescent
    ctx.strokeStyle = rgba('#fb923c', 0.72 * heatIntensity);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, shockY - 12, scale * 11.5, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
    // Inner white-cyan superheated shock front
    ctx.strokeStyle = rgba('#e0f2fe', 0.88 * heatIntensity);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, shockY - 12, scale * 10.2, 0.23 * Math.PI, 0.77 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Detailed 2245 Aether Aero-Drone sprite (Scene 3).
 */
function drawAeroDrone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: 1 | -1,
  t: number,
  scale = 1,
  inspector = false
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(dir * scale, scale);

  // Ion contrail
  for (let k = 1; k <= 6; k++) {
    R(ctx, -12 - k * 7, -1, 5, 2, rgba('#38bdf8', 0.42 / k));
  }
  // Twin vector-thruster nacelles
  R(ctx, -14, -5, 8, 3, INK);
  R(ctx, -13, -4, 6, 2, '#64748b');
  R(ctx, -15, -4, 2, 2, '#38bdf8');

  // Sleek aerodynamic white fuselage
  R(ctx, -11, -3, 22, 6, INK);
  R(ctx, -10, -2, 20, 4, '#f8fafc');
  R(ctx, -10, -2, 20, 1, '#ffffff');
  R(ctx, -9, 1, 18, 1, '#94a3b8');
  // Cyan Aether trim & forward sensor canopy
  R(ctx, -4, -1, 10, 2, '#38bdf8');
  R(ctx, 5, -2, 5, 3, '#0f172a');
  R(ctx, 6, -1, 3, 2, inspector ? '#ef4444' : '#22d3ee');

  // Under-slung glowing anti-grav ring
  const pulse = 0.65 + 0.35 * Math.sin(t * 14);
  R(ctx, -6, 3, 12, 2, INK);
  R(ctx, -5, 3, 10, 1, inspector ? '#f87171' : '#38bdf8');
  glowAt(ctx, 0, 3, 10, inspector ? '#ef4444' : '#38bdf8', 0.35 * pulse);

  ctx.restore();
}

/**
 * Heavy tracked Reclamation Bulldozer / Sweeper Mech (Scene 4).
 * Drives on the deck out of the hangar bay doorway and pushes CUBE-07 with a hydraulic blade.
 */
function drawBulldozerMech(
  ctx: CanvasRenderingContext2D,
  frontBladeX: number,
  deckY: number,
  t: number,
  moving: boolean
) {
  ctx.save();
  ctx.translate(Math.round(frontBladeX), Math.round(deckY));
  ctx.scale(1.42, 1.42);
  const bx = -78;
  const localDeckY = 0;
  const wheelPhase = moving ? t * 10 : 0;

  // Heavy tracked undercarriage (sits flush on localDeckY = 0)
  R(ctx, bx, localDeckY - 16, 58, 16, INK);
  R(ctx, bx + 2, localDeckY - 14, 54, 12, '#1e293b');
  R(ctx, bx + 2, localDeckY - 15, 54, 2, '#64748b');
  // Animated track cleats
  const cleatOff = Math.floor(wheelPhase * 3) % 6;
  for (let tx = bx + 3 + cleatOff; tx < bx + 54; tx += 6) {
    R(ctx, tx, localDeckY - 14, 3, 2, '#94a3b8');
    R(ctx, tx, localDeckY - 3, 3, 2, '#94a3b8');
  }
  // 4 armored bogie road wheels
  for (let w = 0; w < 4; w++) {
    const wx = bx + 6 + w * 13;
    R(ctx, wx, localDeckY - 12, 9, 9, INK);
    R(ctx, wx + 1, localDeckY - 11, 7, 7, '#64748b');
    R(ctx, wx + 3, localDeckY - 9, 3, 3, '#1e293b');
    const sp = Math.floor(wheelPhase * 2 + w) % 4;
    R(ctx, wx + 2 + (sp % 2) * 3, localDeckY - 10 + (sp >= 2 ? 3 : 0), 2, 2, '#e2e8f0');
  }

  // Armored industrial hull & cab
  R(ctx, bx + 4, localDeckY - 46, 48, 31, INK);
  R(ctx, bx + 6, localDeckY - 44, 44, 28, '#334155');
  R(ctx, bx + 6, localDeckY - 44, 44, 4, '#94a3b8');
  R(ctx, bx + 6, localDeckY - 22, 44, 6, '#1e293b');
  for (let hx = bx + 8; hx < bx + 48; hx += 8) {
    R(ctx, hx, localDeckY - 26, 4, 3, '#eab308');
  }
  // Armored slit visor & sensor eye
  R(ctx, bx + 34, localDeckY - 39, 14, 7, INK);
  R(ctx, bx + 36, localDeckY - 37, 10, 3, '#090d16');
  R(ctx, bx + 41, localDeckY - 37, 4, 3, '#ef4444');

  // Exhaust stack & rotating amber warning strobe on roof
  R(ctx, bx + 12, localDeckY - 56, 6, 10, INK);
  R(ctx, bx + 13, localDeckY - 55, 4, 9, '#475569');
  if (moving) smokeAt(ctx, bx + 15, localDeckY - 58, t, 31, '#94a3b8', 4, 24);

  const strobeOn = Math.floor(t * 8) % 2 === 0;
  R(ctx, bx + 28, localDeckY - 52, 8, 6, INK);
  R(ctx, bx + 30, localDeckY - 51, 4, 4, strobeOn ? '#f59e0b' : '#78350f');
  if (strobeOn) glowAt(ctx, bx + 32, localDeckY - 49, 14, '#f59e0b', 0.35);

  // Dual heavy hydraulic ram pistons connecting hull to front plow blade
  R(ctx, bx + 52, localDeckY - 38, 18, 6, INK);
  R(ctx, bx + 52, localDeckY - 36, 16, 3, '#cbd5e1');
  R(ctx, bx + 52, localDeckY - 22, 18, 6, INK);
  R(ctx, bx + 52, localDeckY - 20, 16, 3, '#cbd5e1');

  // Heavy curved bulldozer plow blade with red impact bumper at x = -10..0
  const px = -10;
  R(ctx, px, localDeckY - 48, 10, 46, INK);
  R(ctx, px + 2, localDeckY - 46, 6, 42, '#475569');
  R(ctx, px + 2, localDeckY - 46, 3, 42, '#94a3b8');
  for (let hy = localDeckY - 44; hy < localDeckY - 8; hy += 8) {
    R(ctx, px + 4, hy, 4, 4, '#eab308');
  }
  R(ctx, px + 8, localDeckY - 42, 3, 36, '#ef4444');
  ctx.restore();
}

function workerSilhouette(ctx: CanvasRenderingContext2D, x: number, ground: number, seed: number, t: number) {
  const coat = ['#79695f', '#637482', '#735b61', '#697259'][seed % 4];
  const bob = Math.sin(t * 2 + seed) > 0.7 ? -1 : 0;
  R(ctx, x - 3, ground - 18 + bob, 6, 7, '#332b34');
  R(ctx, x - 2, ground - 17 + bob, 4, 6, '#b08a74');
  R(ctx, x - 3, ground - 20 + bob, 6, 2, '#524650');
  R(ctx, x - 4, ground - 11 + bob, 8, 9, coat);
  R(ctx, x - 3, ground - 3, 2, 3, '#332d37');
  R(ctx, x + 1, ground - 3, 2, 3, '#332d37');
  if (seed % 3 === 0) R(ctx, x + 3, ground - 9 + bob, 3, 4, '#aa8971');
}

export const CUTSCENE: CutsceneScene[] = [
  /* ================================================================ *
   *  01. SKY CITY — AETHER 2200
   * ================================================================ */
  {
    id: 'sky-city',
    chapter: '01 / ABOVE THE EARTH',
    set: 'aether',
    duration: 6.5,
    text: 'Above a poisoned Earth, Aether survived on islands of stone and light.',
    sfx: 'wind',
    draw(ctx, t, duration) {
      const move = easeInOut(t / duration);
      drawSetAt(ctx, 'aether', 13 + move * 63);

      // Volumetric golden-hour sunrays & anti-gravity core glow beneath the floating city
      glowAt(ctx, 495, 174, 155, '#ffd996', 0.22);
      lightShaft(ctx, 450, 40, 48, 240, '#ffe3a8', 0.08);
      lightShaft(ctx, 350, 50, 36, 230, '#bae6fd', 0.06);
      glowAt(ctx, 395 - move * 63, 272, 74, '#38bdf8', 0.22 + 0.06 * Math.sin(t * 3));

      cloudLayer(ctx, t, 74, 6);

      // Sleek Aether sky-cruisers with glowing ion contrails
      drawAeroDrone(ctx, -60 + t * 68, 118, 1, t, 1.35);
      drawAeroDrone(ctx, 680 - t * 52, 88, -1, t + 2, 1.0);

      birds(ctx, t, 64, '#312e48', 6);
      cloudLayer(ctx, t, 272, -12, true);
      motes(ctx, t, 34, '#fff1d6', 35, 270);
      filmLighting(ctx, '#151124', 0.44);
    },
  },

  /* ================================================================ *
   *  02. FOUNDRY 2200 — WHITE AETHER UNIT CUBE-07
   * ================================================================ */
  {
    id: 'birth',
    chapter: '02 / FOUNDRY 2200',
    set: 'foundry',
    duration: 6.8,
    text: 'In the Foundry, a mining unit came online. Production number: CUBE-07.',
    sfx: 'boot',
    draw(ctx, t, duration) {
      camera(ctx, 8 - t * 1.5, 0, 1 + ease(t / duration) * 0.035, () => {
        drawSetAt(ctx, 'foundry', 24);
        const conveyor = (t * 24) % 18;
        for (let x = 0; x < CW + 18; x += 18) R(ctx, x - conveyor, 281, 9, 3, '#9faebc');

        // Background conveyor of white Aether cube chassis shells
        for (let i = 0; i < 4; i++) {
          const cx = ((i * 170 + t * 24) % 720) - 40;
          if (Math.abs(cx - 324) < 95) continue;
          heroRobot(ctx, {
            x: cx,
            y: stand(272, 2.2),
            s: 2.2,
            t,
            state: 'sleep',
            power: 0,
            eye: 'closed',
            drill: false,
            paintMix: 0, // White Aether factory coat
          });
        }

        // Dual articulated clean-room laser calibration arms
        const arm = Math.sin(t * 1.9) * 0.2;
        ctx.save();
        ctx.translate(416, 52);
        ctx.rotate(arm);
        R(ctx, -5, -3, 10, 114, '#0f172a');
        R(ctx, -3, -2, 5, 111, '#cbd5e1');
        R(ctx, -10, 108, 20, 10, '#38bdf8');
        R(ctx, -6, 116, 4, 15, '#475569');
        R(ctx, 2, 116, 4, 15, '#475569');
        ctx.restore();

        const power = ease((t - 1.15) / 2.0);
        const lift = ease((t - 0.3) / 2.4);
        const deckY = 292 - lift * 24;
        R(ctx, 239, deckY, 170, 9, '#0f172a');
        R(ctx, 242, deckY + 1, 164, 4, '#e2e8f0');
        R(ctx, 246, deckY + 9, 156, 4, '#38bdf8');

        // CUBE-07 in brand-new pristine WHITE Aether ceramic-titanium plating (`paintMix: 0`)!
        heroRobot(ctx, {
          x: 324,
          y: stand(deckY, 4.8),
          s: 4.8,
          t,
          state: power < 0.8 ? 'boot' : t > 5.0 ? 'happy' : 'idle',
          drill: false,
          power: power < 0.08 ? 0.05 : power,
          eye: power < 0.65 ? 'scan' : t > 5.2 ? 'happy' : 'normal',
          look: t > 4.2 ? 1 : 0,
          paintMix: 0,
        });

        if (t > 1.2 && t < 3.4) {
          sparksAt(ctx, 396, 192, t, 21, 16, 30);
          lightShaft(ctx, 314, 0, 22, deckY, '#7dd3fc', 0.14);
        }
        glowAt(ctx, 324, 216, 68, '#38bdf8', 0.12 + power * 0.18);
      });

      R(ctx, 27, 39, 178, 63, 'rgba(10,15,28,0.9)');
      R(ctx, 27, 39, 178, 2, '#38bdf8');
      sign(ctx, 'UNIT CUBE-07', 116, 55, '#e0f2fe', 7);
      sign(ctx, 'AETHER WHITE-COAT // 2200', 116, 71, '#94a3b8', 5);
      bar(ctx, 46, 83, 140, ease((t - 1.1) / 2.6), '#38bdf8');
      motes(ctx, t, 26, '#bae6fd', 57, 283);
      filmLighting(ctx, '#0f172a', 0.36);
    },
  },

  /* ================================================================ *
   *  03. AETHER 2245 — NEXT-GEN DRONES & DECOMMISSION
   * ================================================================ */
  {
    id: 'outdated',
    chapter: '03 / AETHER 2245',
    set: 'new-aether',
    duration: 6.1,
    text: 'Forty-five years passed. New machines made the old mining unit obsolete.',
    draw(ctx, t) {
      drawSetAt(ctx, 'new-aether', 6 + ease(t / 6.1) * 28);
      cloudLayer(ctx, t, 106, 8);

      // Patrol squadrons of detailed 2245 Aero-Drones in the sky
      for (let i = 0; i < 5; i++) {
        const dir: 1 | -1 = i % 2 ? -1 : 1;
        const x =
          dir === 1
            ? ((t * (135 + i * 15) + i * 90) % 760) - 60
            : 700 - ((t * (120 + i * 12) + i * 80) % 760);
        const y = 46 + i * 20;
        drawAeroDrone(ctx, x, y, dir, t + i, 1.1);
      }

      // CUBE-07 on the left platform (white Aether coat, slightly weathered `paintMix: 0.06`)
      // Positioned at x = 114, y = stand(258, 4.2) so its face is around x = 114, y = 185.
      heroRobot(ctx, {
        x: 114,
        y: stand(258, 4.2),
        s: 4.2,
        t,
        state: 'sad',
        drill: false,
        look: 1,
        paintMix: 0.06,
      });

      // Inspector Drone hovers high & to the right (x = 356, y = 72) — NEVER covering CUBE-07!
      const droneT = ease(clamp((t - 1.2) / 1.4));
      const droneX = 430 - droneT * 74; // settles at x = 356 (over 240px away from CUBE-07!)
      const droneY = 54 + droneT * 20 + Math.sin(t * 4) * 2;
      drawAeroDrone(ctx, droneX, droneY, -1, t, 1.75, true);

      if (t > 2.5) {
        const appear = ease((t - 2.5) / 0.45);
        // Angled laser scanline from Inspector Drone to the hologram panel at x = 356, y = 148
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba('#f87171', 0.16 * appear);
        ctx.beginPath();
        ctx.moveTo(droneX - 4, droneY + 8);
        ctx.lineTo(droneX + 4, droneY + 8);
        ctx.lineTo(droneX + 108, droneY + 92);
        ctx.lineTo(droneX - 108, droneY + 92);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Hologram projection panel clearly to the right of CUBE-07 (x = 252..460, y = 122..174)
        ctx.save();
        ctx.translate(droneX, droneY + 72);
        ctx.globalAlpha = appear * 0.95;
        R(ctx, -104, -26, 208, 52, '#2d1018');
        R(ctx, -100, -22, 200, 44, '#991b1b');
        R(ctx, -96, -18, 192, 36, '#260e16');
        R(ctx, -100, -22, 200, 2, '#fca5a5');
        R(ctx, -100, 20, 200, 2, '#fca5a5');
        sign(ctx, 'DECOMMISSION', 0, 1, '#fecaca', 11);
        sign(ctx, 'UNIT CUBE-07 // OBSOLETE', 0, 14, '#fca5a5', 5);
        ctx.restore();
      }
      filmLighting(ctx, '#263040', 0.34);
    },
  },

  /* ================================================================ *
   *  04. THE EDGE — HANGAR BAY & TRACKED BULLDOZER SWEEPER MECH
   * ================================================================ */
  {
    id: 'cast-out',
    chapter: '04 / THE EDGE',
    set: 'exile',
    duration: 6.2,
    text: 'No ceremony. A sweeper unit drove from the reclamation bay and pushed CUBE-07 off the sky.',
    sfx: 'whoosh',
    draw(ctx, t) {
      drawSetAt(ctx, 'exile', 0);
      cloudLayer(ctx, t, 80, 11);

      const deckY = 240;
      // 1. Hangar bay blast door at x = 18..96 slides upward (t = 0..0.9s) so the pusher emerges from inside!
      const doorOpen = ease(clamp(t / 0.9));
      const doorH = Math.round((1 - doorOpen) * 78);
      if (doorH > 0) {
        R(ctx, 18, 160, 78, doorH, '#475569');
        for (let y = 164; y < 160 + doorH - 4; y += 8) {
          R(ctx, 20, y, 74, 3, '#1e293b');
        }
        R(ctx, 18, 160 + doorH - 4, 78, 4, '#eab308');
      }
      // Flashing amber bay beacon above the hangar doorway
      const bayStrobe = Math.floor(t * 7) % 2 === 0;
      R(ctx, 52, 142, 10, 6, INK);
      R(ctx, 54, 143, 6, 4, bayStrobe ? '#f59e0b' : '#78350f');
      if (bayStrobe) glowAt(ctx, 57, 145, 18, '#f59e0b', 0.4);

      // 2. Bulldozer Sweeper Mech drives out of the hangar doorway (t = 0.5..3.85s)
      const contactT = 1.45;
      const offEdge = 3.85;
      const falling = t > offEdge;

      const pushProgress = easeInOut(clamp((t - contactT) / (offEdge - contactT)));
      // CUBE-07 starts at x = 236, gets shoved to the cliff brink at x = 434
      const cubeGroundX = 236 + pushProgress * 198;

      // Bulldozer blade drives from inside the hangar (x = 84) to meet CUBE-07's left side (cubeGroundX - 38), then shoves it to the edge!
      let bladeX: number;
      if (t < contactT) {
        const approach = easeInOut(clamp((t - 0.35) / (contactT - 0.35)));
        bladeX = lerp(84, 236 - 38, approach);
      } else if (!falling) {
        bladeX = cubeGroundX - 38;
      } else {
        // Brakes at the cliff edge after shoving CUBE-07 off
        bladeX = 396;
      }

      drawBulldozerMech(ctx, bladeX, deckY, t, t > 0.35 && !falling);

      // Friction sparks & skidding dust where CUBE-07's treads resist the bulldozer blade
      if (t >= contactT && !falling) {
        glowAt(ctx, bladeX + 2, deckY - 18, 22, '#fb923c', 0.38);
        sparksAt(ctx, bladeX + 2, deckY - 14, t, 71, 10, 18);
        sparksAt(ctx, cubeGroundX, deckY - 2, t, 93, 8, 14);
      }

      // 3. Realistic tip-over & free-fall trajectory once CUBE-07 passes the cliff edge (x = 432)
      let cubeX = cubeGroundX;
      let cubeY = stand(deckY, 4.05);
      let cubeRot = 0;
      if (t > offEdge - 0.25 && !falling) {
        // Tips forward as its center of gravity overhangs the brink!
        const tip = clamp((t - (offEdge - 0.25)) / 0.25);
        cubeRot = tip * tip * 0.45;
        cubeY += tip * 8;
      } else if (falling) {
        const ft = t - offEdge;
        cubeX = 434 + ft * 56;
        cubeY = stand(deckY, 4.05) + 8 + 0.5 * 290 * ft * ft;
        cubeRot = 0.45 + ft * 3.1;
      }

      heroRobot(ctx, {
        x: cubeX,
        y: cubeY,
        s: 4.05,
        t,
        state: falling ? 'falling' : 'sad',
        eye: t > contactT ? 'surprised' : 'normal',
        drill: false,
        rot: cubeRot,
        look: -1,
        thruster: falling ? 0.35 : 0,
        paintMix: 0.08, // Still white Aether coat as it falls from the city
      });

      if (falling) {
        const d = clamp((t - offEdge) / (6.2 - offEdge));
        R(ctx, 0, 0, CW, CH, rgba('#151125', d * 0.55));
      }
      cloudLayer(ctx, t, 302, -18, true);
      filmLighting(ctx, '#102030', 0.32);
    },
  },

  /* ================================================================ *
   *  05. BELOW THE CLOUDS — ATMOSPHERIC RE-ENTRY & WHITE->BROWN SCORCH
   * ================================================================ */
  {
    id: 'free-fall',
    chapter: '05 / ATMOSPHERIC RE-ENTRY',
    set: null,
    duration: 6.4,
    text: 'Atmospheric re-entry turned the sky to fire, scorching its white Aether hull into charred brown iron.',
    sfx: 'wind',
    draw(ctx, t, duration) {
      const fall = clamp(t / duration);
      // Sky transitions from upper blue stratosphere -> violent orange-violet re-entry -> dusky wasteland
      ctx.drawImage(skyCanvas([[0, '#3b82b6'], [0.53, '#9bd0e0'], [1, '#f2efe4']]), 0, 0);
      ctx.globalAlpha = easeInOut(fall);
      ctx.drawImage(skyCanvas([[0, '#1e162b'], [0.48, '#6e2e35'], [1, '#d96b27']]), 0, 0);
      ctx.globalAlpha = 1;

      const speed = 90 + fall * 280;
      cloudLayer(ctx, (t * speed) / 20, -20, -speed * 0.5);

      // Supersonic air-friction streaks
      for (let i = 0; i < 42; i++) {
        const sx = hash(i * 12) * CW;
        const sy = CH + 45 - ((t * (speed + hash(i + 3) * 110) + hash(i + 15) * CH) % (CH + 45));
        R(ctx, sx, sy, 1, 9 + fall * 28, rgba('#fff7d6', 0.28 + 0.42 * fall));
      }

      const x = 320 + Math.sin(t * 2.5) * 10;
      const y = 166 + Math.sin(t * 3.4) * 6;
      // White ceramic paint scorches and oxidizes into brown as re-entry heat peaks!
      const paintScorch = clamp((fall - 0.18) / 0.58);
      const heatEnvelope = Math.sin(clamp((fall - 0.08) / 0.85) * Math.PI);

      reentryMeteor(ctx, x, y, t, 4.2, 0.25 + fall * 0.7, paintScorch, Math.max(0.35, heatEnvelope));

      // Ablating white paint flakes & glowing slag embers peeling off into the wake
      for (let i = 0; i < 16; i++) {
        const life = (t * 0.55 + hash(i + 24)) % 1;
        const px = x + (hash(i + 45) - 0.5) * life * 135;
        const py = y - 12 - life * 130;
        const col = life < 0.4 && paintScorch < 0.7 ? '#f1f5f9' : i % 2 ? '#fb923c' : '#fde047';
        R(ctx, px, py, 3, 3, col);
      }

      // HUD thermal & hull oxidation readout
      R(ctx, 24, 34, 186, 56, 'rgba(12, 10, 18, 0.86)');
      R(ctx, 24, 34, 186, 2, '#f97316');
      sign(ctx, `RE-ENTRY  ${Math.round(420 + fall * 1480)}C`, 117, 52, '#fed7aa', 6);
      sign(ctx, paintScorch > 0.65 ? 'COATING: SCORCHED' : 'THERMAL ABLATION', 117, 68, '#fb923c', 5);
      bar(ctx, 40, 76, 154, paintScorch, '#ea580c');

      cloudLayer(ctx, t * 2.2, 284, -48, true);
      filmLighting(ctx, '#311b26', 0.42);
    },
  },

  /* ================================================================ *
   *  06. EARTH — IMMEDIATE IMPACT & REALISTIC CRATER
   * ================================================================ */
  {
    id: 'impact',
    chapter: '06 / EARTH',
    set: 'wasteland',
    duration: 7.2,
    text: 'It slammed into the wasteland, carving a smoking crater. Broken and scorched, a tiny light stayed on.',
    sfx: 'impact',
    draw(ctx, t) {
      // High-speed impact at t = 0.34s (no awkward delay!)
      const impactTime = 0.34;
      const after = t - impactTime;
      const shake = after > 0 && after < 0.75 ? (1 - after / 0.75) * 9 : 0;

      ctx.save();
      ctx.translate(
        (hash(Math.floor(t * 45)) - 0.5) * shake * 2,
        (hash(Math.floor(t * 53) + 11) - 0.5) * shake * 2
      );
      drawSetAt(ctx, 'wasteland', 37);

      if (after < 0) {
        // Blazing vertical meteor streak straight into the impact point (x = 324, y = 262)
        const k = clamp(t / impactTime);
        const y = -50 + k * 312;
        reentryMeteor(ctx, 324, y, t * 2.4, 3.9, 1, 1, 1);
      } else {
        // Multi-layered realistic impact crater carved into the wasteland floor (center x = 324, y = 262)
        // Outer raised ejecta rim & jagged boulders
        R(ctx, 212, 252, 224, 18, '#4a3528');
        R(ctx, 222, 249, 34, 9, '#6b4c38');
        R(ctx, 392, 249, 34, 9, '#6b4c38');
        R(ctx, 206, 255, 18, 8, '#3d2b22');
        R(ctx, 424, 255, 18, 8, '#3d2b22');
        // Terraced crater walls & deep charred bowl
        R(ctx, 232, 256, 184, 20, '#2e201b');
        R(ctx, 252, 260, 144, 20, '#1c1311');
        R(ctx, 272, 264, 104, 18, '#0f0a0a');
        // Glowing molten impact fractures in the crater floor
        const magmaGlow = Math.max(0.15, 1 - after * 0.14);
        R(ctx, 284, 272, 26, 2, rgba('#ea580c', magmaGlow));
        R(ctx, 332, 274, 30, 2, rgba('#ea580c', magmaGlow));
        R(ctx, 312, 276, 18, 2, rgba('#fde047', magmaGlow));
        glowAt(ctx, 324, 268, 64, '#ea580c', 0.28 * magmaGlow);

        // Supersonic ground shockwave & radially blasted dirt clods
        const ring = clamp(after / 0.85);
        if (ring < 1) {
          ctx.strokeStyle = rgba('#ffe1ad', (1 - ring) * 0.72);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(324, 264, 36 + ring * 260, 12 + ring * 44, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (let i = 0; i < 56; i++) {
          const a = Math.PI + hash(i * 3) * Math.PI;
          const life = clamp(after / 2.2);
          const radius = life * (44 + hash(i + 12) * 135);
          ctx.globalAlpha = (1 - life) * 0.78;
          R(
            ctx,
            324 + Math.cos(a) * radius,
            252 + Math.sin(a) * radius * 0.58 + life * life * 34,
            3 + hash(i + 30) * 7,
            3 + hash(i) * 6,
            i % 2 ? '#b29373' : '#6e523e'
          );
        }
        ctx.globalAlpha = 1;

        // CUBE-07 settled inside the crater bowl (scorched brown `paintMix: 1`, tilted)
        const reboot = ease((after - 2.0) / 1.8);
        heroRobot(ctx, {
          x: 324,
          y: stand(272, 4.2),
          s: 4.2,
          t,
          state: after > 4.2 ? 'sad' : 'crash',
          damage: 1,
          power: reboot < 0.04 ? 0 : Math.max(0.14, reboot),
          eye: reboot > 0.45 ? 'scan' : 'dead',
          rot: 0.24,
          drill: false,
          look: 1,
          paintMix: 1,
        });

        // Foreground crater lip overlapping the bottom of the treads so it sits *inside* the hole!
        R(ctx, 244, 273, 160, 7, '#2e201b');
        R(ctx, 258, 272, 132, 3, '#4a3528');

        smokeAt(ctx, 302, 224, t, 7, '#a8a1a0', 9, 88);
        if (after < 2.0) sparksAt(ctx, 330, 260, t, 18, 22, 68);

        if (reboot > 0) {
          R(ctx, 40, 48, 192, 69, 'rgba(11,13,21,0.91)');
          R(ctx, 40, 48, 192, 2, '#89c5d4');
          sign(ctx, 'CUBE-07 / SYSTEMS', 136, 68, '#9ee8eb', 6);
          sign(ctx, `HULL ${Math.round(12 + reboot * 3)}%`, 136, 85, '#f4c576', 7);
          bar(ctx, 60, 97, 152, 0.12 + reboot * 0.03, '#e8784b');
        }
      }
      if (after >= 0 && after < 0.14) {
        R(ctx, 0, 0, CW, CH, rgba('#fff2d2', (1 - after / 0.14) * 0.85));
      }
      ctx.restore();
      filmLighting(ctx, '#150f19', 0.45);
    },
  },

  /* ================================================================ *
   *  07. PROJECT MINE 07 — TANK-TREAD LOCOMOTION (NO HUMAN HOPPING)
   * ================================================================ */
  {
    id: 'old-mine',
    chapter: '07 / PROJECT MINE 07',
    set: 'mine',
    duration: 6.9,
    text: 'Grinding forward on a half-broken tread wheel, it crawled to an abandoned human mining rig.',
    sfx: 'wind',
    draw(ctx, t) {
      // Tank-tread lurching progression: surges when the good sprockets grip, catches slightly on the bent front wheel
      const rawProgress = clamp(t / 6.3);
      const lurchCycle = t * 5.5;
      const tankDist = clamp(rawProgress + Math.sin(lurchCycle) * 0.008 * (1 - rawProgress));
      const pan = 2 + tankDist * 75;
      drawSetAt(ctx, 'mine', pan);

      // Permanent MINE 07 timber placard mounted onto the headframe cross-beams
      const signX = 544 - pan;
      R(ctx, signX - 58, 198, 116, 22, '#241816');
      R(ctx, signX - 55, 200, 110, 18, '#957450');
      R(ctx, signX - 55, 200, 110, 2, '#c2a075');
      sign(ctx, 'MINE 07', signX, 213, '#2b1e1a', 8);

      const x = 92 + tankDist * 274;

      // Tank tread tracks pressed into the dirt behind CUBE-07!
      for (let tx = 24; tx < x - 28; tx += 9) {
        R(ctx, tx, 258, 5, 2, '#3b2820');
        R(ctx, tx + 1, 260, 4, 1, '#241814');
      }

      // Subtle chassis pitch as the bent front bogie wheel rolls over ties (NO vertical human hop!)
      const catchPhase = Math.sin(lurchCycle);
      const chassisPitch = catchPhase * 0.032;

      heroRobot(ctx, {
        x,
        y: stand(258, 3.6),
        s: 3.6,
        t,
        state: 'sad',
        damage: 0.82,
        eye: t > 5 ? 'scan' : 'normal',
        drill: false,
        look: t > 4.4 ? 1 : 0,
        rot: chassisPitch,
        paintMix: 1,
        wheelPhase: tankDist * 18,
        brokenWheel: true,
      });

      // Grinding sparks & dust kicked up by the jammed front bogie wheel
      if (rawProgress < 0.96 && catchPhase > 0.55) {
        sparksAt(ctx, x + 22, 255, t, 41, 6, 12);
      }
      smokeAt(ctx, x - 20, 254, t, 25, '#8d755d', 4, 18);
      smokeAt(ctx, x - 16, 217, t, 19, '#a29a95', 5, 36);

      motes(ctx, t, 30, '#e2c4a1', 61, 273);
      filmLighting(ctx, '#352335', 0.4);
    },
  },

  /* ================================================================ *
   *  08. BUILT AGAIN — ARTICULATED GANTRY & HYDRAULIC DRILL MOUNT
   * ================================================================ */
  {
    id: 'self-repair',
    chapter: '08 / BUILT AGAIN',
    set: 'workshop',
    duration: 7.8,
    text: 'Using the workshop gantry and hydraulic cradle, CUBE-07 bolted on spare armor and a heavy mining drill.',
    sfx: 'weld',
    draw(ctx, t) {
      drawSetAt(ctx, 'workshop', 24);
      glowAt(ctx, 320, 108, 150, '#f8d39a', 0.16);

      const benchY = 252;
      const rigScale = 5.0;
      const rigX = 316;
      const rigY = stand(benchY, rigScale);

      // Hydraulic scissor-lift platform under CUBE-07 on the workbench
      R(ctx, rigX - 58, benchY - 4, 116, 6, INK);
      R(ctx, rigX - 56, benchY - 3, 112, 4, '#64748b');

      // Overhead structural gantry rail (y = 30)
      const railY = 30;
      R(ctx, 76, railY, 490, 7, '#161c26');
      R(ctx, 76, railY + 1, 490, 2, '#64748b');
      for (let bx = 100; bx <= 540; bx += 145) {
        R(ctx, bx - 3, 0, 6, railY, '#262f3d');
      }

      // Left-side Steel Parts Rack (x = 112..218) holding 4 replacement hull plates
      R(ctx, 108, benchY - 56, 8, 56, '#1f2937');
      R(ctx, 214, benchY - 56, 8, 56, '#1f2937');
      R(ctx, 106, benchY - 34, 118, 4, '#475569');
      R(ctx, 106, benchY - 14, 118, 4, '#475569');

      const rackParts: Array<{ rackX: number; rackY: number; color: string; mountX: number; mountY: number; start: number; end: number }> = [
        { rackX: 132, rackY: benchY - 42, color: '#cbd5e1', mountX: rigX - 28, mountY: rigY - 6, start: 0.25, end: 1.4 },
        { rackX: 186, rackY: benchY - 42, color: '#d9772a', mountX: rigX + 18, mountY: rigY + 18, start: 1.45, end: 2.6 },
        { rackX: 132, rackY: benchY - 22, color: '#94a3b8', mountX: rigX - 34, mountY: rigY + 14, start: 2.65, end: 3.8 },
        { rackX: 186, rackY: benchY - 22, color: '#f59e0b', mountX: rigX + 12, mountY: rigY - 12, start: 3.85, end: 4.95 },
      ];

      let clawX = 160;
      let clawY = 92;
      let clawClosed = false;
      let weldPoint: [number, number] | null = null;
      let attachedCount = 0;

      // Render each armor plate (on rack -> carried by articulated loader arm -> welded onto CUBE-07)
      for (const p of rackParts) {
        if (t < p.start) {
          R(ctx, p.rackX - 9, p.rackY - 6, 18, 12, INK);
          R(ctx, p.rackX - 7, p.rackY - 4, 14, 8, p.color);
          R(ctx, p.rackX - 7, p.rackY - 4, 14, 2, shade(p.color, 0.35));
          continue;
        }
        if (t >= p.end) {
          attachedCount++;
          continue;
        }
        const u = (t - p.start) / (p.end - p.start);
        let px = p.rackX;
        let py = p.rackY;
        if (u < 0.25) {
          const k = easeInOut(u / 0.25);
          clawX = lerp(rigX - 20, p.rackX, k);
          clawY = lerp(96, p.rackY - 6, k);
          clawClosed = u > 0.2;
        } else if (u < 0.78) {
          const k = easeInOut((u - 0.25) / 0.53);
          px = lerp(p.rackX, p.mountX, k);
          py = lerp(p.rackY, p.mountY, k) - Math.sin(k * Math.PI) * 32;
          clawX = px;
          clawY = py - 6;
          clawClosed = true;
        } else {
          px = p.mountX;
          py = p.mountY;
          clawX = p.mountX;
          clawY = p.mountY - 6;
          clawClosed = true;
          weldPoint = [p.mountX, p.mountY];
        }
        R(ctx, px - 9, py - 6, 18, 12, INK);
        R(ctx, px - 7, py - 4, 14, 8, p.color);
        R(ctx, px - 7, py - 4, 14, 2, shade(p.color, 0.35));
      }

      const drillStart = 5.0;
      const drillEnd = 6.55;
      const drillAttached = t >= drillEnd;
      const repaired = clamp((attachedCount + (drillAttached ? 1 : clamp((t - 5.0) / 1.55))) / 5);

      // Render CUBE-07 on the workbench
      heroRobot(ctx, {
        x: rigX,
        y: rigY,
        s: rigScale,
        t,
        state: drillAttached ? 'happy' : 'working',
        damage: 0.92 * (1 - repaired),
        power: 0.45 + repaired * 0.55,
        eye: drillAttached ? 'happy' : 'scan',
        drill: drillAttached,
        drillAngle: -0.18,
        drillExtend: drillAttached ? 0.55 + 0.25 * Math.sin(t * 7) : 0,
        paintMix: 1,
      });

      // Draw already-welded salvage plates onto the hull
      for (const p of rackParts) {
        if (t >= p.end) {
          R(ctx, p.mountX - 7, p.mountY - 5, 14, 10, INK);
          R(ctx, p.mountX - 5, p.mountY - 3, 10, 6, p.color);
          R(ctx, p.mountX - 5, p.mountY - 3, 10, 2, shade(p.color, 0.35));
          R(ctx, p.mountX - 4, p.mountY - 2, 2, 2, '#ffffff');
        }
      }

      // Right-side Hydraulic Drill Loader Cradle (squarely on the right workbench x = 428): lifts & slides the heavy drill onto CUBE-07's shoulder!
      const drillSlide = easeInOut(clamp((t - drillStart) / (drillEnd - drillStart - 0.3)));
      const cradleBaseX = lerp(428, rigX + 44, drillSlide);
      const cradleTopY = lerp(benchY - 18, rigY - 4, easeInOut(clamp((t - drillStart) / 0.65)));

      // Hydraulic loader track & scissor struts on right bench
      R(ctx, 365, benchY - 4, 96, 4, '#334155');
      R(ctx, cradleBaseX - 14, cradleTopY + 10, 28, benchY - (cradleTopY + 10), '#1e293b');
      R(ctx, cradleBaseX - 10, cradleTopY + 10, 4, benchY - (cradleTopY + 10), '#94a3b8');
      R(ctx, cradleBaseX + 6, cradleTopY + 10, 4, benchY - (cradleTopY + 10), '#94a3b8');
      R(ctx, cradleBaseX - 18, cradleTopY + 6, 36, 6, '#eab308');

      if (!drillAttached) {
        // Heavy salvaged auger drill sitting in the hydraulic cradle
        const dx = cradleBaseX;
        const dy = cradleTopY;
        R(ctx, dx - 18, dy - 9, 16, 16, INK);
        R(ctx, dx - 16, dy - 7, 12, 12, '#64748b');
        R(ctx, dx - 16, dy - 7, 12, 3, '#cbd5e1');
        for (let b = 0; b < 5; b++) {
          const hh = 7 - b;
          R(ctx, dx - 2 + b * 5, dy - hh - 1, 5, hh * 2, INK);
          R(ctx, dx - 1 + b * 5, dy - hh, 4, hh * 2 - 2, b % 2 === 0 ? '#d97706' : '#f59e0b');
        }
        if (t > drillStart) {
          clawX = dx - 4;
          clawY = dy - 10;
          clawClosed = true;
          if (t > drillEnd - 0.45) {
            weldPoint = [rigX + 36, rigY - 4];
          }
        }
      } else {
        clawX = rigX + 70;
        clawY = 76;
        clawClosed = false;
      }

      // Draw 2-Joint Articulated Overhead Loader Arm (Trolley -> Elbow -> Servo Claw)
      const trolleyX = clamp(clawX + 18, 120, 520);
      const elbowX = (trolleyX + clawX) * 0.5 - 16;
      const elbowY = (railY + 10 + clawY) * 0.5;
      R(ctx, trolleyX - 18, railY - 3, 36, 12, INK);
      R(ctx, trolleyX - 16, railY - 1, 32, 8, '#3b4759');
      R(ctx, trolleyX - 16, railY - 1, 32, 2, '#94a3b8');
      // Upper boom & forearm
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(trolleyX, railY + 9);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(clawX, clawY);
      ctx.stroke();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(trolleyX, railY + 9);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(clawX, clawY);
      ctx.stroke();
      R(ctx, elbowX - 4, elbowY - 4, 8, 8, '#eab308');
      // Servo grapple jaws
      const spread = clawClosed ? 5 : 9;
      R(ctx, clawX - 10, clawY - 4, 20, 5, INK);
      R(ctx, clawX - 8, clawY - 3, 16, 3, '#eab308');
      R(ctx, clawX - spread - 2, clawY + 1, 3, 7, '#e2e8f0');
      R(ctx, clawX + spread - 1, clawY + 1, 3, 7, '#e2e8f0');

      // Secondary Ceiling Plasma Welder Arm (right side)
      if (weldPoint) {
        const wx = weldPoint[0];
        const wy = weldPoint[1];
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(430, railY + 8);
        ctx.lineTo(410, 128);
        ctx.lineTo(wx + 8, wy - 6);
        ctx.stroke();
        glowAt(ctx, wx, wy, 34, '#7dd3fc', 0.55);
        glowAt(ctx, wx, wy, 16, '#ffffff', 0.65);
        sparksAt(ctx, wx, wy, t, 57, 20, 32);
      }

      R(ctx, 33, 50, 192, 81, 'rgba(12,16,24,0.91)');
      R(ctx, 33, 50, 192, 2, '#5fc5cf');
      sign(ctx, 'REPAIR DIAGNOSTIC', 129, 69, '#b5ebee', 6);
      sign(ctx, drillAttached ? 'DRILL ONLINE' : 'SALVAGE IN PROGRESS', 129, 89, drillAttached ? '#96e8af' : '#fbd692', 6);
      bar(ctx, 52, 102, 154, repaired, '#70cbb8');
      motes(ctx, t, 25, '#fff0bb', 39, 300);
      filmLighting(ctx, '#130e16', 0.41);
    },
  },

  /* ================================================================ *
   *  09. NOT ALONE — SURVIVOR OUTPOST (MATCHING UPGRADED BUILDINGS)
   * ================================================================ */
  {
    id: 'survivors',
    chapter: '09 / NOT ALONE',
    set: 'outpost',
    duration: 7.2,
    text: 'But the old mine was not empty. A community had survived beneath the ground.',
    sfx: 'cheer',
    draw(ctx, t) {
      const pan = 36;
      drawSetAt(ctx, 'outpost', pan);
      // Twin smokestack plumes on the upgraded Refinery
      smokeAt(ctx, 48 - pan, 130, t, 11, '#c4b48a', 6, 52);
      smokeAt(ctx, 72 - pan, 140, t + 0.5, 19, '#b5aab1', 5, 44);
      glowAt(ctx, 62 - pan, 244, 56, '#f59e0b', 0.24 + 0.08 * Math.sin(t * 5));
      // Plasma bay glow on the upgraded Drill Forge
      glowAt(ctx, 555 - pan, 240, 48, '#38bdf8', 0.22 + 0.08 * Math.sin(t * 4));

      const open = ease((t - 0.5) / 0.95);
      R(ctx, 275, 195, 72, 69, '#100d16');
      glowAt(ctx, 311, 226, 64, '#ffce85', open * 0.3);
      if (open < 1) {
        R(ctx, 277 - 62 * open, 197, 68, 65, '#5c5368');
        R(ctx, 277 - 62 * open, 197, 68, 3, '#978a9b');
      }
      if (t > 3.0) {
        ctx.globalAlpha = Math.min(0.85, (t - 3.0) * 0.6);
        for (let i = 0; i < 6; i++) {
          const progress = ease((t - 3.0 - i * 0.25) / 1.8);
          if (progress > 0) {
            const target = i % 2 ? 205 - i * 13 : 390 + i * 16;
            workerSilhouette(ctx, 310 + (target - 310) * progress, 264, i, t);
          }
        }
        ctx.globalAlpha = 1;
      }

      const cast: Array<{ id: 'gus' | 'mara' | 'ilse' | 'pip'; target: number; direction: 1 | -1 }> = [
        { id: 'gus', target: 378, direction: 1 },
        { id: 'mara', target: 416, direction: 1 },
        { id: 'ilse', target: 462, direction: 1 },
        { id: 'pip', target: 252, direction: -1 },
      ];
      cast.forEach((person, i) => {
        const p = clamp((t - 1.35 - i * 0.42) / 1.55);
        if (p <= 0) return;
        heroHuman(ctx, {
          x: 311 + (person.target - 311) * easeInOut(p),
          y: 268,
          s: person.id === 'pip' ? 1.85 : 2.3,
          t: t + i * 0.26,
          look: human(person.id),
          pose: p < 1 ? 'walk' : person.id === 'pip' ? 'wave' : 'idle',
          walkPhase: t * 4.5,
          facing: person.direction,
          talking: person.id === 'ilse' && t > 4.2 && t < 6.4,
          flipProp: person.id === 'gus' ? 'wrench' : person.id === 'ilse' ? 'lantern' : null,
        });
      });

      heroRobot(ctx, {
        x: 548,
        y: stand(268, 3.5),
        s: 3.5,
        t,
        state: t > 4.7 ? 'happy' : 'idle',
        eye: t > 4.7 ? 'happy' : 'surprised',
        look: -1,
        drill: true,
        drillAngle: 1.1,
        paintMix: 1,
      });

      if (t > 4.2 && t < 6.7) {
        const appear = ease((t - 4.2) / 0.22);
        ctx.save();
        ctx.globalAlpha = appear;
        R(ctx, 392, 136, 148, 34, '#110d14');
        R(ctx, 395, 139, 142, 28, '#f2e4cc');
        R(ctx, 395, 139, 142, 2, '#4ade80');
        R(ctx, 460, 167, 8, 6, '#f2e4cc');
        sign(ctx, 'A ROBOT?', 466, 158, '#2f2934', 9);
        ctx.restore();
      }
      motes(ctx, t, 18, '#f7cb9a', 70, 230);
      filmLighting(ctx, '#271b24', 0.38);
    },
  },

  /* ================================================================ *
   *  10. A PROMISE — CLEAR, SMOOTH PACT BETWEEN MARA & CUBE-07
   * ================================================================ */
  {
    id: 'the-deal',
    chapter: '10 / A PROMISE',
    set: 'outpost',
    duration: 7.2,
    speaker: 'mara',
    text: '"Mine for us, little one. We will keep you running." For the first time, CUBE-07 had a home.',
    draw(ctx, t) {
      camera(ctx, -32, -20, 1.06 + ease(t / 7.2) * 0.06, () => {
        drawSetAt(ctx, 'outpost', 38);

        // Outpost crew gathered warmly on the deck
        heroHuman(ctx, { x: 196, y: 268, s: 2.25, t, look: human('pip'), pose: t > 3.4 ? 'cheer' : 'idle', facing: 1 });
        heroHuman(ctx, { x: 242, y: 268, s: 2.5, t, look: human('gus'), pose: t > 3.2 ? 'cheer' : 'idle', flipProp: 'wrench', facing: 1 });
        heroHuman(ctx, { x: 288, y: 268, s: 2.45, t, look: human('ilse'), pose: t > 3.5 ? 'wave' : 'idle', flipProp: 'lantern', facing: 1 });

        // Mara steps forward smoothly (t = 0.3..1.5s) and extends the glowing power module (`pose: 'reach'`)
        const stepIn = easeInOut(clamp((t - 0.25) / 1.25));
        const maraX = lerp(332, 368, stepIn);
        const reach = ease(clamp((t - 1.35) / 1.1));
        heroHuman(ctx, {
          x: maraX,
          y: 268,
          s: 3.0,
          t,
          look: human('mara'),
          pose: stepIn < 1 ? 'walk' : reach > 0.3 ? 'reach' : 'idle',
          walkPhase: t * 4,
          talking: t > 1.2 && t < 4.5,
          facing: 1,
        });

        // CUBE-07 faces Mara (`flip: true`), keeps its heavy drill tucked safely back (`drillAngle: 2.35`),
        // and extends its small front service manipulator (`serviceArm: reach`) to meet Mara's hand!
        heroRobot(ctx, {
          x: 462,
          y: stand(268, 4.3),
          s: 4.3,
          t,
          flip: true,
          state: t > 2.8 ? 'happy' : 'idle',
          eye: t > 2.8 ? 'happy' : 'normal',
          look: 1,
          drill: true,
          drillAngle: 2.35,
          drillExtend: 0.1,
          serviceArm: reach,
          paintMix: 1,
        });

        // Warm golden energy exchange where Mara's offered core module meets CUBE-07's gripper!
        if (reach > 0.75) {
          const pulse = 0.55 + 0.45 * Math.sin(t * 6);
          const meetX = 406;
          const meetY = 205;
          glowAt(ctx, meetX, meetY, 30 + pulse * 12, '#fde047', 0.35 + 0.12 * pulse);
          if (t < 4.5) sparksAt(ctx, meetX, meetY, t, 55, 10, 16);
        }
      });
      smokeAt(ctx, 66, 129, t, 11, '#b5aab1', 6, 53);
      filmLighting(ctx, '#191322', 0.35);
    },
  },

  /* ================================================================ *
   *  11. INTO THE DEEP — MINECRAFT-STYLE BLOCK CAVERNS & ORE VEINS
   * ================================================================ */
  {
    id: 'first-shift',
    chapter: '11 / INTO THE DEEP',
    set: 'shaft',
    duration: 7.4,
    text: 'Down the block-carved shaft CUBE-07 descended, its headlamp lighting veins of copper, sulfur, and gold.',
    sfx: 'whoosh',
    draw(ctx, t, duration) {
      const descent = easeInOut(t / duration);
      const scrollY = Math.round(descent * (1040 - CH));
      ctx.drawImage(getShaftWall(), 0, -scrollY);

      // Sparkling ore vein glints synchronized with the scrolling block grid!
      const veinGlints: Array<[number, number, string]> = [
        [14 * 16 + 8, 5 * 16 + 8, '#94a3b8'],
        [25 * 16 + 8, 7 * 16 + 8, '#ffad66'],
        [14 * 16 + 8, 14 * 16 + 8, '#ffff9e'],
        [29 * 16 + 8, 13 * 16 + 8, '#ffff9e'],
        [14 * 16 + 8, 22 * 16 + 8, '#ffff9e'],
        [24 * 16 + 8, 27 * 16 + 8, '#fff08a'],
        [14 * 16 + 8, 32 * 16 + 8, '#fff08a'],
        [30 * 16 + 8, 38 * 16 + 8, '#9effc6'],
        [14 * 16 + 8, 40 * 16 + 8, '#9effc6'],
        [24 * 16 + 8, 43 * 16 + 8, '#ff94aa'],
        [14 * 16 + 8, 52 * 16 + 8, '#9ee0ff'],
        [24 * 16 + 8, 61 * 16 + 8, '#ffffb8'],
      ];
      for (let i = 0; i < veinGlints.length; i++) {
        const [vx, vy, col] = veinGlints[i];
        const sy = vy - scrollY;
        if (sy < -30 || sy > CH + 30) continue;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.5 + i * 1.7);
        glowAt(ctx, vx, sy, 22 + pulse * 10, col, 0.22 + pulse * 0.14);
        if (pulse > 0.75) {
          R(ctx, vx - 2, sy, 5, 1, '#ffffff');
          R(ctx, vx, sy - 2, 1, 5, '#ffffff');
        }
      }

      const cageX = 320;
      const cageY = Math.round(116 + descent * 98);
      const cablePulleySpin = t * 14;

      // Overhead steel hoist cable
      R(ctx, cageX - 1, 0, 3, cageY - 34, '#334155');
      R(ctx, cageX, 0, 1, cageY - 34, '#94a3b8');

      // Dual volumetric headlamp beams sweeping the left and right Minecraft-style block walls
      const sweep = Math.sin(t * 1.5) * 0.25 + 0.12;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beamGrad = ctx.createLinearGradient(cageX + 16, cageY, cageX + 270, cageY + Math.sin(sweep) * 140);
      beamGrad.addColorStop(0, 'rgba(255, 243, 184, 0.38)');
      beamGrad.addColorStop(0.55, 'rgba(255, 224, 130, 0.15)');
      beamGrad.addColorStop(1, 'rgba(255, 224, 130, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(cageX + 14, cageY - 4);
      ctx.lineTo(cageX + 280, cageY + Math.sin(sweep - 0.24) * 170);
      ctx.lineTo(cageX + 280, cageY + Math.sin(sweep + 0.24) * 170);
      ctx.lineTo(cageX + 14, cageY + 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Steel mine elevator cage
      R(ctx, cageX - 42, cageY - 34, 84, 6, '#1e293b');
      R(ctx, cageX - 40, cageY - 33, 80, 4, '#94a3b8');
      R(ctx, cageX - 40, cageY - 28, 4, 62, '#475569');
      R(ctx, cageX + 36, cageY - 28, 4, 62, '#475569');
      for (let gx = cageX - 28; gx <= cageX + 28; gx += 14) {
        R(ctx, gx, cageY - 28, 2, 62, 'rgba(100, 116, 139, 0.5)');
      }
      R(ctx, cageX - 44, cageY + 34, 88, 8, INK);
      R(ctx, cageX - 42, cageY + 35, 84, 5, '#64748b');
      R(ctx, cageX - 42, cageY + 35, 84, 2, '#cbd5e1');

      // Spinning winch pulley wheel at top of shaft
      ctx.save();
      ctx.translate(cageX, 18);
      ctx.rotate(cablePulleySpin * 0.25);
      R(ctx, -9, -9, 18, 18, INK);
      R(ctx, -7, -7, 14, 14, '#7c8599');
      R(ctx, -2, -7, 4, 14, '#334155');
      R(ctx, -7, -2, 14, 4, '#334155');
      ctx.restore();

      heroRobot(ctx, {
        x: cageX,
        y: stand(cageY + 35, 2.55),
        s: 2.55,
        t,
        state: 'idle',
        eye: 'scan',
        look: 1,
        drill: true,
        drillAngle: 0.42,
        drillExtend: 0.28,
        paintMix: 1,
      });

      glowAt(ctx, cageX + 16, cageY + 4, 96, '#ffe4b2', 0.24);
      motes(ctx, t * 2.2, 34, '#ffe9a8', 12, CH - 14);

      const depthMeters = Math.round(descent * 185);
      const stratumName =
        depthMeters < 36
          ? 'ASH & TOPSOIL'
          : depthMeters < 86
            ? 'SULFUR LIMESTONE'
            : depthMeters < 141
              ? 'BRIMSTONE BASALT'
              : 'ABYSSAL OBSIDIAN';
      const stratumColor =
        depthMeters < 36
          ? '#d97236'
          : depthMeters < 86
            ? '#fde047'
            : depthMeters < 141
              ? '#c084fc'
              : '#38bdf8';

      R(ctx, 18, 22, 156, 52, 'rgba(10, 12, 20, 0.9)');
      R(ctx, 18, 22, 156, 2, stratumColor);
      sign(ctx, `DEPTH  ${depthMeters}M`, 96, 41, '#f4cb7a', 8);
      sign(ctx, stratumName, 96, 58, stratumColor, 5);

      filmLighting(ctx, '#07050d', 0.44);
    },
  },

  /* ================================================================ *
   *  12. THE SULFURED CORE — MONUMENTAL CATHEDRAL & COLOSSAL SULFUR
   * ================================================================ */
  {
    id: 'sulfured-caves',
    chapter: '12 / THE SULFURED CORE',
    set: 'heart',
    duration: 8.5,
    text: 'In the Sulfured Core, the colossal Heart of Sulfur blazed like a buried sun.',
    draw(ctx, t) {
      // Slow cinematic wide-angle pan & zoom across the monumental Sulfured Core cathedral
      const pan = 28 - easeInOut(t / 8.5) * 24;
      drawSetAt(ctx, 'heart', pan);

      // Colossal Heart of Sulfur monolith center (in screen coords)
      const heartX = 542 - pan;
      const heartY = 156;
      const pulse = 0.65 + 0.35 * Math.sin(t * 2.4);

      // Rotating volumetric golden god-rays radiating from the colossal yellow sulfur crystal!
      ctx.save();
      ctx.translate(heartX, heartY);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 4 + t * 0.08);
        const rayGrad = ctx.createLinearGradient(0, 0, 220, 0);
        rayGrad.addColorStop(0, `rgba(253, 224, 71, ${0.14 * pulse})`);
        rayGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(220, -28);
        ctx.lineTo(220, 28);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      glowAt(ctx, heartX, heartY, 240, '#f59e0b', 0.25 + 0.08 * pulse);
      glowAt(ctx, heartX, heartY - 18, 120, '#fef08a', 0.28 * pulse);

      // Levitating crystalline resonance shards orbiting the colossal Heart of Sulfur
      for (let s = 0; s < 6; s++) {
        const ang = t * 0.9 + s * ((Math.PI * 2) / 6);
        const sx = heartX + Math.cos(ang) * (76 + (s % 2) * 18);
        const sy = heartY - 10 + Math.sin(ang * 1.5) * 44;
        R(ctx, sx - 3, sy - 6, 6, 12, INK);
        R(ctx, sx - 2, sy - 5, 4, 10, '#fde047');
        R(ctx, sx - 1, sy - 4, 2, 5, '#ffffff');
      }

      // Shimmering underground sulfur-amber lake ripples & golden reflection
      const lakeX = 288 - pan;
      for (let ry = 310; ry < CH; ry += 6) {
        const wave = Math.sin(t * 3.2 + ry * 0.4) * 7;
        R(ctx, lakeX + 12 + wave, ry, 52, 1, rgba('#fde047', 0.34));
        R(ctx, lakeX + 64 - wave * 0.7, ry + 3, 46, 1, rgba('#fb923c', 0.36));
      }
      glowAt(ctx, lakeX + 70, 328, 68, '#fbbf24', 0.26 + 0.08 * pulse);

      // Choreography: CUBE-07 drives across the left block ledge (0..2.0s), bores into the rich sulfur-gold block wall (2.0..4.5s), then looks up at the colossal Heart of Sulfur!
      const driveT = easeInOut(clamp(t / 2.0));
      const wallFaceX = 224 - pan;
      const x = wallFaceX - 110 + driveT * 58;
      const drilling = t >= 2.0 && t <= 4.55;
      const happy = t > 4.55;

      // Volumetric headlamp beam
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lampGrad = ctx.createLinearGradient(x + 22, 240, x + 210, 195);
      lampGrad.addColorStop(0, 'rgba(255, 243, 184, 0.32)');
      lampGrad.addColorStop(1, 'rgba(255, 243, 184, 0)');
      ctx.fillStyle = lampGrad;
      ctx.beginPath();
      ctx.moveTo(x + 18, 232);
      ctx.lineTo(x + 225, 165);
      ctx.lineTo(x + 225, 288);
      ctx.lineTo(x + 18, 248);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      heroRobot(ctx, {
        x,
        y: stand(288, 3.85),
        s: 3.85,
        t,
        state: drilling ? 'working' : happy ? 'happy' : 'idle',
        eye: happy ? 'happy' : drilling ? 'scan' : 'normal',
        look: 1,
        drill: true,
        drillAngle: drilling ? -0.04 : -0.24,
        drillExtend: drilling ? 0.85 : 0.35,
        wheelPhase: driveT * 10,
        paintMix: 1,
      });

      if (drilling) {
        const tipX = wallFaceX + 2;
        const tipY = 250;
        sparksAt(ctx, tipX, tipY, t, 88, 24, 36);
        glowAt(ctx, tipX, tipY, 38, '#fde047', 0.52);
        for (let k = 0; k < 6; k++) {
          const age = ((t - 2.0) * 1.5 + k * 0.17) % 1;
          const nx = tipX - age * (36 + k * 8);
          const ny = tipY - Math.sin(age * Math.PI) * 28 + age * age * 38;
          R(ctx, nx - 2, ny - 2, 5, 5, INK);
          R(ctx, nx - 1, ny - 1, 3, 3, k % 2 === 0 ? '#fde047' : '#f59e0b');
        }
      }

      // Rising golden embers around the colossal Heart of Sulfur
      for (let i = 0; i < 30; i++) {
        const life = (t * (0.16 + hash(i) * 0.12) + hash(i + 9)) % 1;
        const xp = heartX - 90 + hash(i + 36) * 180 + Math.sin(t + i) * 5;
        const yp = 280 - life * 220;
        R(ctx, xp, yp, i % 4 ? 1 : 2, i % 4 ? 1 : 2, rgba('#fff1a4', (1 - life) * 0.88));
      }

      // Monumental title crest in the upper-left vault (leaves the colossal Heart of Sulfur on the right 100% unobstructed!)
      if (t > 4.6) {
        const fade = ease((t - 4.6) / 1.1);
        ctx.save();
        ctx.globalAlpha = fade;
        R(ctx, 28, 24, 344, 96, 'rgba(10, 7, 18, 0.92)');
        R(ctx, 32, 28, 336, 3, '#f0bc54');
        R(ctx, 32, 115, 336, 3, '#a35e32');
        sign(ctx, 'SULFURED', 200, 66, '#ffe39d', 24);
        sign(ctx, 'CAVES', 200, 102, '#fb923c', 26);
        if (t > 6.0) sign(ctx, 'THE STORY OF CUBE-07', 200, 134, '#e5d5c4', 6);
        ctx.restore();
      }

      motes(ctx, t, 40, '#dfcc8e', 30, 315);
      filmLighting(ctx, '#0d0813', 0.42);
    },
  },
];

export function prepareScene(index: number) {
  const set = CUTSCENE[index]?.set;
  if (set) getSet(set);
}
