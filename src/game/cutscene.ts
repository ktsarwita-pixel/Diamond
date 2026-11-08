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
  heroRobot,
  lightShaft,
  rgba,
  sparksAt,
} from './cutsceneArt';
import {
  filmLighting,
  motes,
} from './cinematicSets';
import {
  AETHER_TECH,
  AETHER_TECH_B,
  cinematicHuman,
  crowdLook,
  humanThroughDoorway,
} from './cineHumans';
import { drawReentry, earthJob } from './sceneReentry';
import { drawImpact, landJob } from './sceneImpact';
import { drawMineScene, mineJob } from './sceneMine';
import { drawShaftScene, shaftJob } from './sceneCaves';
import { CALDERA_DURATION, calderaJob, drawCalderaScene } from './sceneCaldera';
import type { Job } from './cineKit';
import { drawStorySet, prepareStorySet, storyAtmosphere, storySetJobs, type StorySet } from './storyWorlds';
import { drawWorkshopScene, workshopJob } from './sceneWorkshop';
import { HABITAT_OPENING } from './outpostArt';
import { PROMISE_DURATION, drawPromiseScene } from './scenePromise';
export { promiseBeatAt, promiseContact } from './scenePromise';
import { polygon } from './pixelCraft';
import { DEPARTURE_DURATION, drawScientistDeparture } from './sceneDeparture';
export { scientistDepartureAt } from './sceneDeparture';
import { DISPOSAL_DURATION, disposalJob, drawDisposalScene } from './sceneDisposal';
export { disposalPoseAt } from './sceneDisposal';

export const CS_W = CW;
export const CS_H = CH;

export interface CutsceneScene {
  id: string;
  chapter: string;
  duration: number;
  text: string;
  speaker?: 'mara' | 'cube';
  set: StorySet | null;
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
      drawStorySet(ctx, 'aether', 13 + move * 63, t);

      // Volumetric golden-hour sunrays & anti-gravity core glow beneath the floating city
      glowAt(ctx, 495, 174, 155, '#ffd996', 0.22);
      lightShaft(ctx, 450, 40, 48, 240, '#ffe3a8', 0.08);
      lightShaft(ctx, 350, 50, 36, 230, '#bae6fd', 0.06);
      glowAt(ctx, 395 - move * 63, 272, 74, '#38bdf8', 0.22 + 0.06 * Math.sin(t * 3));


      // Sleek Aether sky-cruisers with glowing ion contrails
      drawAeroDrone(ctx, -60 + t * 68, 118, 1, t, 1.35);
      drawAeroDrone(ctx, 680 - t * 52, 88, -1, t + 2, 1.0);

      birds(ctx, t, 64, '#312e48', 6);
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
        drawStorySet(ctx, 'foundry', 24, t);
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

