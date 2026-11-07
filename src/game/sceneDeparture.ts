import { clamp, hash, heroRobot } from './cutsceneArt';
import { makeCanvas } from './cineKit';
import { AETHER_OFFICIAL, AETHER_OFFICIAL_B, cinematicHuman } from './cineHumans';
import { drawStorySet } from './storyWorlds';
import { ellipse, metal, pixelGlow, pixelLine, polygon, px } from './pixelCraft';

export const DEPARTURE_DURATION = 9.8;
const FLOOR = 258;
const CAR_LEFT = 426;
const CAR_WIDTH = 158;
const STOP = 6.5;
const INK = '#0a1520';
const glide = (x: number) => { const t = clamp(x); return t * t * t * (10 + t * (-15 + t * 6)); };
const SCIENTISTS = [
  { look: AETHER_OFFICIAL, startX: 254, berth: 474, start: 3.05, end: 5.35, s: 2.05 },
  { look: AETHER_OFFICIAL_B, startX: 300, berth: 534, start: 3.55, end: 5.8, s: 2.0 },
] as const;

/** One floor coordinate system for the boarding figures, carriage and platform. */
export function scientistDepartureAt(t: number) {
  const offset = glide((t - STOP) / 3.15) * 400;
  const rail = glide((t - 5.95) / 0.5);
  const scientists = SCIENTISTS.map((s) => {
    const walk = glide((t - s.start) / (s.end - s.start));
    const distance = (s.berth - s.startX) * walk;
    const boarded = t >= s.end;
    const x = s.startX + distance + (boarded ? offset : 0);
    const half = s.s * 7.5;
    return {
      x, y: FLOOR, walk, distance, boarded,
      leftBoot: x - half, rightBoot: x + half,
      supported: boarded
        ? x - half >= CAR_LEFT + offset && x + half <= CAR_LEFT + CAR_WIDTH + offset
        : x - half >= 0 && x + half <= 720,
    };
  });
  return { offset, rail, scientists, floor: FLOOR, departing: t >= STOP };
}

let carriage: HTMLCanvasElement | null = null;
function carriageBack() {
  if (carriage) return carriage;
  const [c, g] = makeCanvas(184, 146);
  // Open-front observation tram: no door or wall crosses the boarding path.
  metal(g, 4, 50, 164, 74, '#365566', 2, 164);
  polygon(g, [[5, 51], [15, 40], [155, 40], [169, 51]], '#89a7ae');
  px(g, 6, 51, 160, 2, '#d2e0d4');
  for (let i = 0; i < 3; i++) {
    const x = 18 + i * 48;
    px(g, x, 58, 40, 39, '#112c3b');
    px(g, x + 1, 59, 38, 37, '#64909c');
    px(g, x + 2, 60, 35, 2, '#bed6ce');
    pixelLine(g, [x + 5, 88], [x + 31, 62], '#82a9b0', 2);
    px(g, x, 97, 40, 2, '#a2bbbc');
    // Fixed benches belong to the back wall, behind the standing passengers.
    metal(g, x, 104, 40, 8, '#9b9c83', 6, 40);
    px(g, x + 4, 112, 3, 12, '#223c4a');
    px(g, x + 32, 112, 3, 12, '#223c4a');
  }
  // Roof is hung from two bogies on an overhead guideway.
  metal(g, 0, 44, 174, 6, '#77999f', 3, 29);
  for (const x of [22, 144]) {
    metal(g, x, 13, 5, 31, '#516e7c', x, 5);
    px(g, x + 1, 14, 1, 30, '#c4d3c8');
    px(g, x - 8, 5, 20, 8, INK);
    ellipse(g, x - 3, 8, 4, 4, '#708a91');
    ellipse(g, x + 8, 8, 4, 4, '#708a91');
    px(g, x - 3, 8, 1, 1, '#dce5d7');
    px(g, x + 8, 8, 1, 1, '#dce5d7');
  }
  // Floor shares the exact boarding-deck baseline.
  metal(g, 3, 124, 166, 8, '#647c82', 8, 18);
  px(g, 5, 124, 162, 1, '#d4d1b1');
  for (let x = 7; x < 167; x += 10) px(g, x, 129, 5, 2, '#cbab52');
  px(g, 8, 45, 156, 1, '#152a38');
  g.font = '5px "Press Start 2P", monospace';
  g.fillStyle = '#c4ded7';
  g.fillText('PERSONNEL / A-04', 44, 119);
  carriage = c;
  return c;
}

function patrol(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dir: number, inspector = false) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(dir, 1);
  px(ctx, -20, 0, 10, 1, 'rgba(103,190,215,0.25)');
  polygon(ctx, [[-12, -2], [-7, -6], [9, -5], [17, 0], [9, 4], [-8, 3]], INK);
  polygon(ctx, [[-10, -2], [-6, -4], [8, -4], [14, 0], [8, 2], [-7, 1]], '#dbe4da');
  px(ctx, 1, -2, 9, 3, '#234d64');
  px(ctx, 3, -1, 6, 1, inspector ? '#e49786' : '#83d3e2');
  px(ctx, -5, 4, 11, 1, '#75b2bf');
  if (inspector) pixelGlow(ctx, 8, 0, 14, '#ef7d60', 0.17 + Math.sin(t * 4) * 0.03);
  ctx.restore();
}

