import {
  CH,
  INK,
  R,
  aetherSprite,
  bunkerSprite,
  cartSprite,
  clamp,
  cloudSprite,
  glowAt,
  hash,
  headframeSprite,
  rgba,
  ridgeSprite,
  shade,
  shedSprite,
  skyCanvas,
} from './cutsceneArt';
import { sprites } from './sprites';
import { TileType } from './types';

export const SET_W = 720;
export type SetName =
  | 'aether'
  | 'foundry'
  | 'new-aether'
  | 'exile'
  | 'wasteland'
  | 'mine'
  | 'workshop'
  | 'outpost'
  | 'shaft'
  | 'heart';

const sets = new Map<SetName, HTMLCanvasElement>();

function makeSet(paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SET_W;
  canvas.height = CH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  paint(ctx);
  return canvas;
}

function grain(ctx: CanvasRenderingContext2D, top: number, bottom: number, count: number, colors: string[], seed: number) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(hash(seed + i * 3.7) * SET_W);
    const y = Math.floor(top + hash(seed + i * 8.3) * (bottom - top));
    const size = hash(seed + i * 1.3) > 0.86 ? 3 : 1;
    R(ctx, x, y, size, size, colors[i % colors.length]);
  }
}

function panels(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string, highlight: string) {
  R(ctx, x, y, w, h, INK);
  R(ctx, x + 2, y + 2, w - 4, h - 4, base);
  R(ctx, x + 3, y + 3, w - 6, 2, highlight);
  R(ctx, x + w - 5, y + 5, 2, h - 8, shade(base, -0.32));
  for (let iy = y + 12; iy < y + h - 8; iy += 13) {
    R(ctx, x + 5, iy, w - 10, 1, shade(base, -0.18));
  }
  for (const dx of [5, w - 8]) {
    for (const dy of [8, h - 9]) {
      R(ctx, x + dx, y + dy, 2, 2, highlight);
    }
  }
}

function rail(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: string) {
  R(ctx, x, y, width, 3, '#070911');
  R(ctx, x, y, width, 1, shade(color, 0.32));
  for (let px = x + 7; px < x + width - 4; px += 22) {
    R(ctx, px, y + 3, 3, 18, color);
    R(ctx, px + 2, y + 3, 1, 18, shade(color, -0.38));
  }
}

function warningStripes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  R(ctx, x, y, w, h, '#141620');
  for (let px = x; px < x + w; px += 12) {
    R(ctx, px, y, 6, h, '#e4aa2f');
    R(ctx, px, y, 2, 1, '#ffe7a1');
  }
}

function desert(ctx: CanvasRenderingContext2D) {
  ctx.drawImage(
    skyCanvas(
      [[0, '#181329'], [0.35, '#40304a'], [0.64, '#a06155'], [0.83, '#e19961'], [1, '#78503b']],
      SET_W,
      CH
    ),
    0,
    0
  );
  glowAt(ctx, 545, 115, 145, '#ffa870', 0.32);
  R(ctx, 526, 100, 38, 35, '#ffc385');
  R(ctx, 530, 103, 30, 29, '#ffe2a7');
  ctx.globalAlpha = 0.65;
  ctx.drawImage(ridgeSprite(118, SET_W, 126, '#62536a', '#493a58', '#322941'), 0, 136);
  ctx.globalAlpha = 1;
  ctx.drawImage(ridgeSprite(81, SET_W, 111, '#614452', '#4d3442', '#382630'), 0, 164);
  ctx.drawImage(ridgeSprite(29, SET_W, 97, '#7e554b', '#68433b', '#4f332e'), 0, 192);
  R(ctx, 0, 259, SET_W, CH - 259, '#6c4c3c');
  R(ctx, 0, 259, SET_W, 3, '#a06e50');
  for (let i = 0; i < 40; i++) {
    const x = (i * 53 + 11) % SET_W;
    const y = 262 + Math.floor(hash(i * 4.2) * 89);
    R(ctx, x, y, 6 + (i % 5), 1, '#9b6c4a');
    R(ctx, x + 3, y + 3, 2, 1, '#3f312d');
  }
  grain(ctx, 259, CH, 1000, ['#986647', '#524039', '#7c503c', '#ad8056'], 33);
  // Long dry cracks and small industrial remains.
  for (let i = 0; i < 12; i++) {
    const x = 28 + i * 59 + hash(i + 80) * 8;
    const y = 271 + hash(i + 19) * 56;
    R(ctx, x, y, 11, 1, '#42332f');
    R(ctx, x + 7, y + 1, 1, 4, '#42332f');
    R(ctx, x + 8, y + 4, 8, 1, '#42332f');
  }
  R(ctx, 62, 229, 4, 31, '#2e282c');
  R(ctx, 54, 230, 20, 3, '#2e282c');
  R(ctx, 60, 227, 10, 2, '#584138');
  R(ctx, 675, 245, 3, 16, '#322c2f');
  R(ctx, 669, 246, 15, 2, '#322c2f');
}