        // Aether clean-room technicians supervising the boot sequence
        const techWalk = easeInOut(clamp((t - 0.2) / 1.6));
        cinematicHuman(ctx, {
          x: lerp(150, 196, techWalk),
          y: 304,
          s: 2.55,
          t,
          look: AETHER_TECH,
          outfit: 'aether',
          pose: techWalk < 1 ? 'walk' : 'hold',
          walkPhase: t * 4.4,
          flipProp: 'clipboard',
          facing: 1,
          rim: '#7dd3fc',
        });
        cinematicHuman(ctx, {
          x: 470,
          y: 304,
          s: 2.5,
          t: t + 1.3,
          look: AETHER_TECH_B,
          outfit: 'aether',
          pose: t > 4.0 ? 'point' : t > 2.2 ? 'idle' : 'hold',
          flipProp: t > 4.0 ? null : 'clipboard',
          talking: t > 4.2 && t < 6,
          facing: -1,
          rim: '#7dd3fc',
        });
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
    duration: DEPARTURE_DURATION,
    text: 'Forty-five years passed. New machines made the old mining unit obsolete.',
    draw(ctx, t) {
      drawScientistDeparture(ctx, t);
    },
  },

  /* ================================================================ *
   *  04. THE EDGE — HANGAR BAY & TRACKED BULLDOZER SWEEPER MECH
   * ================================================================ */
  {
    id: 'cast-out',
    chapter: '04 / THE RECLAMATION DECK',
    set: null,
    duration: DISPOSAL_DURATION,
    text: 'The reclamation bay opened. A tracked sweeper drove CUBE-07 toward the edge. Its treads fought the steel, until there was no steel left.',
    sfx: 'whoosh',
    draw(ctx, t) {
      drawDisposalScene(ctx, t);
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
      drawReentry(ctx, t, duration);
    },
  },

  /* ================================================================ *
   *  06. EARTH — IMMEDIATE IMPACT & REALISTIC CRATER
   * ================================================================ */
  {
    id: 'impact',
    chapter: '06 / EARTH',
    set: null,
    duration: 7.2,
    text: 'It slammed into the wasteland, carving a smoking crater. Broken and scorched, a tiny light stayed on.',
    sfx: 'impact',
    draw(ctx, t) {
      drawImpact(ctx, t);
    },
  },

  /* ================================================================ *
   *  07. PROJECT MINE 07 — TANK-TREAD LOCOMOTION (NO HUMAN HOPPING)
   * ================================================================ */
  {
    id: 'old-mine',
    chapter: '07 / PROJECT MINE 07',
    set: null,
    duration: 6.9,
    text: 'Grinding forward on a half-broken tread wheel, it crawled to an abandoned human mining rig.',
    sfx: 'wind',
    draw(ctx, t) {
      drawMineScene(ctx, t);
    },
  },

  /* ================================================================ *
   *  08. BUILT AGAIN — ARTICULATED GANTRY & HYDRAULIC DRILL MOUNT
   * ================================================================ */
  {
    id: 'self-repair',
    chapter: '08 / BUILT AGAIN',
    set: null,
    duration: 9.6,
    text: 'Using the workshop gantry and hydraulic cradle, CUBE-07 bolted on spare armor and a heavy mining drill.',
    sfx: 'weld',
    draw(ctx, t) {
      drawWorkshopScene(ctx, t);
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
      drawStorySet(ctx, 'outpost', pan, t);
      // The bunker (habitat) is drawn at set x=243; its vault opening spans local
      // x=50..86 (36 px) from y=-61 to the sill at the deck (y=268). Everyone
      // comes out THROUGH that opening: each walker is born deep inside the
      // gloom, recedes-in-reverse toward the threshold (humanThroughDoorway),
      // then walks free on the deck.
      const doorL = 243 + HABITAT_OPENING.left - pan;
      const doorW = HABITAT_OPENING.width;
      const doorC = doorL + doorW / 2;
      const sill = 268;
      const doorway = { left: doorL, top: sill + HABITAT_OPENING.top, width: doorW, height: HABITAT_OPENING.height, sill, gloom: '#0d0a08' };
      // Warm interior light spills onto the deck as the vault opens.
      const doorOpen = easeInOut(clamp((t - 0.5) / 1.15));
      ctx.save(); ctx.globalAlpha = doorOpen * 0.16;
      polygon(ctx, [[doorL + 2, sill], [doorL + doorW - 2, sill],
        [doorL + doorW + 26, sill + 16], [doorL - 18, sill + 16]], '#ffce85');
      ctx.restore();
      // Staged entry: fade up from the gloom, pause at the threshold, then fan out.
      // A small lane offset keeps the single-file doorway from looking like clones.
      const walker = (tt: number, target: number, speed: number, lane = 0) => {
        const reveal = clamp(tt / 0.7);
        const k = tt < 0.7 ? easeInOut(reveal) * 0.94
          : tt < 0.88 ? 0.94 + 0.06 * easeInOut(clamp((tt - 0.7) / 0.18)) : 1;
        const walk = clamp((tt - 0.88) / speed);
        const x = doorC + lane * (1 - k) + (target - doorC) * easeInOut(walk);
        return { k, walk, x, inside: k < 1, moving: tt > 0.88 && walk < 1 };
      };
      const dust = (x: number, tt: number, dir: number, alpha = 0.16) => {
        const age = (tt * 2.2) % 1;
        ctx.save(); ctx.globalAlpha = (1 - age) * alpha;
        R(ctx, x - dir * age * 10 - 2, sill + 1, 4, 2, '#c9b48e');
        R(ctx, x - dir * age * 6 + 2, sill + 2, 3, 1, '#a89474');
        ctx.restore();
      };
      if (t > 3.25) {
        // Background survivors fan out to the flanks, leaving the centre clear for the cast.
        for (let i = 0; i < 6; i++) {
          const tt = t - 3.25 - i * 0.36;
          if (tt <= 0) continue;
          const target = i < 3 ? 150 + i * 26 : 470 + (i - 3) * 24;
          const dir: 1 | -1 = target > doorC ? 1 : -1;
          const w = walker(tt, target, 1.5, (i % 3 - 1) * 4);
          if (w.moving) dust(w.x, tt + i, dir, 0.1);
          humanThroughDoorway(ctx, { ...doorway, k: w.inside ? w.k : 1 + w.walk }, {
            x: w.x,
            y: sill,
            s: 1.45,
            t: t + i * 0.7,
            look: crowdLook(i),
            pose: w.inside || w.walk < 1 ? 'walk' : t > 4.8 && i % 2 ? 'cheer' : i === 1 ? 'wave' : i === 4 ? 'point' : 'idle',
            walkPhase: tt * 4.2 + i,
            facing: w.walk < 0.98 ? dir : 1,
            dim: 0.38,
            rim: '#ffce85',
            lampOn: i % 2 === 0,
          });
        }
      }

      // Pip scouts first, then the adults follow with room to read each silhouette.
      const cast: Array<{ id: 'gus' | 'mara' | 'ilse' | 'pip'; start: number; target: number; direction: 1 | -1; s: number; lane: number; walkDur: number }> = [
        { id: 'pip', start: 1.72, target: 236, direction: -1, s: 1.8, lane: -4, walkDur: 1.1 },
        { id: 'gus', start: 2.05, target: 344, direction: 1, s: 2.15, lane: 3, walkDur: 1.25 },
        { id: 'mara', start: 2.42, target: 396, direction: 1, s: 2.15, lane: -2, walkDur: 1.3 },
        { id: 'ilse', start: 2.8, target: 452, direction: 1, s: 2.1, lane: 4, walkDur: 1.35 },
      ];
      cast.forEach((person, i) => {
        const tt = t - person.start;
        if (tt <= 0) return;
        const w = walker(tt, person.target, person.walkDur, person.lane);
        if (w.moving) dust(w.x, tt + i * 0.4, person.direction);
        humanThroughDoorway(ctx, { ...doorway, k: w.inside ? w.k : 1 + w.walk }, {
          x: w.x,
          y: sill,
          s: person.s,
          rim: '#ffd9a0',
          lampOn: true,
          t: t + i * 0.26,
          look: human(person.id),
          pose: w.inside || w.walk < 1 ? 'walk' : person.id === 'pip' ? 'wave' : person.id === 'ilse' && t > 4.4 ? 'wave' : 'idle',
          walkPhase: tt * 4.5,
          facing: w.walk < 0.98 ? person.direction : 1,
          talking: person.id === 'ilse' && t > 4.2 && t < 6.4,
          flipProp: person.id === 'gus' ? 'wrench' : person.id === 'ilse' ? 'lantern' : null,
        });
        if (person.id === 'ilse' && !w.inside) {
          glowAt(ctx, w.x + 10, sill - 28, 20, '#ffd9a0', 0.1 + 0.03 * Math.sin(t * 3 + i));
        }
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
        const appear = ease((t - 4.2) / 0.22) * (1 - ease((t - 6.35) / 0.35));
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
   *  10. A PROMISE — ONE CELL, ONE OWNER, A MUTUAL PACT
   * ================================================================ */
  {
    id: 'the-deal',
    chapter: '10 / A PROMISE',
    set: 'outpost',
    duration: PROMISE_DURATION,
    speaker: 'mara',
    text: '"Take our last power cell. Mine for us, and we will keep you running." CUBE took it gently. For the first time, he had a home.',
    sfx: 'boot',
    draw(ctx, t) {
      drawPromiseScene(ctx, t);
    },
  },

  /* ================================================================ *
   *  11. INTO THE DEEP: GEOLOGICAL STRATA, TIMBERS AND MINERAL VEINS
   * ================================================================ */
  {
    id: 'first-shift',
    chapter: '11 / INTO THE DEEP',
    set: null,
    duration: 7.4,
    text: 'Through wet limestone and ancient basalt, the cage descended. Far below, a strange golden light waited.',
    sfx: 'whoosh',
    draw(ctx, t, duration) {
      drawShaftScene(ctx, t, duration);
    },
  },

  /* ================================================================ *
   *  12. THE SUNKEN RIFT: CONTINUOUS LIMESTONE AND A WALL-ROOTED SULFUR VEIN
   * ================================================================ */
  {
    id: 'sulfured-caves',
    chapter: '12 / THE SUNKEN RIFT',
    set: null,
    duration: CALDERA_DURATION,
    text: 'The cage left him at the old mine’s lowest adit. CUBE-07 rolled onto a limestone ledge and found the Heart of Sulfur—power enough to keep his new home alive.',
    draw(ctx, t) {
      drawCalderaScene(ctx, t);
    },
  },
];

for (const scene of CUTSCENE) {
  const draw = scene.draw;
  scene.draw = (ctx, t, duration) => {
    ctx.save();
    // Only shots without their own camera receive a push. Applying it to every
    // scene doubled the workshop/dolly zoom and enlarged supposedly fixed HUDs.
    if (scene.id === 'outdated' || scene.id === 'survivors') {
      const push = 1.012 + easeInOut(clamp(t / duration)) * 0.018;
      ctx.translate(320, 180);
      ctx.scale(push, push);
      ctx.translate(-320, -180);
    }
    draw(ctx, t, duration);
    ctx.restore();
    storyAtmosphere(ctx, scene.id, t, duration);
  };
}

const SCENE_JOBS: Record<string, Job<unknown>[]> = {
  'sky-city': storySetJobs('aether'),
  birth: storySetJobs('foundry'),
  outdated: storySetJobs('new-aether'),
  'self-repair': [workshopJob],
  'cast-out': [disposalJob],
  'free-fall': [earthJob, landJob],
  impact: [landJob],
  'old-mine': [mineJob],
  survivors: storySetJobs('outpost'),
  'the-deal': storySetJobs('outpost'),
  'first-shift': [shaftJob],
  'sulfured-caves': [calderaJob],
};

/**
 * Non-blocking scene preparation: raise build priority for the scene that is
 * about to play (and the one after it). Nothing is built synchronously here —
 * `pumpWarm` in the player loop does the work a few ms per frame.
 */
export function prepareScene(index: number) {
  const scene = CUTSCENE[index];
  if (!scene) return;
  if (scene.set) prepareStorySet(scene.set);
  for (const job of Object.values(SCENE_JOBS).flat()) job.priority = Math.min(job.priority, 1);
  const bump = (i: number, pr: number) => {
    const s = CUTSCENE[i];
    if (!s) return;
    for (const job of SCENE_JOBS[s.id] ?? []) job.priority = Math.max(job.priority, pr);
  };
  bump(index, 10);
  bump(index + 1, 6);
  bump(index + 2, 3);
}

/** True when the current and next scene's heavy assets are already built. */
export function sceneAssetsReady(index: number) {
  return [index, index + 1].every((i) => {
    const s = CUTSCENE[i];
    return !s || ((SCENE_JOBS[s.id] ?? []).every((j) => j.ready) && (!s.set || storySetJobs(s.set).every((j) => j.ready)));
  });
}
