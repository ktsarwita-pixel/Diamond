import { clamp, cloudSprite, easeInOut, hash } from './cutsceneArt';
import { Job, hex3, lerp3, makeCanvas, makeNoise, paintPixelsGen, smooth } from './cineKit';
import { AETHER_TECH, cinematicHuman } from './cineHumans';
import { drawBuilding } from './outpostArt';
import { isLite } from './quality';
import { cable, ellipse, gear, metal, pipe, pixelGlow, pixelLine, polygon, px, rockTextureGen, windowGrid, type Point } from './pixelCraft';
import { landJob } from './sceneImpact';

export type StorySet = 'aether' | 'foundry' | 'new-aether' | 'exile' | 'workshop' | 'outpost';
export const NEW_AETHER_DECK_RIGHT = 720;

const skyJob = new Job(function* () {
  const [c, g] = makeCanvas(800, 360);
  const n = makeNoise(2200);
  const top = hex3('#153047');
  const bottom = hex3('#e2b58a');
  yield* paintPixelsGen(g, 0, 0, 800, 360, (x, y, out) => {
    const k = y / 360;
    let col = lerp3(top, bottom, k * k * 0.8 + k * 0.2);
    const sun = Math.max(0, 1 - Math.hypot((x - 570) * 0.8, y - 185) / 230);
    col = lerp3(col, hex3('#ffe3ab'), sun * 0.5);
    const clouds = n.fbm(x * 0.004, y * 0.025, 4);
    const cover = smooth(0.49, 0.67, clouds) * smooth(50, 140, y);
    const lit = n.noise(x * 0.007, y * 0.08);
    col = lerp3(col, lerp3(hex3('#6e8793'), hex3('#f5ddba'), Math.round(lit * 5) / 5), cover * 0.9);
    const jitter = ((x & 1) === (y & 1) ? 1 : -1) * 1.5;
    out[0] = col[0] + jitter; out[1] = col[1] + jitter; out[2] = col[2] + jitter; out[3] = 255;
  });
  return c;
});