function refinery(ctx: CanvasRenderingContext2D, x: number, ground: number) {
  // Twin industrial smokestacks matching gameplay Refinery
  for (const [cxOff, hOff] of [[14, 44], [38, 34]] as const) {
    R(ctx, x + cxOff, ground - 92 - hOff, 18, hOff + 4, '#08060e');
    R(ctx, x + cxOff + 2, ground - 90 - hOff, 14, hOff, '#3d3849');
    R(ctx, x + cxOff + 2, ground - 90 - hOff, 4, hOff, '#685e7a');
    R(ctx, x + cxOff, ground - 86 - hOff, 18, 3, '#d97706');
  }
  // External ore intake hopper & conveyor belt on left
  R(ctx, x - 20, ground - 36, 22, 36, '#08060e');
  R(ctx, x - 18, ground - 34, 18, 16, '#473e54');
  R(ctx, x - 18, ground - 16, 20, 16, '#262030');
  for (let bx = x - 16; bx < x; bx += 6) {
    R(ctx, bx, ground - 20, 3, 3, '#eab308');
  }
  // Main smelter structure
  panels(ctx, x, ground - 92, 128, 92, '#332d3d', '#5c526e');
  R(ctx, x - 5, ground - 98, 138, 8, '#08060e');
  warningStripes(ctx, x - 3, ground - 96, 134, 5);
  // Roaring Blast Furnace Mouth
  R(ctx, x + 12, ground - 38, 40, 38, '#08060e');
  R(ctx, x + 15, ground - 35, 34, 35, '#7c2d12');
  R(ctx, x + 18, ground - 31, 28, 31, '#ea580c');
  R(ctx, x + 22, ground - 22, 20, 22, '#fde047');
  for (let a = 0; a < 5; a++) R(ctx, x + 18 + a * 6, ground - 34, 2, 34, '#1c1917');
  // Molten gold ingot mold trough on right
  R(ctx, x + 58, ground - 16, 62, 16, '#08060e');
  R(ctx, x + 60, ground - 14, 58, 14, '#292524');
  for (let m = 0; m < 3; m++) {
    R(ctx, x + 64 + m * 18, ground - 10, 13, 6, '#f59e0b');
    R(ctx, x + 66 + m * 18, ground - 10, 9, 3, '#fef08a');
  }
  // Signboard ($ REFINERY)
  R(ctx, x + 56, ground - 76, 66, 22, '#08060e');
  R(ctx, x + 58, ground - 74, 62, 18, '#1f1a2b');
  R(ctx, x + 58, ground - 74, 62, 2, '#eab308');
  ctx.font = 'bold 8px "Press Start 2P", monospace';
  ctx.fillStyle = '#fde047';
  ctx.fillText('$ REFINERY', x + 61, ground - 61);
}

function forge(ctx: CanvasRenderingContext2D, x: number, ground: number) {
  // Roof gantry crane jib + suspended spare drill bit (matching gameplay Forge)
  R(ctx, x + 14, ground - 110, 6, 24, '#08060e');
  R(ctx, x + 10, ground - 114, 54, 6, '#08060e');
  R(ctx, x + 16, ground - 108, 3, 22, '#64748b');
  R(ctx, x + 12, ground - 112, 50, 3, '#94a3b8');
  R(ctx, x + 44, ground - 106, 2, 12, '#cbd5e1');
  R(ctx, x + 39, ground - 95, 12, 6, '#f59e0b');

  // Main Forge Structure
  panels(ctx, x, ground - 86, 122, 86, '#26303f', '#526885');
  R(ctx, x - 4, ground - 92, 130, 8, '#08060e');
  R(ctx, x - 2, ground - 90, 126, 5, '#0ea5e9');
  R(ctx, x - 2, ground - 90, 126, 2, '#7dd3fc');

  // Plasma-arc fabrication bay door
  R(ctx, x + 12, ground - 46, 46, 46, '#08060e');
  R(ctx, x + 15, ground - 43, 40, 43, '#15202e');
  for (let y = ground - 39; y < ground - 3; y += 6) R(ctx, x + 15, y, 40, 2, '#0c1520');
  R(ctx, x + 15, ground - 24, 40, 2, '#38bdf8');

  // Twin interlocking cogwheels
  for (const [gx, gy, sz] of [[x + 74, ground - 26, 16], [x + 89, ground - 35, 12]] as const) {
    R(ctx, gx - sz / 2 - 1, gy - sz / 2 - 1, sz + 2, sz + 2, '#08060e');
    R(ctx, gx - sz / 2, gy - sz / 2, sz, sz, '#64748b');
    R(ctx, gx - 2, gy - 2, 4, 4, '#cbd5e1');
  }

  // External spare drill rack on right
  R(ctx, x + 96, ground - 22, 24, 22, '#08060e');
  R(ctx, x + 98, ground - 20, 20, 20, '#1e293b');
  R(ctx, x + 100, ground - 16, 4, 12, '#38bdf8');
  R(ctx, x + 106, ground - 16, 4, 12, '#f59e0b');
  R(ctx, x + 112, ground - 16, 4, 12, '#fde047');

  // Signboard (▲ FORGE)
  R(ctx, x + 64, ground - 72, 54, 20, '#08060e');
  R(ctx, x + 66, ground - 70, 50, 16, '#141c28');
  R(ctx, x + 66, ground - 70, 50, 2, '#38bdf8');
  ctx.font = 'bold 8px "Press Start 2P", monospace';
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText('▲ FORGE', x + 69, ground - 58);
}

