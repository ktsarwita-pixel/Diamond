import { ORES, TILE_SIZE, TILES } from './constants';
import { OreId, TileType } from './types';

/* ------------------------------------------------------------------ *
 * Deterministic pixel noise helpers — keeps textures crisp & stable
 * ------------------------------------------------------------------ */
function hash2(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

interface RockPalette {
  base: string;
  light: string;
  dark: string;
  deep: string;
  speck?: string;
}

/** Paints a rich 4-tone dithered rock surface with strata lines + mineral specks. */
function paintRock(
  ctx: CanvasRenderingContext2D,
  pal: RockPalette,
  seed: number,
  opts: { strata?: boolean; speckDensity?: number } = {}
) {
  const { strata = true, speckDensity = 0.035 } = opts;
  ctx.fillStyle = pal.base;
  ctx.fillRect(0, 0, 16, 16);

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = hash2(x, y, seed);
      const band = hash2(x >> 2, y >> 2, seed + 7);

      if (r < 0.13) ctx.fillStyle = pal.dark;
      else if (r < 0.2) ctx.fillStyle = pal.deep;
      else if (r > 0.9) ctx.fillStyle = pal.light;
      else if (band > 0.72) ctx.fillStyle = pal.light;
      else continue;

      ctx.fillRect(x, y, 1, 1);
    }
  }

  if (pal.speck) {
    for (let i = 0; i < 16 * 16; i++) {
      if (hash2(i, 3, seed + 91) > speckDensity) continue;
      const x = Math.floor(hash2(i, 11, seed) * 16);
      const y = Math.floor(hash2(i, 17, seed) * 16);
      ctx.fillStyle = pal.speck;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  if (strata) {
    ctx.fillStyle = pal.deep;
    const y1 = 4 + Math.floor(hash2(seed, 1, 5) * 3);
    const y2 = 11 + Math.floor(hash2(seed, 2, 5) * 2);
    for (let x = 0; x < 16; x++) {
      if (hash2(x, y1, seed + 3) > 0.35) ctx.fillRect(x, y1, 1, 1);
      if (hash2(x, y2, seed + 4) > 0.55) ctx.fillRect(x, y2, 1, 1);
    }
    ctx.fillStyle = pal.light;
    for (let x = 0; x < 16; x++) {
      if (hash2(x, y1 - 1, seed + 8) > 0.72) ctx.fillRect(x, y1 - 1, 1, 1);
    }
  }
}

/** Chunky Minecraft-style ore nugget cluster with outline + facet highlight. */
function paintNuggets(
  ctx: CanvasRenderingContext2D,
  color: string,
  hi: string,
  outline: string,
  seed: number
) {
  const spots = [
    { x: 3, y: 3 },
    { x: 10, y: 4 },
    { x: 5, y: 9 },
    { x: 11, y: 10 },
  ];
  spots.forEach((s, i) => {
    const jx = Math.floor(hash2(i, 21, seed) * 3) - 1;
    const jy = Math.floor(hash2(i, 22, seed) * 3) - 1;
    const x = Math.max(2, Math.min(11, s.x + jx));
    const y = Math.max(2, Math.min(11, s.y + jy));

    ctx.fillStyle = outline;
    ctx.fillRect(x - 1, y, 4, 3);
    ctx.fillRect(x, y - 1, 2, 1);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 3, 2);
    ctx.fillRect(x - 1, y + 1, 3, 1);
    ctx.fillStyle = hi;
    ctx.fillRect(x, y, 1, 1);
  });
}