function* cityAsset(modern: boolean): Generator<void, HTMLCanvasElement, unknown> {
  const [c, g] = makeCanvas(640, 360);
  const deck = 228;
  const rim = modern ? '#aabfca' : '#aaa994';
  const lit = modern ? '#e2e9df' : '#e0d9bb';
  const rock: Point[] = [[87, deck], [553, deck], [533, 259], [498, 270], [467, 300], [433, 293],
    [390, 321], [370, 317], [331, 349], [306, 326], [284, 332], [247, 301], [209, 294], [183, 273], [139, 266]];
  yield* rockTextureGen(g, rock, '#273b48', '#8e8a73', modern ? 3 : 2);
  yield;
  for (let i = 0; i < 10; i++) {
    const y = deck + 9 + i * 8;
    const w = 400 - i * 33;
    px(g, 320 - w / 2, y, w, 1, i % 3 ? '#53616a' : '#a59470');
  }
  for (let i = 0; i < 5; i++) {
    const w = 148 - i * 21;
    ellipse(g, 330, 294 + i * 4, w, 7 - i, '#14242e');
    pixelLine(g, [330 - w, 294 + i * 4], [330 + w, 294 + i * 4], '#6cafa7');
  }
  metal(g, 84, deck - 6, 474, 12, '#697f8a', 14, 24);
  px(g, 85, deck - 6, 471, 2, '#e7d9b3');
  for (let i = 0; i < 13; i++) {
    const x = 104 + i * 34;
    px(g, x, deck - 4, 14, 1, '#a3ccc3');
  }
  const towers = [[139, 25, 73], [177, 34, 104], [222, 31, 136], [266, 42, 164],
    [319, 48, 190], [380, 35, 148], [427, 33, 122], [471, 28, 91], [513, 23, 65]];
  towers.forEach(([x, w, h], i) => {
    const top = deck - h;
    const setback = 6 + i % 3;
    polygon(g, [[x - 1, deck], [x - 1, top + 15], [x + setback, top], [x + w - 5, top], [x + w + 6, top + 15], [x + w + 6, deck]], '#172d3c');
    polygon(g, [[x + w - 4, deck], [x + w - 4, top + 6], [x + w + 5, top + 16], [x + w + 5, deck]], '#556e7a');
    px(g, x, top + 17, w - 4, h - 18, lit);
    px(g, x, top + 17, 4, h - 18, '#8faaa9');
    polygon(g, [[x, top + 17], [x + setback, top + 2], [x + w - 6, top + 2], [x + w - 4, top + 17]], rim);
    for (let wy = top + 24; wy < deck - 10; wy += 6) {
      for (let wx = x + 5; wx < x + w - 7; wx += 5) {
        px(g, wx, wy, 3, 4, hash(wy + wx * 2) > 0.84 ? '#f6d795' : modern ? '#688f9b' : '#648183');
        px(g, wx, wy, 1, 4, '#acc8c3');
      }
      if ((wy - top) % 24 === 0) px(g, x - 2, wy + 5, w + 5, 2, '#657b7e');
    }
    const antenna = x + w / 2;
    px(g, antenna, top - 12 - i % 3 * 3, 1, 13 + i % 3 * 3, '#e9dcbf');
    px(g, antenna - 1, top - 13 - i % 3 * 3, 3, 2, '#e5b380');
    if (modern && i % 2 === 0) {
      polygon(g, [[x - 7, top + 35], [x + w + 5, top + 28], [x + w + 5, top + 34], [x - 7, top + 41]], '#a6c8c6');
    }
  });
  yield;
  for (const [x, w] of [[193, 52], [348, 58], [444, 40]]) {
    ellipse(g, x, deck - 16, w / 2, 24, '#243e49');
    ellipse(g, x, deck - 16, w / 2 - 2, 22, '#9cbfc0');
    for (let a = -1; a <= 1; a += 0.5) pixelLine(g, [x + a * w / 3, deck - 34], [x + a * w / 2, deck - 3], '#d6dfce');
    px(g, x - w / 2, deck - 3, w, 3, '#6d876e');
    for (let i = 0; i < 5; i++) {
      ellipse(g, x - w / 3 + i * w / 7, deck - 5 - hash(i) * 7, 4, 6, '#4f795d');
    }
  }
  // The expressway wraps around the architecture rather than sitting on its skyline.
  cable(g, [123, deck - 29], [523, deck - 29], 16, '#223e49', 5);
  cable(g, [123, deck - 31], [523, deck - 31], 16, '#c8cfb7', 2);
  for (const x of [220, 499]) {
    metal(g, x - 4, deck - 3, 10, 9, '#697f8a', x, 10);
    px(g, x - 2, deck + 5, 6, 2, '#dae9d6');
  }
  return c;
}
export const aetherCityJob = new Job(() => cityAsset(false));
export const modernCityJob = new Job(() => cityAsset(true));
export function getAetherCity() { return modernCityJob.get(); }
function city(modern: boolean) { return (modern ? modernCityJob : aetherCityJob).peek(); }

function drawSky(ctx: CanvasRenderingContext2D, t: number, pan: number) {
  const sky = skyJob.peek();
  if (sky) ctx.drawImage(sky, -Math.round(pan * 0.13), 0);
  else { ctx.fillStyle = '#5a7a8c'; ctx.fillRect(0, 0, 640, 360); }
  const spr = city(false);
  for (const [x, y, s] of [[-100, 94, 0.25], [530, 116, 0.31], [300, 88, 0.18]]) {
    if (!spr) break;
    ctx.save(); ctx.globalAlpha = 0.22;
    ctx.drawImage(spr, Math.round(x - pan * 0.25), y, Math.round(640 * s), Math.round(360 * s)); ctx.restore();
  }
  for (let i = 0; i < 7; i++) {
    const x = ((i * 131 + t * 4 + 120) % 940) - 180;
    ctx.globalAlpha = 0.24;
    const cloud = cloudSprite(910 + i, 190, 64, '#f2dcc0', '#b2bec1', '#738b9d');
    ctx.drawImage(cloud, Math.round(x), 254 + i % 3 * 25);
  }
  ctx.globalAlpha = 1;
}