function serviceBay(ctx: CanvasRenderingContext2D, x: number, ground: number) {
  for (const cxOff of [10, 26]) {
    R(ctx, x + cxOff, ground - 68, 10, 12, '#08060e');
    R(ctx, x + cxOff + 2, ground - 66, 6, 10, '#334155');
    R(ctx, x + cxOff + 2, ground - 62, 6, 2, '#4ade80');
  }
  panels(ctx, x, ground - 56, 68, 56, '#1d3329', '#3b6954');
  R(ctx, x - 3, ground - 60, 74, 6, '#08060e');
  R(ctx, x - 1, ground - 58, 70, 4, '#22c55e');
  R(ctx, x + 8, ground - 30, 24, 30, '#08060e');
  R(ctx, x + 10, ground - 28, 20, 28, '#0f2419');
  R(ctx, x + 12, ground - 22, 16, 2, '#4ade80');
  // Green medical/repair cross
  R(ctx, x + 42, ground - 38, 16, 5, '#4ade80');
  R(ctx, x + 47, ground - 43, 5, 15, '#4ade80');
}

function outpost(ctx: CanvasRenderingContext2D) {
  desert(ctx);
  // Elevated steel foundation, scale marks, mine warning pylons.
  R(ctx, 0, 268, SET_W, 10, '#1a1c25');
  R(ctx, 0, 269, SET_W, 4, '#5d6672');
  warningStripes(ctx, 0, 266, SET_W, 4);
  for (let x = 0; x < SET_W; x += 16) R(ctx, x, 276, 5, 3, '#75808d');
  refinery(ctx, 26, 267);
  serviceBay(ctx, 178, 267);
  forge(ctx, 520, 267);
  ctx.drawImage(bunkerSprite(), 267, 158, 180, 116);
  R(ctx, 307, 207, 94, 57, '#130f18');
  R(ctx, 312, 211, 84, 52, '#2a2434');
  R(ctx, 312, 211, 84, 2, '#70627c');
  R(ctx, 323, 225, 62, 38, '#100c15');
  // Cables along ground.
  R(ctx, 154, 264, 153, 2, '#34323c');
  R(ctx, 400, 264, 120, 2, '#34323c');
  R(ctx, 169, 258, 2, 10, '#756071');
  R(ctx, 508, 258, 2, 10, '#756071');
  grain(ctx, 272, CH, 140, ['#5a4c43', '#916c53', '#302a2a'], 129);
}

function cave(ctx: CanvasRenderingContext2D, core: boolean) {
  const base = core ? '#1b1525' : '#292535';
  const light = core ? '#443044' : '#504857';
  R(ctx, 0, 0, SET_W, CH, base);
  for (let x = 0; x < SET_W; x += 18) {
    for (let y = 0; y < CH; y += 18) {
      const seed = x * 0.9 + y * 1.3;
      R(ctx, x, y, 18, 18, hash(seed) > 0.7 ? shade(base, 0.1) : base);
      R(ctx, x, y, 14, 1, shade(base, -0.18));
      if (hash(seed + 3) > 0.65) R(ctx, x + 7, y + 11, 6, 1, light);
      if (hash(seed + 12) > 0.82) R(ctx, x + 4, y + 5, 2, 2, core ? '#d5a021' : '#8492ab');
    }
  }
  // A vaulted ceiling and a traversable ledge frame the shaft.
  R(ctx, 0, 170, SET_W, 145, core ? '#100d16' : '#0e101c');
  for (let x = 0; x < SET_W; x++) {
    const top = 60 + 16 * Math.sin(x * 0.019) + 9 * Math.sin(x * 0.067 + 2);
    R(ctx, x, top, 1, 6, light);
    R(ctx, x, top + 5, 1, 90, base);
    const floor = 288 + 9 * Math.sin(x * 0.025 + 1) + 6 * Math.sin(x * 0.11);
    R(ctx, x, floor, 1, CH - floor, base);
    R(ctx, x, floor, 1, 3, light);
  }
  for (let i = 0; i < 19; i++) {
    const x = 20 + i * 37;
    const len = 9 + hash(i * 13) * 29;
    for (let p = 0; p < len; p++) {
      const w = Math.max(1, 6 - Math.floor(p / 5));
      const y = 78 + 13 * Math.sin(x * 0.019) + p;
      R(ctx, x - w / 2, y, w, 1, p < 4 ? light : base);
    }
  }
  R(ctx, 0, 308, SET_W, 7, '#12111b');
  R(ctx, 0, 308, SET_W, 2, light);
  for (let x = 0; x < SET_W; x += 65) {
    R(ctx, x + 3, 309, 2, 27, shade(light, -0.32));
  }
  if (core) {
    for (let i = 0; i < 14; i++) {
      const x = hash(76 + i * 4) * SET_W;
      const y = 110 + hash(86 + i * 3) * 170;
      crystal(ctx, x, y, 3 + hash(i + 13) * 7, 12 + hash(i + 1) * 25, i % 4 === 0 ? '#dce439' : '#ef853f');
    }
  } else {
    const colors = ['#d9ba2b', '#3dc0a4', '#df7155', '#a783dc', '#4b9cd0'];
    for (let i = 0; i < 17; i++) {
      const x = hash(51 + i * 7) * SET_W;
      const y = 84 + hash(i + 34) * 210;
      if (x > 280 && x < 460 && y > 160) continue;
      crystal(ctx, x, y, 2 + hash(i) * 5, 7 + hash(i + 30) * 18, colors[i % colors.length]);
    }
  }
  grain(ctx, 90, CH - 18, 220, [light, shade(base, 0.14), '#676070'], core ? 198 : 181);
}

