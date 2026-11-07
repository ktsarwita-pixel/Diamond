import {
  ORE_LIST,
  OUTPOST_ZONES,
  SURFACE_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import { TileType } from './types';

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash2D(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, seed: number): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 3; i++) {
    val += amp * smoothNoise(x * freq, y * freq, seed + i * 97);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

export function generateWorld(seed = Date.now()): TileType[][] {
  const rand = seededRandom(seed);
  const grid: TileType[][] = Array.from({ length: WORLD_HEIGHT }, () =>
    new Array<TileType>(WORLD_WIDTH).fill(TileType.AIR)
  );

  // 1. Base strata & cave carving
  for (let gy = 0; gy < WORLD_HEIGHT; gy++) {
    const depth = gy - SURFACE_Y;

    for (let gx = 0; gx < WORLD_WIDTH; gx++) {
      // Sky above surface
      if (depth < 0) {
        grid[gy][gx] = TileType.AIR;
        continue;
      }

      // Indestructible side walls and bottom core bedrock
      if (gx === 0 || gx === WORLD_WIDTH - 1 || gy >= WORLD_HEIGHT - 3) {
        grid[gy][gx] = TileType.CORE_BEDROCK;
        continue;
      }

      // Surface row
      if (depth === 0) {
        if (gx >= OUTPOST_ZONES.SHAFT.startX && gx <= OUTPOST_ZONES.SHAFT.endX) {
          grid[gy][gx] = TileType.AIR;
        } else if (gx >= 8 && gx <= WORLD_WIDTH - 9) {
          grid[gy][gx] = TileType.SURFACE_PAD;
        } else {
          grid[gy][gx] = TileType.DIRT;
        }
        continue;
      }

      // Protect foundation right under the surface steel pad so outpost never floats
      if (depth === 1 && gx >= 8 && gx <= WORLD_WIDTH - 9 && (gx < OUTPOST_ZONES.SHAFT.startX || gx > OUTPOST_ZONES.SHAFT.endX)) {
        grid[gy][gx] = TileType.ASH_STONE;
        continue;
      }

      // Natural cave pockets using FBM noise
      const caveNoise = fbm(gx * 0.11, gy * 0.11, seed);
      const tunnelNoise = Math.abs(fbm(gx * 0.065, gy * 0.065, seed + 500) - 0.5);
      const isCave = depth > 4 && (caveNoise > 0.67 || tunnelNoise < 0.032);

      if (isCave) {
        grid[gy][gx] = TileType.AIR;
        continue;
      }

      // Determine host rock by depth + organic noise border
      const jitterDepth = depth + (smoothNoise(gx * 0.18, gy * 0.18, seed + 31) - 0.5) * 9;

      if (jitterDepth < 14) {
        grid[gy][gx] = TileType.DIRT;
      } else if (jitterDepth < 36) {
        grid[gy][gx] = TileType.ASH_STONE;
      } else if (jitterDepth < 86) {
        grid[gy][gx] = TileType.SULFUR_LIMESTONE;
      } else if (jitterDepth < 142) {
        grid[gy][gx] = TileType.BRIMSTONE_BASALT;
      } else {
        grid[gy][gx] = TileType.ABYSSAL_OBSIDIAN;
      }
    }
  }

  // 2. Carve the starter Mine Shaft Chute + welcoming starter cavern
  for (let gy = SURFACE_Y; gy <= SURFACE_Y + 9; gy++) {
    for (let gx = OUTPOST_ZONES.SHAFT.startX + 1; gx <= OUTPOST_ZONES.SHAFT.endX - 1; gx++) {
      grid[gy][gx] = TileType.AIR;
    }
  }
  // Small starter chamber at bottom of shaft
  for (let gy = SURFACE_Y + 7; gy <= SURFACE_Y + 12; gy++) {
    for (let gx = OUTPOST_ZONES.SHAFT.startX - 3; gx <= OUTPOST_ZONES.SHAFT.endX + 3; gx++) {
      if (gx > 1 && gx < WORLD_WIDTH - 2) {
        const dist = Math.hypot(
          (gx - OUTPOST_ZONES.SHAFT.centerX) * 0.7,
          gy - (SURFACE_Y + 9.5)
        );
        if (dist < 4.3) {
          grid[gy][gx] = TileType.AIR;
        }
      }
    }
  }

  // 3. Populate Ore Veins & Hazards across strata
  for (let gy = SURFACE_Y + 2; gy < WORLD_HEIGHT - 4; gy++) {
    const depth = gy - SURFACE_Y;
    for (let gx = 2; gx < WORLD_WIDTH - 2; gx++) {
      const current = grid[gy][gx];
      if (current === TileType.AIR || current === TileType.SURFACE_PAD || current === TileType.CORE_BEDROCK) {
        continue;
      }

      // Sulfur Gas Pockets in middle depths (24m..150m)
      if (depth >= 22 && depth <= 155 && rand() < 0.015) {
        grid[gy][gx] = TileType.SULFUR_GAS_POCKET;
        continue;
      }

      // Magma Rock hazards in deep strata (115m+)
      if (depth >= 115 && rand() < 0.032) {
        grid[gy][gx] = TileType.MAGMA_ROCK;
        continue;
      }

      // Roll for ore vein seed
      if (rand() < 0.052) {
        const candidates = ORE_LIST.filter(
          (o) => depth >= o.minDepth && depth <= o.maxDepth
        );
        if (candidates.length > 0) {
          const totalWeight = candidates.reduce((acc, o) => acc + o.rarity, 0);
          let roll = rand() * totalWeight;
          let chosen = candidates[0];
          for (const c of candidates) {
            roll -= c.rarity;
            if (roll <= 0) {
              chosen = c;
              break;
            }
          }

          // Paint a small 2..5 block vein cluster
          const veinSize = 2 + Math.floor(rand() * 4);
          let vx = gx;
          let vy = gy;
          for (let v = 0; v < veinSize; v++) {
            if (
              vx > 1 &&
              vx < WORLD_WIDTH - 2 &&
              vy > SURFACE_Y + 1 &&
              vy < WORLD_HEIGHT - 4 &&
              grid[vy][vx] !== TileType.AIR &&
              grid[vy][vx] !== TileType.CORE_BEDROCK
            ) {
              grid[vy][vx] = chosen.tileType;
            }
            const dir = Math.floor(rand() * 4);
            if (dir === 0) vx++;
            else if (dir === 1) vx--;
            else if (dir === 2) vy++;
            else vy--;
          }
        }
      }
    }
  }

  // 4. Guarantee rich starter Coal, Copper, and Sulfur Crystal veins near the starter chamber
  const starterVeins: Array<{ dx: number; dy: number; type: TileType }> = [
    { dx: -5, dy: 8, type: TileType.ORE_COAL },
    { dx: -5, dy: 9, type: TileType.ORE_COAL },
    { dx: 6, dy: 8, type: TileType.ORE_COPPER },
    { dx: 6, dy: 9, type: TileType.ORE_COPPER },
    { dx: -2, dy: 13, type: TileType.ORE_SULFUR },
    { dx: -1, dy: 13, type: TileType.ORE_SULFUR },
    { dx: 3, dy: 13, type: TileType.ORE_COPPER },
    { dx: 4, dy: 13, type: TileType.ORE_SULFUR },
  ];

  const center = Math.round(OUTPOST_ZONES.SHAFT.centerX);
  for (const sv of starterVeins) {
    const gx = center + sv.dx;
    const gy = SURFACE_Y + sv.dy;
    if (grid[gy] && grid[gy][gx] !== undefined) {
      grid[gy][gx] = sv.type;
    }
  }

  return grid;
}