function* industrialSet(kind: IndustrialKind): Generator<void, HTMLCanvasElement, unknown> {
  const [c, g] = makeCanvas(720, 360);
  if (kind === 'foundry' || kind === 'workshop') {
    const clean = kind === 'foundry';
    const base = clean ? '#1e3544' : '#292f32';
    px(g, 0, 0, 720, 360, '#111f2a');
    // Vanishing-point floor panels establish a physical room behind the actors.
    px(g, 0, 206, 720, 154, clean ? '#2e434b' : '#3d3c36');
    for (let x = -500; x <= 1200; x += 68) pixelLine(g, [360 + (x - 360) * 0.1, 201], [x, 360], '#172932');
    for (let y = 208, step = 4; y < 360; step *= 1.5, y += step) {
      pixelLine(g, [0, y], [720, y], clean ? '#52636a' : '#605c4c');
    }
    yield;
    for (let i = 0; i < 6; i++) {
      const x = 15 + i * 127;
      metal(g, x, 51, 113, 156, base, 51 + i, 113);
      windowGrid(g, x + 9, 62, 93, 47, clean ? '#83b4bf' : '#91b3b4');
      metal(g, x + 9, 129, 92, 64, clean ? '#2e4c59' : '#424846', 2, 12);
      vent(g, x + 19, 143, 38, 20);
      if (clean) {
        px(g, x + 64, 140, 27, 23, '#102a39');
        for (let j = 0; j < 5; j++) px(g, x + 67, 144 + j * 3, 8 + hash(j + i) * 15, 1, '#759eaa');
      } else {
        for (let j = 0; j < 4; j++) {
          metal(g, x + 17 + j * 17, 169, 8, 20, j % 2 ? '#7e7361' : '#7d9091', 2, 8);
        }
      }
      metal(g, x - 4, 19, 7, 189, '#50636c', 4, 7);
      polygon(g, [[x - 4, 22], [x + 21, 43], [x - 4, 52]], '#687f82');
    }
    yield;
    for (let i = 0; i < 3; i++) {
      pipe(g, [[0, 10 + i * 10], [720, 10 + i * 10]], 3, i === 0 ? '#879c9c' : '#536970');
    }
    for (let x = 30; x < 720; x += 120) {
      metal(g, x, 42, 61, 5, '#5b6f72', 3, 61);
      px(g, x + 3, 47, 55, 2, clean ? '#c3dfd9' : '#e2d0a1');
      px(g, x + 25, 32, 2, 10, '#152b36');
    }
    if (clean) {
      metal(g, 0, 269, 720, 25, '#667b7b', 33, 18);
      px(g, 0, 275, 720, 9, '#162833');
      for (let x = 0; x < 720; x += 12) px(g, x, 277, 5, 4, '#9ca9a0');
    } else {
      metal(g, 70, 251, 570, 12, '#79684e', 38, 24);
      for (const x of [100, 210, 450, 604]) metal(g, x, 263, 9, 65, '#4e6267', 2, 9);
      for (let i = 0; i < 6; i++) {
        const x = 74 + i * 98;
        px(g, x, 267, 70, 1, '#171f23');
        px(g, x + 7, 275, 38, 2, '#8b846c');
      }
      metal(g, 658, 106, 29, 128, '#5e6e68', 9, 29);
      ellipse(g, 672, 105, 14, 5, '#acb3a0');
      pipe(g, [[670, 102], [670, 84], [620, 84]], 3, '#9ba28e');
    }
  } else {
    const deck = kind === 'exile' ? 240 : 258;
    const width = kind === 'exile' ? 432 : 720;
    px(g, 0, deck, width, 360 - deck, '#1e3442');
    metal(g, 0, deck, width, 9, '#bacac4', 71, 27);
    for (let x = 9; x < width; x += 40) {
      metal(g, x, deck + 17, 31, 62, '#4e6670', x, 31);
      vent(g, x + 4, deck + 27, 22, 16);
      px(g, x + 3, deck + 67, 24, 2, '#253b49');
    }
    yield;
    for (let x = 116; x < width; x += 34) {
      metal(g, x, deck - 23, 3, 22, '#7b969c', 8, 3);
      px(g, x - 1, deck - 23, 5, 1, '#e8dcc0');
    }
    px(g, 114, deck - 23, width - 118, 2, '#a8beb9');
    if (kind === 'exile') {
      metal(g, 0, 124, 114, 116, '#455e68', 47, 16);
      polygon(g, [[0, 126], [0, 111], [106, 111], [119, 126]], '#77878a');
      px(g, 17, 157, 82, 83, '#0c1c27');
      windowGrid(g, 12, 133, 85, 12, '#9db9b9');
      label(g, 'RECLAMATION', 10, 154, '#c1d0bf', 5);
      px(g, 431, deck + 4, 2, 116, '#bac9bd');
    }
  }
  return c;
}