export function crystal(ctx: CanvasRenderingContext2D, x: number, bottom: number, w: number, h: number, color: string) {
  const ix = Math.round(x);
  const iy = Math.round(bottom);
  const iw = Math.max(3, Math.round(w));
  const ih = Math.max(7, Math.round(h));
  const deep = shade(color, -0.66);
  const shadow = shade(color, -0.34);
  const face = shade(color, 0.22);
  const shine = shade(color, 0.7);
  const side = shade(color, -0.1);
  // Row-by-row faceting keeps large shards angular rather than rectangular.
  for (let row = 0; row < ih; row++) {
    const p = row / ih;
    const expand = p < 0.22 ? 0.07 + (p / 0.22) * 0.93 : 1 - (p - 0.22) * 0.07;
    const width = Math.max(2, Math.round(iw * expand));
    const left = ix - Math.round(width * 0.52);
    const y = iy - ih + row;
    R(ctx, left - 2, y, width + 4, 1, INK);
    R(ctx, left, y, width, 1, shadow);
    R(ctx, left + 2, y, Math.max(1, width * 0.68), 1, color);
    R(ctx, left + 2, y, Math.max(1, width * 0.21), 1, face);
    R(ctx, left + width - 2, y, 1, 1, deep);
    if (row > 3 && row < ih - 4 && row % 3 !== 0) {
      R(ctx, left + Math.max(2, Math.round(width * 0.23)), y, 1, 1, shine);
    }
    if (row > ih * 0.27 && row % 4 === 0) {
      R(ctx, left + Math.round(width * 0.68), y, Math.max(1, width * 0.13), 1, side);
    }
  }
}