export function drawScientistDeparture(ctx: CanvasRenderingContext2D, t: number) {
  drawStorySet(ctx, 'new-aether', 0, t);
  const pose = scientistDepartureAt(t);
  // Continuous deck and guideway: neither ends underneath a person.
  metal(ctx, 0, FLOOR, 720, 9, '#a0b3b1', 12, 30);
  metal(ctx, 407, 133, 313, 7, '#506e7d', 7, 36);
  px(ctx, 408, 134, 312, 1, '#cfdbcf');
  for (const x of [407, 618]) {
    metal(ctx, x, 140, 5, 118, '#3c5867', x, 5);
    polygon(ctx, [[x + 5, 140], [x + 24, 140], [x + 5, 160]], '#718994');
  }
  px(ctx, 419, FLOOR - 1, 177, 1, '#f0d087');
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.fillStyle = '#afc7c4'; ctx.fillText('TRANSFER PLATFORM', 424, 284);
  for (let i = 0; i < 3; i++) {
    const dir = i % 2 ? -1 : 1;
    const x = dir > 0 ? ((t * (55 + i * 13) + i * 207) % 790) - 70 : 710 - ((t * 62 + i * 153) % 790);
    patrol(ctx, x, 52 + i * 26, t, dir);
  }

  heroRobot(ctx, { x: 112, y: FLOOR - 15 * 4.05, s: 4.05, t, state: 'sad',
    drill: false, paintMix: 0.06, look: 1, eye: t > 6.7 ? 'scan' : 'normal' });

  const carX = CAR_LEFT + pose.offset;
  ctx.drawImage(carriageBack(), carX - 7, FLOOR - 124);
  pose.scientists.forEach((person, i) => {
    const definition = SCIENTISTS[i];
    const moving = person.walk > 0 && !person.boarded;
    const pointing = i === 0 && t > 1.5 && t < definition.start;
    cinematicHuman(ctx, {
      x: person.x, y: person.y, s: definition.s, t: t + i * 0.7,
      look: definition.look, outfit: 'official',
      pose: moving ? 'walk' : pointing ? 'point' : 'hold',
      // Stride follows distance travelled. The legs stop when the car carries them.
      walkPhase: person.distance / 8.4,
      facing: t < definition.start || (i === 1 && t > 5.9) ? -1 : 1,
      talking: pointing, flipProp: i === 1 ? 'clipboard' : null, rim: '#bad9da',
    });
  });

  // Front safety rail folds up AFTER both passengers' feet are safely on the floor.
  if (pose.rail > 0) {
    const y = FLOOR - 3 - pose.rail * 22;
    for (const x of [carX + 6, carX + CAR_WIDTH - 5]) {
      pixelLine(ctx, [x, FLOOR], [x, y], INK, 3);
      pixelLine(ctx, [x + 1, FLOOR - 1], [x + 1, y], '#84a2a7');
    }
    px(ctx, carX + 7, y, CAR_WIDTH - 12, 2, '#b5c8bb');
    px(ctx, carX + 7, y + 2, CAR_WIDTH - 12, 1, '#253d4c');
  }
  const green = t > 6.3;
  px(ctx, carX + CAR_WIDTH - 7, FLOOR - 8, 4, 3, green ? '#a1d9bb' : '#e0b363');
  if (t < 7.4) pixelGlow(ctx, carX + CAR_WIDTH / 2, FLOOR - 88, 50, '#9ebdc3', 0.08);

  const inspectorX = 338 + Math.sin(t * 0.7) * 3;
  patrol(ctx, inspectorX, 80, t, -1, true);
  // Verdict disappears before boarding, leaving the departure unobstructed.
  const verdict = glide((t - 1.15) / 0.6) * (1 - glide((t - 3.9) / 0.6));
  if (verdict > 0.01) {
    ctx.save(); ctx.globalAlpha = verdict;
    px(ctx, 198, 108, 240, 49, '#101c28');
    px(ctx, 198, 108, 240, 2, '#d18c7d');
    px(ctx, 201, 111, 234, 43, '#342229');
    ctx.textAlign = 'center'; ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#f1c0a2'; ctx.fillText('DECOMMISSION', 318, 128);
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#c2a4a0'; ctx.fillText('CUBE-07 / TRANSFER TO RECLAMATION', 318, 145);
    ctx.restore();
  }
  // Subtle wind without random allocations or extra scene-wide overlays.
  for (let i = 0; i < 8; i++) {
    const x = (hash(i * 4.1) * 700 + t * 5) % 700;
    px(ctx, x, 285 + hash(i) * 40, 1, 1, '#6f8b96');
  }
}