function vent(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  px(ctx, x, y, w, h, '#142630');
  for (let yy = y + 2; yy < y + h; yy += 3) px(ctx, x + 2, yy, w - 4, 1, '#657b7b');
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number) {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'left'; ctx.fillStyle = color; ctx.fillText(text, x, y);
}

type IndustrialKind = 'foundry' | 'workshop' | 'exile' | 'new-aether';
const industrialJobs = new Map<IndustrialKind, Job<HTMLCanvasElement>>(
  (['foundry', 'workshop', 'exile', 'new-aether'] as const).map(kind => [kind, new Job(() => industrialSet(kind))])
);
const yardJob = new Job(function* () {
  const [c, g] = makeCanvas(720, 84);
  const colors = ['#4a4c40', '#4f5043', '#555547', '#5a5848', '#5c5a49', '#62604d'];
  for (let y = 0; y < 84; y += 2) for (let x = 0; x < 720; x += 2) {
    const k = hash(x * 2.7 + y * 4.1);
    px(g, x, y, 2, 2, colors[Math.floor(k * colors.length)]);
  }
  for (const y of [3, 13, 28, 50, 81]) {
    pixelLine(g, [0, y], [720, y], '#343d38');
    pixelLine(g, [0, y + 1], [720, y + 1], '#797461');
  }
  for (let x = -300; x < 1000; x += 110) pixelLine(g, [360 + (x - 360) * 0.5, 0], [x, 84], '#343d38');
  for (let i = 0; i < 160; i++) {
    const x = hash(i * 7.7) * 720;
    const y = hash(i * 4.3) * 84;
    px(g, x, y, 1 + hash(i) * 3, 1, i % 2 ? '#3b4138' : '#a39972');
  }
  return c;
});

export function storySetJobs(kind: StorySet): Job<unknown>[] {
  if (kind === 'aether') return [skyJob, aetherCityJob];
  if (kind === 'new-aether' || kind === 'exile') return [skyJob, modernCityJob, industrialJobs.get(kind)!];
  if (kind === 'outpost') return [landJob, yardJob];
  return [industrialJobs.get(kind)!];
}
export function prepareStorySet(kind: StorySet) {
  for (const job of storySetJobs(kind)) job.priority = Math.max(job.priority, 8);
}
function drawIndustrial(ctx: CanvasRenderingContext2D, kind: IndustrialKind, pan: number) {
  const set = industrialJobs.get(kind)!.peek();
  if (set) ctx.drawImage(set, -Math.round(pan), 0);
  else {
    // Lightweight, opaque stand-in while the prioritized builder finishes.
    const deck = kind === 'exile' ? 240 : kind === 'new-aether' ? 258 : 270;
    px(ctx, 0, 0, 640, 360, kind === 'new-aether' || kind === 'exile' ? '#5a7a8c' : '#1b2c35');
    px(ctx, 0, deck, 640, 360 - deck, '#344b55');
    px(ctx, 0, deck, 640, 2, '#91a6a5');
  }
}