function drawSet(name: SetName, ctx: CanvasRenderingContext2D) {
  switch (name) {
    case 'aether': {
      ctx.drawImage(
        skyCanvas([[0, '#111733'], [0.38, '#303b70'], [0.69, '#b36d69'], [1, '#edb078']], SET_W, CH),
        0, 0
      );
      glowAt(ctx, 515, 184, 170, '#ffd192', 0.32);
      R(ctx, 497, 166, 39, 37, '#f8d6a8');
      ctx.globalAlpha = 0.42;
      ctx.drawImage(ridgeSprite(67, SET_W, 126, '#7a7193', '#5e577c', '#3f395e'), 0, 215);
      ctx.globalAlpha = 1;
      ctx.drawImage(aetherSprite(false), 153, 28, 485, 305);
      for (let i = 0; i < 4; i++) {
        const x = 45 + i * 155;
        R(ctx, x, 162 + (i % 2) * 26, 35, 5, '#373047');
        R(ctx, x + 8, 167 + (i % 2) * 26, 18, 8, '#211d31');
        R(ctx, x + 13, 154 + (i % 2) * 26, 2, 8, '#8bcce2');
      }
      break;
    }
    case 'new-aether': {
      ctx.drawImage(skyCanvas([[0, '#4f9ad3'], [0.54, '#98d0e9'], [1, '#d1edf2']], SET_W, CH), 0, 0);
      ctx.drawImage(aetherSprite(true), 314, -19, 344, 218);
      R(ctx, 0, 258, 410, 102, '#263242');
      R(ctx, 0, 258, 410, 6, '#dbeaf0');
      panels(ctx, 24, 264, 340, 76, '#c1cddb', '#ebf8f7');
      rail(ctx, 15, 238, 390, '#e1ecf5');
      for (let i = 0; i < 8; i++) {
        R(ctx, 42 + i * 39, 277, 8, 23, '#9aabbc');
        R(ctx, 42 + i * 39, 277, 8, 2, '#dce5ec');
      }
      warningStripes(ctx, 0, 260, 409, 5);
      break;
    }
    case 'exile': {
      ctx.drawImage(skyCanvas([[0, '#3a82ba'], [0.52, '#92c5e2'], [1, '#d9eef5']], SET_W, CH), 0, 0);
      ctx.drawImage(aetherSprite(true), 140, -28, 310, 195);
      // Main disposal deck (x = 0..432, y = 240..CH)
      R(ctx, 0, 240, 432, CH - 240, '#1e293b');
      R(ctx, 0, 240, 432, 6, '#e2e8f0');
      R(ctx, 0, 246, 432, 9, '#94a3b8');
      warningStripes(ctx, 0, 256, 432, 5);
      rail(ctx, 114, 216, 312, '#cbd5e1');
      R(ctx, 424, 238, 8, 38, '#64748b');
      R(ctx, 431, 240, 2, CH - 240, '#0f172a');

      // Reclamation Hangar Bay Building on the left (x = 0..114, y = 128..240)
      // The bulldozer sweeper mech emerges from this hangar bay doorway!
      panels(ctx, 0, 128, 114, 112, '#334155', '#64748b');
      R(ctx, 0, 124, 118, 6, '#0f172a');
      R(ctx, 0, 126, 116, 3, '#38bdf8');
      warningStripes(ctx, 14, 152, 88, 5);
      // Dark interior hangar bay opening (x = 18..98, y = 158..240)
      R(ctx, 16, 157, 84, 83, '#090d16');
      R(ctx, 20, 160, 76, 80, '#0f172a');
      // Interior ceiling strip light inside the hangar
      R(ctx, 32, 166, 52, 3, '#38bdf8');
      break;
    }
    case 'foundry': {
      // High-tech Aether Robotics Clean-Room Assembly Hall (Year 2200)
      R(ctx, 0, 0, SET_W, CH, '#0f172a');
      for (let x = 0; x < SET_W; x += 48) {
        R(ctx, x, 0, 44, CH, x % 96 === 0 ? '#1e293b' : '#162032');
        R(ctx, x + 1, 0, 2, CH, '#334155');
        R(ctx, x + 43, 0, 1, CH, '#090d16');
      }
      // Clean-room plasma induction bays & holographic schematic screens
      for (let i = 0; i < 6; i++) {
        const x = 22 + i * 114;
        panels(ctx, x, 124, 76, 92, '#1e293b', '#475569');
        R(ctx, x + 8, 136, 60, 56, '#091326');
        R(ctx, x + 10, 138, 56, 2, '#38bdf8');
        // Cyan schematic grid lines inside each bay
        for (let gy = 148; gy < 186; gy += 8) R(ctx, x + 14, gy, 48, 1, 'rgba(56,189,248,0.28)');
        // Glowing plasma core at bottom of bay
        R(ctx, x + 18, 174, 40, 14, '#0284c7');
        R(ctx, x + 24, 177, 28, 8, '#7dd3fc');
        R(ctx, x + 30, 179, 16, 4, '#e0f2fe');
        R(ctx, x + 4, 214, 68, 4, '#94a3b8');
      }
      for (const y of [16, 30, 48]) {
        R(ctx, 0, y, SET_W, 8, '#0f172a');
        R(ctx, 0, y, SET_W, 2, '#38bdf8');
        for (let x = 15; x < SET_W; x += 64) R(ctx, x, y - 2, 10, 12, '#334155');
      }
      // Assembly floor & conveyor track
      R(ctx, 0, 270, SET_W, 24, '#090d16');
      R(ctx, 0, 272, SET_W, 8, '#475569');
      for (let x = 0; x < SET_W; x += 18) R(ctx, x + 4, 275, 9, 3, '#cbd5e1');
      R(ctx, 0, 294, SET_W, CH - 294, '#1e293b');
      grain(ctx, 294, CH, 220, ['#334155', '#0f172a', '#64748b'], 45);
      break;
    }
    case 'wasteland':
      desert(ctx);
      break;
    case 'mine': {
      desert(ctx);
      // Weathered iron rail track with wooden ties running across the wasteland to Mine 07
      for (let tx = 0; tx < SET_W; tx += 14) {
        R(ctx, tx, 258, 8, 3, '#3f2a1d');
      }
      R(ctx, 0, 256, SET_W, 2, '#78716c');
      R(ctx, 0, 256, SET_W, 1, '#a8a29e');

      // Abandoned floodlight tower at x = 230
      R(ctx, 232, 168, 4, 91, '#292524');
      R(ctx, 233, 168, 1, 91, '#57534e');
      R(ctx, 224, 164, 18, 6, '#1c1917');
      R(ctx, 236, 165, 5, 4, '#fde68a');

      ctx.drawImage(headframeSprite(), 457, 59, 175, 199);
      ctx.drawImage(cartSprite(), 535, 228, 78, 54);
      // Rusted generator shed & ore chute on the left
      panels(ctx, 48, 204, 112, 55, '#413736', '#b19a79');
      warningStripes(ctx, 52, 204, 104, 5);
      R(ctx, 68, 224, 68, 24, '#170f13');
      R(ctx, 73, 229, 58, 15, '#755b45');
      R(ctx, 84, 226, 10, 12, '#b09562');
      for (let i = 0; i < 16; i++) {
        const x = 185 + hash(i + 25) * 245;
        R(ctx, x, 250, 9, 8, i % 2 ? '#544947' : '#775343');
        R(ctx, x + 3, 246, 5, 4, '#46343a');
      }
      break;
    }
    case 'workshop': {
      R(ctx, 0, 0, SET_W, CH, '#17131c');
      ctx.drawImage(shedSprite(), 70, 4, 570, 320);
      R(ctx, 0, 309, SET_W, 51, '#302731');
      R(ctx, 0, 309, SET_W, 3, '#887864');
      warningStripes(ctx, 0, 311, SET_W, 5);
      for (let x = 45; x < SET_W; x += 97) {
        R(ctx, x, 74, 5, 185, '#3b424d');
        R(ctx, x + 1, 74, 1, 185, '#8092a6');
      }
      for (let x = 33; x < SET_W; x += 71) {
        const y = 314 + hash(x * 8) * 31;
        R(ctx, x, y, 15, 9, '#23252c');
        R(ctx, x + 2, y + 2, 12, 5, x % 2 ? '#78624f' : '#818895');
      }
      break;
    }
    case 'outpost':
      outpost(ctx);
      break;
    case 'shaft': {
      cave(ctx, false);
      R(ctx, 300, 0, 130, CH, '#0b0e18');
      for (let i = 0; i < 19; i++) {
        const y = i * 20;
        R(ctx, 299, y, 3, 12, '#708090');
        R(ctx, 429, y, 3, 12, '#708090');
        R(ctx, 300, y, 130, 2, '#2b3949');
      }
      R(ctx, 0, 329, SET_W, 5, '#5a5263');
      break;
    }
    case 'heart': {
      sprites.ensureInit();
      // Monumental subterranean Sulfured Core Cathedral Cavern
      R(ctx, 0, 0, SET_W, CH, '#0b0713');

      // Deep background cavern backwall blocks + towering basalt pillars
      const bw = sprites.getBackwall(5) || sprites.getBackwall(4);
      if (bw) {
        ctx.globalAlpha = 0.55;
        for (let by = 0; by < CH; by += 16) {
          for (let bx = 0; bx < SET_W; bx += 16) {
            ctx.drawImage(bw, bx, by);
          }
        }
        ctx.globalAlpha = 1;
      }

      // Colossal distant cathedral rock ribs & magma fissures
      for (let i = 0; i < 8; i++) {
        const px = 28 + i * 94;
        const pw = 36 + (i % 3) * 14;
        R(ctx, px, 20, pw, 290, '#130d1e');
        R(ctx, px + 3, 20, 4, 290, '#231934');
        R(ctx, px + pw - 5, 20, 5, 290, '#08050d');
        // Glowing vertical magma veins in the pillars
        R(ctx, px + Math.floor(pw / 2), 90 + (i % 3) * 35, 3, 74, '#9a3412');
        R(ctx, px + Math.floor(pw / 2) + 1, 96 + (i % 3) * 35, 1, 60, '#fb923c');
      }

      // Minecraft-style stepped block ceiling arch
      for (let gx = 0; gx < Math.ceil(SET_W / 16); gx++) {
        const archRows = 2 + Math.floor(Math.sin(gx * 0.24) * 1.3 + Math.cos(gx * 0.55) * 0.8);
        for (let gy = 0; gy < Math.max(1, archRows); gy++) {
          const tType = gy === archRows - 1 && gx % 5 === 0 ? TileType.ORE_SULFUR : TileType.ABYSSAL_OBSIDIAN;
          const tile = sprites.getTileVariant(tType, 0, gy === archRows - 1 ? 2 : 0);
          if (tile) ctx.drawImage(tile, gx * 16, gy * 16);
        }
      }

      // Left foreground Minecraft-style block ledge (y = 288..360, x = 0..288)
      // Plus a 3-block-high Sulfur & Gold ore wall at x = 224..272 for CUBE-07 to drill!
      for (let gy = 14; gy < 23; gy++) {
        for (let gx = 0; gx < 18; gx++) {
          if (gy < 18 && gx < 14) continue; // Open space where CUBE-07 drives
          let tType = TileType.ABYSSAL_OBSIDIAN;
          if (gx >= 14 && gy >= 14 && gy < 18) {
            // Rich ore wall face for CUBE-07 to bore into!
            tType =
              (gx + gy) % 3 === 0
                ? TileType.ORE_HEART_OF_SULFUR
                : (gx + gy) % 2 === 0
                  ? TileType.ORE_SULFUR
                  : TileType.ORE_GOLD;
          } else if (gy === 18 && gx % 3 === 1) {
            tType = TileType.ORE_SULFUR;
          } else if (gy > 19 && (gx + gy) % 4 === 0) {
            tType = TileType.MAGMA_ROCK;
          }
          const mask = (gy === 18 && gx < 14 ? 1 : 0) | (gy === 14 && gx >= 14 ? 1 : 0) | (gx === 14 && gy < 18 ? 4 : 0) | (gx === 17 ? 8 : 0);
          const tile = sprites.getTileVariant(tType, 0, mask);
          if (tile) ctx.drawImage(tile, gx * 16, gy * 16);
        }
      }

      // Subterranean molten sulfur-amber lake in the central chasm (x = 288..416, y = 306..360)
      R(ctx, 288, 306, 132, CH - 306, '#3b2006');
      R(ctx, 288, 306, 132, 6, '#d97706');
      R(ctx, 288, 306, 132, 2, '#fef08a');
      for (let wy = 315; wy < CH; wy += 6) {
        R(ctx, 294 + ((wy * 7) % 16), wy, 106, 2, '#92400e');
      }

      // Right island Minecraft-style block pedestal (x = 416..SET_W, y = 288..360)
      for (let gy = 18; gy < 23; gy++) {
        for (let gx = 26; gx < Math.ceil(SET_W / 16); gx++) {
          const tType =
            gy === 18 && gx >= 29 && gx <= 38
              ? TileType.ORE_HEART_OF_SULFUR
              : (gx + gy) % 3 === 0
                ? TileType.ORE_SULFUR
                : TileType.ABYSSAL_OBSIDIAN;
          const mask = (gy === 18 ? 1 : 0) | (gx === 26 ? 4 : 0);
          const tile = sprites.getTileVariant(tType, 0, mask);
          if (tile) ctx.drawImage(tile, gx * 16, gy * 16);
        }
      }
      // Stepped obsidian & gold shrine altar base (y = 266..288)
      R(ctx, 444, 276, 196, 12, '#241a38');
      R(ctx, 444, 276, 196, 3, '#eab308');
      R(ctx, 464, 266, 156, 10, '#32244d');
      R(ctx, 464, 266, 156, 2, '#fde047');

      // COLOSSAL HEART OF SULFUR MONOLITH — massive golden-yellow crystal formation
      // towering nearly the full height of the cavern (238px tall)!
      glowAt(ctx, 542, 165, 220, '#f59e0b', 0.25);
      crystal(ctx, 462, 276, 48, 136, '#eab308');
      crystal(ctx, 618, 276, 50, 144, '#eab308');
      crystal(ctx, 496, 270, 64, 186, '#facc15');
      crystal(ctx, 586, 270, 66, 192, '#f59e0b');
      crystal(ctx, 542, 268, 96, 236, '#fde047'); // Central 236px tall colossus!
      crystal(ctx, 520, 268, 52, 204, '#fef08a');
      crystal(ctx, 566, 268, 54, 198, '#fbbf24');
      crystal(ctx, 436, 286, 32, 92, '#ca8a04');
      crystal(ctx, 644, 286, 34, 98, '#d97706');
      break;
    }
  }
}