/** Faceted crystal shard cluster (sulfur / emerald / ruby / voltite / mythril). */
function paintCrystals(
  ctx: CanvasRenderingContext2D,
  color: string,
  hi: string,
  outline: string,
  seed: number,
  glowFrame = 0
) {
  const shards = [
    { x: 4, y: 8, h: 6 },
    { x: 9, y: 6, h: 8 },
    { x: 12, y: 10, h: 4 },
  ];
  shards.forEach((s, i) => {
    const jx = Math.floor(hash2(i, 31, seed) * 3) - 1;
    const x = Math.max(2, Math.min(12, s.x + jx));
    const y = s.y;
    const h = s.h;

    ctx.fillStyle = outline;
    ctx.fillRect(x - 1, y - Math.floor(h / 2) - 1, 3, h + 1);
    ctx.fillStyle = color;
    ctx.fillRect(x, y - Math.floor(h / 2), 1, h);
    ctx.fillRect(x - 1, y - Math.floor(h / 2) + 1, 1, h - 2);
    ctx.fillStyle = hi;
    ctx.fillRect(x, y - Math.floor(h / 2), 1, Math.max(1, Math.floor(h / 2)));
    // Animated inner glow pulse
    if (glowFrame > 0 && (i + glowFrame) % 3 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y - 1, 1, 1);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Sprite Atlas
 * ------------------------------------------------------------------ */
class SpriteAtlas {
  private tileFrames = new Map<TileType, HTMLCanvasElement[]>();
  private tileVariants = new Map<TileType, HTMLCanvasElement[][]>();
  private backwallFrames: HTMLCanvasElement[][] = [];
  private crackFrames: HTMLCanvasElement[] = [];
  private oreIconFrames = new Map<OreId, HTMLCanvasElement[]>();
  private flareFrames: HTMLCanvasElement[] = [];
  private initialized = false;

  public ensureInit() {
    if (this.initialized) return;
    this.initialized = true;
    this.buildTiles();
    this.buildBackwalls();
    this.buildCracks();
    this.buildOreIcons();
    this.buildFlares();
  }

  private canvas(w = TILE_SIZE, h = TILE_SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    return [c, ctx];
  }

  private store(type: TileType, frames: HTMLCanvasElement[]) {
    this.tileFrames.set(type, frames);
    this.tileVariants.set(type, [frames]);
  }

  private storeVariants(type: TileType, variants: HTMLCanvasElement[][]) {
    this.tileFrames.set(type, variants[0]);
    this.tileVariants.set(type, variants);
  }

  /** Returns animated frames for a tile (length 1 for static tiles). */
  public getTileFrames(type: TileType): HTMLCanvasElement[] | undefined {
    this.ensureInit();
    return this.tileFrames.get(type);
  }

  /** Stable world-coordinate variation with independently offset animated frames. */
  public getTileFrame(type: TileType, gx: number, gy: number, time: number): HTMLCanvasElement | undefined {
    this.ensureInit();
    const variants = this.tileVariants.get(type);
    if (!variants) return undefined;
    const variant = variants[Math.abs(gx * 31 + gy * 17 + gx * gy) % variants.length];
    return variant[(Math.floor(time * 7) + (gx * 3 + gy * 5) % 7 + variant.length * 7) % variant.length];
  }

  public getBackwall(index: number, gx = 0, gy = 0): HTMLCanvasElement | undefined {
    this.ensureInit();
    const variants = this.backwallFrames[Math.max(0, Math.min(this.backwallFrames.length - 1, index))];
    return variants[Math.abs(gx * 29 + gy * 13) % variants.length];
  }

  public getCrack(stage: number): HTMLCanvasElement | undefined {
    this.ensureInit();
    return this.crackFrames[Math.max(0, Math.min(this.crackFrames.length - 1, stage))];
  }

  public getOreIconFrames(oreId: OreId): HTMLCanvasElement[] | undefined {
    this.ensureInit();
    return this.oreIconFrames.get(oreId);
  }

  private bevelCache = new Map<string, HTMLCanvasElement>();

  /**
   * Returns a 16x16 block sprite with exposed-face 3D bevel highlights, shadows,
   * and corner ambient occlusion baked in (`mask`: 1=up, 2=down, 4=left, 8=right).
   */
  public getTileVariant(type: TileType, frame: number, mask: number): HTMLCanvasElement | undefined {
    this.ensureInit();
    const key = `${type}:${frame}:${mask}`;
    const hit = this.bevelCache.get(key);
    if (hit) return hit;

    const frames = this.tileFrames.get(type);
    if (!frames || frames.length === 0) return undefined;
    const base = frames[Math.abs(frame) % frames.length];
    const [c, ctx] = this.canvas(TILE_SIZE, TILE_SIZE);
    ctx.drawImage(base, 0, 0);

    if (mask !== 0) {
      const col = TILES[type]?.particleColor || '#666666';
      const hi = shade(col, 0.42);
      const lo = shade(col, -0.5);
      const up = (mask & 1) !== 0;
      const down = (mask & 2) !== 0;
      const left = (mask & 4) !== 0;
      const right = (mask & 8) !== 0;

      if (up) {
        ctx.fillStyle = hi;
        ctx.fillRect(0, 0, 16, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(0, 0, 16, 1);
      }
      if (left) {
        ctx.fillStyle = hi;
        ctx.fillRect(0, 0, 1, 16);
      }
      if (down) {
        ctx.fillStyle = lo;
        ctx.fillRect(0, 14, 16, 2);
      }
      if (right) {
        ctx.fillStyle = lo;
        ctx.fillRect(15, 0, 1, 16);
      }
      ctx.fillStyle = 'rgba(6,4,12,0.42)';
      if (up && left) ctx.fillRect(0, 0, 2, 2);
      if (up && right) ctx.fillRect(14, 0, 2, 2);
      if (down && left) ctx.fillRect(0, 14, 2, 2);
      if (down && right) ctx.fillRect(14, 14, 2, 2);
    }

    this.bevelCache.set(key, c);
    return c;
  }

  public getFlareFrames(): HTMLCanvasElement[] {
    this.ensureInit();
    return this.flareFrames;
  }

  /* ------------------------- TILE BUILD ------------------------- */
  private buildTiles() {
    // Surface outpost steel plating
    {
      const [c, ctx] = this.canvas();
      ctx.fillStyle = '#39414f';
      ctx.fillRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const r = hash2(x, y, 900);
          if (r < 0.12) {
            ctx.fillStyle = '#2a303b';
            ctx.fillRect(x, y, 1, 1);
          } else if (r > 0.92) {
            ctx.fillStyle = '#5b6779';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = Math.floor(x / 4) % 2 === 0 ? '#f2c230' : '#20242c';
        ctx.fillRect(x, 0, 1, 3);
      }
      ctx.fillStyle = '#77879e';
      ctx.fillRect(0, 3, 16, 1);
      ctx.fillStyle = '#1d222b';
      ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#93a2b8';
      [[2, 6], [13, 6], [2, 10], [13, 10], [7, 8]].forEach(([x, y]) => {
        ctx.fillRect(x, y, 2, 2);
        ctx.fillStyle = '#2a303b';
        ctx.fillRect(x + 1, y + 1, 1, 1);
        ctx.fillStyle = '#93a2b8';
      });
      this.store(TileType.SURFACE_PAD, [c]);
    }

    const rockDefs: Array<{ type: TileType; pal: RockPalette; seed: number }> = [
      {
        type: TileType.DIRT,
        pal: { base: '#6d4529', light: '#8d5c37', dark: '#4e2f1b', deep: '#3a2213', speck: '#a9793f' },
        seed: 11,
      },
      {
        type: TileType.ASH_STONE,
        pal: { base: '#57546a', light: '#736f88', dark: '#3c3a4a', deep: '#2b2936', speck: '#8f8aa6' },
        seed: 22,
      },
      {
        type: TileType.SULFUR_LIMESTONE,
        pal: { base: '#7e7a45', light: '#a09a5c', dark: '#5a5630', deep: '#413e21', speck: '#d7cf4a' },
        seed: 33,
      },
      {
        type: TileType.BRIMSTONE_BASALT,
        pal: { base: '#443b58', light: '#5f5379', dark: '#2d2639', deep: '#1e1929', speck: '#8b5fb0' },
        seed: 44,
      },
      {
        type: TileType.ABYSSAL_OBSIDIAN,
        pal: { base: '#241d38', light: '#3a2f57', dark: '#171126', deep: '#0d0918', speck: '#5470c8' },
        seed: 55,
      },
      {
        type: TileType.CORE_BEDROCK,
        pal: { base: '#171120', light: '#2a2038', dark: '#0b0712', deep: '#05030a', speck: '#5a2030' },
        seed: 66,
      },
    ];

    for (const def of rockDefs) {
      const variants: HTMLCanvasElement[][] = [];
      for (let variant = 0; variant < 4; variant++) {
        const [c, ctx] = this.canvas();
        paintRock(ctx, def.pal, def.seed + variant * 47);
        if (def.type === TileType.CORE_BEDROCK) {
          ctx.fillStyle = '#0b0712';
          for (let i = 0; i < 16; i += 4) {
            ctx.fillRect(i, 0, 1, 16);
            ctx.fillRect(0, i, 16, 1);
          }
          ctx.fillStyle = '#3a2038';
          ctx.fillRect(2 + variant, 2, 2, 2);
          ctx.fillRect(10, 6 + variant, 2, 2);
          ctx.fillRect(5, 12, 2, 2);
        } else {
          // Fine fractures and small feldspar inclusions differ per block.
          const fractureY = 3 + ((variant * 3) % 8);
          ctx.fillStyle = def.pal.deep;
          ctx.fillRect(2 + variant, fractureY, 4, 1);
          ctx.fillRect(5 + variant, fractureY + 1, 1, 2);
          ctx.fillStyle = def.pal.light;
          ctx.fillRect(2 + variant, fractureY - 1, 2, 1);
        }
        variants.push([c]);
      }
      this.storeVariants(def.type, variants);
    }

    // Magma has stable stone texture and asynchronously pulsing lava channels.
    {
      const variants: HTMLCanvasElement[][] = [];
      for (let variant = 0; variant < 3; variant++) {
        const frames: HTMLCanvasElement[] = [];
        for (let f = 0; f < 4; f++) {
          const [c, ctx] = this.canvas();
          paintRock(
            ctx,
            { base: '#2e1c25', light: '#4a2c3a', dark: '#1c1017', deep: '#120a0f' },
            77 + variant * 59,
            { strata: false }
          );
          const veins: Array<[number, number, number, number]> = [
            [1 + variant, 3, 5, 2], [6 + (variant % 2), 4, 2, 6],
            [8, 9 + (variant % 2), 6, 2], [2, 12, 4 + variant, 2],
          ];
          veins.forEach(([x, y, w, h], i) => {
            ctx.fillStyle = '#742910';
            ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
            ctx.fillStyle = (f + i) % 4 === 0 ? '#ffd466' : '#e9651e';
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = f === 2 ? '#fff1a0' : '#ffad42';
            ctx.fillRect(x + (f % 2), y, Math.max(1, w - 2), 1);
          });
          frames.push(c);
        }
        variants.push(frames);
      }
      this.storeVariants(TileType.MAGMA_ROCK, variants);
    }

    // Gas pockets have their own vents and 4-frame rising bubbles.
    {
      const variants: HTMLCanvasElement[][] = [];
      for (let variant = 0; variant < 3; variant++) {
        const frames: HTMLCanvasElement[] = [];
        for (let f = 0; f < 4; f++) {
          const [c, ctx] = this.canvas();
          paintRock(
            ctx,
            { base: '#6a6c33', light: '#8d8f48', dark: '#484a1f', deep: '#333415', speck: '#d9f926' },
            88 + variant * 61,
            { speckDensity: 0.02 }
          );
          const bubbles = [
            { x: 4 + variant, y: 11 - f, r: 3 },
            { x: 10, y: 12 - ((f + 2) % 4), r: 2 },
            { x: 7, y: 13 - ((f + 1) % 4), r: 2 },
          ];
          bubbles.forEach((b) => {
            const by = Math.max(2, b.y);
            ctx.fillStyle = '#2f3112';
            ctx.fillRect(b.x - 1, by - 1, b.r + 2, b.r + 2);
            ctx.fillStyle = '#c8e61f';
            ctx.fillRect(b.x, by, b.r, b.r);
            ctx.fillStyle = '#f4ffb0';
            ctx.fillRect(b.x, by, 1, 1);
          });
          frames.push(c);
        }
        variants.push(frames);
      }
      this.storeVariants(TileType.SULFUR_GAS_POCKET, variants);
    }

    // Ore tiles
    const oreDefs: Array<{
      type: TileType;
      ore: OreId;
      host: RockPalette;
      crystal?: boolean;
      seed: number;
      frames?: number;
    }> = [
      {
        type: TileType.ORE_COAL,
        ore: 'coal',
        host: { base: '#57546a', light: '#736f88', dark: '#3c3a4a', deep: '#2b2936' },
        seed: 101,
      },
      {
        type: TileType.ORE_COPPER,
        ore: 'copper',
        host: { base: '#57546a', light: '#736f88', dark: '#3c3a4a', deep: '#2b2936' },
        seed: 102,
      },
      {
        type: TileType.ORE_SULFUR,
        ore: 'sulfur',
        host: { base: '#7e7a45', light: '#a09a5c', dark: '#5a5630', deep: '#413e21' },
        crystal: true,
        seed: 103,
        frames: 3,
      },
      {
        type: TileType.ORE_IRON,
        ore: 'iron',
        host: { base: '#7e7a45', light: '#a09a5c', dark: '#5a5630', deep: '#413e21' },
        seed: 104,
      },
      {
        type: TileType.ORE_SILVER,
        ore: 'silver',
        host: { base: '#443b58', light: '#5f5379', dark: '#2d2639', deep: '#1e1929' },
        seed: 105,
      },
      {
        type: TileType.ORE_GOLD,
        ore: 'gold',
        host: { base: '#443b58', light: '#5f5379', dark: '#2d2639', deep: '#1e1929' },
        seed: 106,
        frames: 3,
      },
      {
        type: TileType.ORE_EMERALD,
        ore: 'emerald',
        host: { base: '#443b58', light: '#5f5379', dark: '#2d2639', deep: '#1e1929' },
        crystal: true,
        seed: 107,
        frames: 3,
      },
      {
        type: TileType.ORE_RUBY,
        ore: 'ruby',
        host: { base: '#241d38', light: '#3a2f57', dark: '#171126', deep: '#0d0918' },
        crystal: true,
        seed: 108,
        frames: 3,
      },
      {
        type: TileType.ORE_VOLTITE,
        ore: 'voltite',
        host: { base: '#241d38', light: '#3a2f57', dark: '#171126', deep: '#0d0918' },
        crystal: true,
        seed: 109,
        frames: 3,
      },
      {
        type: TileType.ORE_MYTHRIL,
        ore: 'mythril',
        host: { base: '#241d38', light: '#3a2f57', dark: '#171126', deep: '#0d0918' },
        crystal: true,
        seed: 110,
        frames: 3,
      },
      {
        type: TileType.ORE_HEART_OF_SULFUR,
        ore: 'heart_of_sulfur',
        host: { base: '#2e1c25', light: '#4a2c3a', dark: '#1c1017', deep: '#120a0f' },
        crystal: true,
        seed: 111,
        frames: 4,
      },
    ];

    for (const def of oreDefs) {
      const o = ORES[def.ore];
      const count = def.frames || 1;
      const variants: HTMLCanvasElement[][] = [];
      for (let variant = 0; variant < 3; variant++) {
        const frames: HTMLCanvasElement[] = [];
        for (let f = 0; f < count; f++) {
          const [c, ctx] = this.canvas();
          const seed = def.seed + variant * 107;
          paintRock(ctx, def.host, seed);
          const outline = shade(o.color, -0.55);
          if (def.crystal) {
            paintCrystals(ctx, o.color, o.accentColor, outline, seed, f);
          } else {
            paintNuggets(ctx, o.color, o.accentColor, outline, seed);
          }

          // Tiny reflections travel across a vein, but the host rock never moves.
          if (count > 1) {
            const gx = 3 + ((f * 5 + variant * 2) % 10);
            const gy = 3 + ((f * 3 + variant) % 9);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(gx, gy, 1, 1);
            ctx.fillStyle = o.accentColor;
            ctx.fillRect(gx - 1, gy, 1, 1);
            ctx.fillRect(gx + 1, gy, 1, 1);
            ctx.fillRect(gx, gy - 1, 1, 1);
            ctx.fillRect(gx, gy + 1, 1, 1);
          }
          frames.push(c);
        }
        variants.push(frames);
      }
      this.storeVariants(def.type, variants);
    }
  }

  /* ---------------------- BACKWALL BUILD ---------------------- */
  private buildBackwalls() {
    const pals: RockPalette[] = [
      { base: '#2a2020', light: '#372a28', dark: '#1d1617', deep: '#150f11' },
      { base: '#26262f', light: '#32323d', dark: '#1a1a21', deep: '#121218' },
      { base: '#2b2a1d', light: '#383624', dark: '#1d1c13', deep: '#14130d' },
      { base: '#241f2f', light: '#2f293c', dark: '#181423', deep: '#100d18' },
      { base: '#1c1726', light: '#251e31', dark: '#120e1a', deep: '#0b0811' },
      { base: '#2a1a1c', light: '#3a2326', dark: '#1c1113', deep: '#120a0c' },
    ];
    pals.forEach((pal, i) => {
      const variants: HTMLCanvasElement[] = [];
      for (let variant = 0; variant < 3; variant++) {
        const [c, ctx] = this.canvas();
        paintRock(ctx, pal, 500 + i * 13 + variant * 37, { strata: false, speckDensity: 0.02 });
        ctx.fillStyle = pal.deep;
        ctx.fillRect(2 + variant, 5, 2, 1);
        ctx.fillRect(11, 8 + variant, 2, 1);
        ctx.fillRect(7, 13, 1, 1);
        variants.push(c);
      }
      this.backwallFrames.push(variants);
    });
  }

  /* ----------------------- CRACK BUILD ----------------------- */
  private buildCracks() {
    for (let stage = 0; stage < 6; stage++) {
      const [c, ctx] = this.canvas();
      const t = stage / 5;
      ctx.fillStyle = `rgba(8, 5, 14, ${0.5 + t * 0.4})`;

      const lines: Array<[number, number, number, number]> = [
        [7, 7, 2, 2],
        [5, 5, 2, 1],
        [9, 9, 2, 1],
        [3, 8, 3, 1],
        [11, 4, 3, 1],
        [6, 11, 1, 3],
        [10, 10, 1, 3],
        [2, 3, 2, 2],
        [13, 12, 2, 2],
        [4, 13, 3, 1],
        [12, 2, 2, 2],
      ];
      const visible = Math.round(lines.length * (0.25 + t * 0.75));
      for (let i = 0; i < visible; i++) {
        const [x, y, w, h] = lines[i];
        ctx.fillRect(x, y, w, h);
      }
      if (stage >= 3) {
        ctx.fillStyle = `rgba(255, 236, 170, ${0.18 + t * 0.3})`;
        ctx.fillRect(6, 6, 4, 4);
      }
      this.crackFrames.push(c);
    }
  }

  /* --------------------- ORE DROP ICONS --------------------- */
  private buildOreIcons() {
    for (const ore of Object.values(ORES)) {
      const frames: HTMLCanvasElement[] = [];
      for (let f = 0; f < 3; f++) {
        const [c, ctx] = this.canvas(14, 14);
        const dark = shade(ore.color, -0.6);
        const crystal = ['sulfur', 'emerald', 'ruby', 'voltite', 'mythril'].includes(ore.id);
        if (ore.id === 'coal') {
          ctx.fillStyle = '#08060e';
          ctx.fillRect(3, 4, 8, 7);
          ctx.fillRect(2, 6, 10, 4);
          ctx.fillStyle = dark;
          ctx.fillRect(3, 5, 8, 5);
          ctx.fillStyle = ore.color;
          ctx.fillRect(4, 4, 6, 4);
          ctx.fillRect(5, 8, 5, 2);
          ctx.fillStyle = ore.accentColor;
          ctx.fillRect(4, 5, 3, 1);
          ctx.fillRect(8, 8, 2, 1);
        } else if (crystal || ore.id === 'heart_of_sulfur') {
          // Distinct twin crystal shards rather than the metal nugget shape.
          ctx.fillStyle = '#08060e';
          ctx.fillRect(5, 1, 4, 12);
          ctx.fillRect(2, 5, 10, 7);
          ctx.fillStyle = dark;
          ctx.fillRect(5, 2, 3, 10);
          ctx.fillRect(3, 6, 3, 5);
          ctx.fillStyle = ore.color;
          ctx.fillRect(6, 2, 2, 9);
          ctx.fillRect(4, 5, 2, 6);
          ctx.fillRect(9, 7, 2, 4);
          ctx.fillStyle = ore.accentColor;
          ctx.fillRect(6, 2, 1, 6);
          ctx.fillRect(4, 6, 1, 3);
          if (ore.id === 'heart_of_sulfur') {
            ctx.fillStyle = '#fff6d2';
            ctx.fillRect(6, 4, 2, 4);
            ctx.fillRect(5, 6, 4, 2);
          }
        } else {
          ctx.fillStyle = '#08060e';
          ctx.fillRect(4, 2, 6, 10);
          ctx.fillRect(2, 4, 10, 6);
          ctx.fillStyle = dark;
          ctx.fillRect(3, 4, 8, 6);
          ctx.fillRect(4, 3, 6, 8);
          ctx.fillStyle = ore.color;
          ctx.fillRect(4, 4, 6, 6);
          ctx.fillRect(5, 3, 4, 8);
          ctx.fillStyle = ore.accentColor;
          ctx.fillRect(5, 4, 3, 3);
          ctx.fillRect(4, 5, 2, 2);
        }

        const sx = 4 + ((f * 3) % 5);
        const sy = 3 + ((f * 2) % 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx, sy, 1, 1);
        if (f === 1) {
          ctx.fillRect(sx + 1, sy, 1, 1);
          ctx.fillRect(sx, sy + 1, 1, 1);
        }
        frames.push(c);
      }
      this.oreIconFrames.set(ore.id, frames);
    }
  }

  /* ------------------------ CAVE FLARES ------------------------ */
  private buildFlares() {
    for (let f = 0; f < 4; f++) {
      const [c, ctx] = this.canvas(10, 14);
      // Wooden stake
      ctx.fillStyle = '#08060e';
      ctx.fillRect(3, 6, 4, 8);
      ctx.fillStyle = '#7c4a1e';
      ctx.fillRect(4, 7, 2, 6);
      ctx.fillStyle = '#a86a2c';
      ctx.fillRect(4, 7, 1, 6);

      // Flame (4 flicker frames)
      const h = 4 + (f % 2);
      const lean = f === 1 ? 1 : f === 3 ? -1 : 0;
      ctx.fillStyle = '#08060e';
      ctx.fillRect(3 + lean, 5 - h, 5, h + 1);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(4 + lean, 5 - h, 3, h);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(4 + lean, 6 - h, 2, h - 1);
      ctx.fillStyle = '#fff7c2';
      ctx.fillRect(5 + lean, 6 - Math.floor(h / 2), 1, Math.max(1, Math.floor(h / 2)));
      this.flareFrames.push(c);
    }
  }
}

/** Lightens (+) or darkens (-) a hex color by ratio. */
function shade(hex: string, ratio: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(ratio >= 0 ? v + (255 - v) * ratio : v * (1 + ratio))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export const sprites = new SpriteAtlas();
export { shade };