export function drawStorySet(ctx: CanvasRenderingContext2D, kind: StorySet, pan: number, t: number) {
  pan = clamp(pan, 0, 80);
  if (kind === 'aether' || kind === 'new-aether' || kind === 'exile') {
    drawSky(ctx, t, pan);
    if (kind === 'aether') {
      const island = city(false);
      if (island) ctx.drawImage(island, Math.round(57 - pan * 0.7), -5);
      else {
        polygon(ctx, [[140, 223], [610, 223], [550, 270], [380, 340], [220, 280]], '#344653');
        for (let i = 0; i < 9; i++) px(ctx, 195 + i * 43, 100 - Math.sin(i / 8 * Math.PI) * 65, 30, 123, '#8fa6a6');
      }
      // Water is drawn separately so its flow never freezes with the cached island.
      for (const x of [220, 499]) {
        for (let i = 0; i < 24; i++) {
          const y = 236 + ((t * 28 + i * 5) % 102);
          ctx.globalAlpha = (1 - (y - 236) / 102) * 0.65;
          px(ctx, x + 57 - pan * 0.7 + Math.sin(i) * 2, y, 2, 4, '#dae9d6');
        }
      }
      ctx.globalAlpha = 1;
      // Foreground observation deck and people make the scale of the city tangible.
      polygon(ctx, [[0, 326], [120, 326], [146, 360], [0, 360]], '#152d3a');
      px(ctx, 0, 325, 120, 2, '#a4b5ab');
      for (let x = 4; x < 120; x += 18) px(ctx, x, 307, 2, 18, '#5e7e86');
      px(ctx, 0, 307, 120, 1, '#c1caba');
      cinematicHuman(ctx, { x: 56, y: 325, s: 1.05, t, look: AETHER_TECH, pose: 'idle', dim: 0.34, facing: 1 });
      cinematicHuman(ctx, { x: 80, y: 325, s: 0.94, t: t + 1, look: AETHER_TECH, pose: 'point', dim: 0.5, facing: 1 });
      const train = (t * 45) % 400;
      const yy = 197 + 4 * 16 * (train / 400) * (1 - train / 400);
      metal(ctx, train + 180 - pan * 0.7, yy, 26, 5, '#a0c6c5', 1, 26);
    } else {
      const s = kind === 'exile' ? 0.58 : 0.63;
      const island = city(true);
      if (island) ctx.drawImage(island, 267 - Math.round(pan * 0.4), -25, 640 * s, 360 * s);
      drawIndustrial(ctx, kind, pan);
      for (const x of [66, 170, 285, 391]) {
        pixelGlow(ctx, x, kind === 'exile' ? 244 : 262, 18, '#b4d4cb', 0.08);
      }
    }
  } else if (kind === 'outpost') {
    const land = landJob.peek();
    if (land) ctx.drawImage(land, 0, 0, 640, 360, -pan * 0.14, 0, 730, 360);
    else { ctx.fillStyle = '#6c3a52'; ctx.fillRect(0, 0, 640, 206); ctx.fillStyle = '#5a3b2c'; ctx.fillRect(0, 206, 640, 154); }
    ctx.save(); ctx.translate(-Math.round(pan), 0);
    // One service pole between the refinery and the bunker, feeding both roofs.
    metal(ctx, 197, 158, 3, 110, '#5a4a38', 2, 3);
    px(ctx, 191, 160, 15, 3, '#0b0f16');
    px(ctx, 192, 161, 13, 1, '#7d6a52');
    cable(ctx, [192, 161], [168, 182], 6, '#1b2328');
    cable(ctx, [204, 161], [263, 204], 9, '#1b2328');
    metal(ctx, 0, 268, 720, 9, '#5b6566', 44, 18);
    const ground = yardJob.peek();
    if (ground) ctx.drawImage(ground, 0, 277);
    else px(ctx, 0, 277, 720, 83, '#4a4c40');
    for (const [x, w] of [[26, 162], [235, 182], [422, 114], [540, 170]]) {
      ctx.globalAlpha = 0.14;
      polygon(ctx, [[x, 276], [x + w, 276], [x + w + 46, 296], [x + 18, 296]], '#0c1b23');
    }
    ctx.globalAlpha = 1;
    drawBuilding(ctx, 'refinery', 26, 268, t, { id: 'story-refinery', lite: isLite() });
    drawBuilding(ctx, 'repair', 424, 268, t, { id: 'story-repair', lite: isLite() });
    drawBuilding(ctx, 'habitat', 243, 268, t, { id: 'story-habitat', door: smooth(0.5, 1.65, t), lite: isLite() });
    drawBuilding(ctx, 'forge', 560, 268, t, { id: 'story-forge', lite: isLite() });
    // A hand-sewn flag on a pole planted in the bunker's sandbags.
    px(ctx, 382, 200, 3, 52, '#0b0f16');
    px(ctx, 383, 200, 1, 52, '#9aa6a0');
    const wave = Math.round(Math.sin(t * 3) * 2);
    polygon(ctx, [[385, 202], [409, 204 + wave], [406, 217 + wave], [385, 216]], '#0b0f16');
    polygon(ctx, [[385, 203], [407, 205 + wave], [404, 216 + wave], [385, 215]], '#a9754c');
    px(ctx, 392, 207, 2, 6, '#dec99c');
    ctx.restore();
  } else {
    drawIndustrial(ctx, kind, pan);
    const clean = kind === 'foundry';
    for (let i = 0; i < 6; i++) {
      const x = 45 + i * 127 - pan;
      ctx.globalAlpha = 0.035;
      polygon(ctx, [[x, 49], [x + 55, 49], [x + 90, 270], [x - 36, 270]], clean ? '#c5e9e5' : '#f2d4a1');
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      gear(ctx, 36 + i * 270 - pan, 165, 9, t * (i % 2 ? -0.4 : 0.4), '#687f83');
    }
    if (!clean) {
      const hammer = Math.max(0, Math.sin(t * 2.8));
      metal(ctx, 674 - pan, 222 + hammer * 6, 19, 8, '#96a497', 2, 19);
    }
  }
}