export function getSet(name: SetName): HTMLCanvasElement {
  let set = sets.get(name);
  if (!set) {
    set = makeSet((ctx) => drawSet(name, ctx));
    sets.set(name, set);
  }
  return set;
}

export function drawSetAt(ctx: CanvasRenderingContext2D, name: SetName, pan = 40) {
  ctx.drawImage(getSet(name), -Math.round(clamp(pan, 0, SET_W - 640)), 0);
}

export function cloudLayer(ctx: CanvasRenderingContext2D, t: number, y: number, speed: number, near = false) {
  const palette = near
    ? (['#fff0df', '#e7c1b7', '#9d889f'] as const)
    : (['#e3e6f4', '#b7bcd8', '#747c9d'] as const);
  const w = near ? 160 : 99;
  const h = near ? 61 : 39;
  for (let i = 0; i < (near ? 6 : 8); i++) {
    const x = ((i * (near ? 144 : 100) + hash(i + (near ? 42 : 24)) * 30 + t * speed) % (SET_W + w)) - w;
    const cy = y + Math.sin(i * 2.1 + t * 0.12) * 3 + hash(i + 61) * 12;
    ctx.drawImage(
      cloudSprite(i * 9 + (near ? 71 : 17), w, h, palette[0], palette[1], palette[2]),
      Math.round(x),
      Math.round(cy)
    );
  }
}

export function motes(ctx: CanvasRenderingContext2D, t: number, count: number, color: string, top = 20, bottom = 330) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const speed = 7 + hash(i + 19) * 14;
    const x = (hash(i + 34) * 640 + t * speed) % 640;
    const y = top + ((hash(i + 75) * (bottom - top) + Math.sin(t * 0.7 + i) * 8) % (bottom - top));
    ctx.globalAlpha = 0.2 + 0.42 * Math.abs(Math.sin(t + i * 1.7));
    ctx.fillRect(Math.round(x), Math.round(y), i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

export function filmLighting(ctx: CanvasRenderingContext2D, color: string, strength: number) {
  const vignette = ctx.createRadialGradient(320, 170, 55, 320, 170, 440);
  vignette.addColorStop(0, 'rgba(3,2,8,0)');
  vignette.addColorStop(1, rgba(color, strength));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 640, CH);
}

let cachedShaftWall: HTMLCanvasElement | null = null;

/**
 * 640x1040 Minecraft-style 2D block cavern cross-section for Scene 11's elevator descent.
 * Uses the actual in-game 16x16 block sprites (`sprites.getTileVariant`), cavern backwalls,
 * natural side pockets, placed Cave Flares, and multi-block ore veins!
 */
export function getShaftWall(): HTMLCanvasElement {
  if (cachedShaftWall) return cachedShaftWall;
  sprites.ensureInit();

  const W = 640;
  const H = 1040;
  const COLS = W / 16; // 40 columns
  const ROWS = H / 16; // 65 rows
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Build a 40x65 block grid with central shaft (gx = 16..23) and natural side caverns
  const grid: TileType[][] = Array.from({ length: ROWS }, () => new Array<TileType>(COLS).fill(TileType.DIRT));

  const sideCaverns = [
    { cx: 9, cy: 10, rx: 5.2, ry: 2.6 },
    { cx: 31, cy: 16, rx: 5.5, ry: 2.8 },
    { cx: 8, cy: 26, rx: 5.8, ry: 3.0 },
    { cx: 31, cy: 35, rx: 5.4, ry: 2.8 },
    { cx: 9, cy: 46, rx: 5.6, ry: 3.0 },
    { cx: 31, cy: 55, rx: 5.8, ry: 3.1 },
  ];

  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      // Central elevator shaft (columns 16..23)
      if (gx >= 16 && gx <= 23) {
        grid[gy][gx] = TileType.AIR;
        continue;
      }
      // Natural side caverns opening off the shaft
      let inCavern = false;
      for (const cv of sideCaverns) {
        const dx = (gx - cv.cx) / cv.rx;
        const dy = (gy - cv.cy) / cv.ry;
        if (dx * dx + dy * dy <= 1.0) {
          inCavern = true;
          break;
        }
        // Connect cavern mouth to central shaft
        if (Math.abs(gy - cv.cy) <= 1.3 && ((cv.cx < 16 && gx >= cv.cx && gx < 16) || (cv.cx > 23 && gx <= cv.cx && gx > 23))) {
          inCavern = true;
          break;
        }
      }
      if (inCavern) {
        grid[gy][gx] = TileType.AIR;
        continue;
      }

      // Base rock stratum by depth row
      const jitter = Math.round((hash(gx * 3.1 + gy * 1.7) - 0.5) * 3);
      const r = gy + jitter;
      if (r < 9) grid[gy][gx] = TileType.DIRT;
      else if (r < 20) grid[gy][gx] = TileType.ASH_STONE;
      else if (r < 36) grid[gy][gx] = TileType.SULFUR_LIMESTONE;
      else if (r < 51) grid[gy][gx] = TileType.BRIMSTONE_BASALT;
      else grid[gy][gx] = TileType.ABYSSAL_OBSIDIAN;
    }
  }

  // Stamp curated multi-block ore veins along shaft walls, cavern ceilings, and rock strata!
  const veins: Array<{ gx: number; gy: number; type: TileType; shape: Array<[number, number]> }> = [
    { gx: 14, gy: 5, type: TileType.ORE_COAL, shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { gx: 24, gy: 7, type: TileType.ORE_COPPER, shape: [[0, 0], [1, 0], [2, 0], [1, 1]] },
    { gx: 6, gy: 12, type: TileType.ORE_COPPER, shape: [[0, 0], [1, 0], [0, 1]] },
    { gx: 14, gy: 14, type: TileType.ORE_SULFUR, shape: [[0, 0], [1, 0], [1, 1], [0, 2]] },
    { gx: 25, gy: 19, type: TileType.ORE_IRON, shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { gx: 29, gy: 13, type: TileType.ORE_SULFUR, shape: [[0, 0], [1, 0], [2, 0], [1, 1]] },
    { gx: 13, gy: 22, type: TileType.ORE_SULFUR, shape: [[0, 0], [1, 0], [2, 0], [1, 1]] },
    { gx: 6, gy: 29, type: TileType.ORE_SILVER, shape: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    { gx: 24, gy: 27, type: TileType.ORE_GOLD, shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { gx: 14, gy: 32, type: TileType.ORE_GOLD, shape: [[0, 0], [1, 0], [1, 1]] },
    { gx: 30, gy: 38, type: TileType.ORE_EMERALD, shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { gx: 14, gy: 40, type: TileType.ORE_EMERALD, shape: [[0, 0], [1, 0], [1, 1]] },
    { gx: 24, gy: 43, type: TileType.ORE_RUBY, shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { gx: 7, gy: 49, type: TileType.ORE_RUBY, shape: [[0, 0], [1, 0], [2, 0], [1, 1]] },
    { gx: 14, gy: 52, type: TileType.ORE_VOLTITE, shape: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { gx: 24, gy: 51, type: TileType.ORE_VOLTITE, shape: [[0, 0], [1, 0], [1, 1]] },
    { gx: 29, gy: 58, type: TileType.ORE_MYTHRIL, shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { gx: 13, gy: 60, type: TileType.ORE_HEART_OF_SULFUR, shape: [[0, 0], [1, 0], [2, 0], [1, 1]] },
    { gx: 24, gy: 61, type: TileType.ORE_HEART_OF_SULFUR, shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  ];

  for (const v of veins) {
    for (const [dx, dy] of v.shape) {
      const x = v.gx + dx;
      const y = v.gy + dy;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS && grid[y][x] !== TileType.AIR) {
        grid[y][x] = v.type;
      }
    }
  }

  // 1. Render dark cavern backwalls everywhere
  for (let gy = 0; gy < ROWS; gy++) {
    const sIdx = gy < 9 ? 0 : gy < 20 ? 1 : gy < 36 ? 2 : gy < 51 ? 3 : 4;
    const bw = sprites.getBackwall(sIdx);
    for (let gx = 0; gx < COLS; gx++) {
      if (bw) ctx.drawImage(bw, gx * 16, gy * 16);
      if (gx >= 16 && gx <= 23) {
        R(ctx, gx * 16, gy * 16, 16, 16, 'rgba(6, 4, 12, 0.52)');
      }
    }
  }

  // 2. Render solid 16x16 Minecraft-style blocks with exposed-face 3D bevel masks!
  const isSolid = (x: number, y: number) => {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    return grid[y][x] !== TileType.AIR;
  };

  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const t = grid[gy][gx];
      if (t === TileType.AIR) continue;
      const mask =
        (isSolid(gx, gy - 1) ? 0 : 1) |
        (isSolid(gx, gy + 1) ? 0 : 2) |
        (isSolid(gx - 1, gy) ? 0 : 4) |
        (isSolid(gx + 1, gy) ? 0 : 8);
      const variant = sprites.getTileVariant(t, (gx + gy) % 3, mask);
      if (variant) ctx.drawImage(variant, gx * 16, gy * 16);
    }
  }

  // 3. Timber shaft cross-beams & steel elevator guide rails inside the shaft (columns 16..23)
  R(ctx, 16 * 16 + 4, 0, 3, H, '#475569');
  R(ctx, 24 * 16 - 7, 0, 3, H, '#475569');
  for (let y = 32; y < H; y += 64) {
    R(ctx, 16 * 16, y, 8 * 16, 5, '#2b2018');
    R(ctx, 16 * 16, y, 8 * 16, 2, '#5c4433');
  }

  // 4. Placed Cave Flares on cavern ledges casting warm radial block lighting!
  const flareFrames = sprites.getFlareFrames();
  for (const cv of sideCaverns) {
    const fx = cv.cx * 16 + 3;
    const fy = (Math.floor(cv.cy + cv.ry) - 1) * 16 + 2;
    if (flareFrames[0]) ctx.drawImage(flareFrames[0], fx, fy);
    glowAt(ctx, fx + 5, fy + 4, 56, '#fde047', 0.28);
  }

  cachedShaftWall = c;
  return c;
}