/** Low-amplitude environmental movement, separate from the hero action in each shot. */
export function storyAtmosphere(ctx: CanvasRenderingContext2D, id: string, t: number, duration: number) {
  const underground = id === 'first-shift' || id === 'sulfured-caves';
  const industrialShot = id === 'birth' || id === 'self-repair';
  if (id === 'birth') {
    for (let i = 0; i < 4; i++) {
      const x = 70 + i * 160;
      px(ctx, x, 25, 18, 1, Math.floor(t * 2 + i) % 5 ? '#89b2af' : '#d4dcae');
    }
  }
  if (id === 'old-mine') {
    for (let i = 0; i < 15; i++) {
      const x = (i * 71 + t * 37) % 670 - 15;
      const y = 263 + hash(i) * 30;
      px(ctx, x, y, 2, 1, i % 3 ? '#8c7358' : '#ceb18b');
    }
  }
  if (id === 'first-shift') {
    const settle = easeInOut(clamp(t / duration));
    for (let i = 0; i < 5; i++) {
      const x = 288 + i * 15;
      const y = ((t * 36 + i * 63 - settle * 150) % 360 + 360) % 360;
      px(ctx, x, y, 1, 2, '#667d7d');
    }
  }
  if (underground || industrialShot) return;
  if (id === 'survivors' || id === 'the-deal') {
    for (let i = 0; i < 6; i++) {
      const x = 30 + ((t * 6 + i * 107) % 640);
      const y = 288 + Math.sin(t + i) * 5;
      ctx.globalAlpha = 0.13;
      px(ctx, x, y, 15 + hash(i) * 24, 1, '#d2b486');
    }
    ctx.globalAlpha = 1;
  }
}