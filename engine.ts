import {
  ACHIEVEMENTS,
  CONSUMABLES,
  DEFAULT_SETTINGS,
  ORE_LIST,
  ORES,
  OUTPOST_ZONES,
  STRATA,
  SURFACE_Y,
  TILE_SIZE,
  TILES,
  UPGRADE_TRACKS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getStratumAtDepth,
} from './constants';
import { sound } from './sound';
import { shade, sprites } from './sprites';
import { CHARACTERS, NPC_LINES, Npc, createNpcs, drawCubeMiner } from './characters';
import { drawCachedNpc } from './cutsceneArt';
import {
  AchievementDef,
  ActiveBomb,
  CaveDrip,
  ConsumableKey,
  DialogueLine,
  DroppedOre,
  FloatingText,
  GameSettings,
  GasCloud,
  HudSnapshot,
  InputState,
  MarketSurge,
  OreId,
  OutpostBuilding,
  Particle,
  PlacedTorch,
  PlayerState,
  SonarWave,
  SpeakerId,
  TileType,
  UpgradeKey,
} from './types';
import { generateWorld } from './worldGen';

const SAVE_KEY = 'sulfured_caves_save_v2';
const FIXED_STEP = 1 / 120; // High-frequency physics for buttery motion
const LIGHT_DIV = 4; // Lightmap resolution divisor (world px per light px)

function createEmptyCargo(): Record<OreId, number> {
  return {
    coal: 0,
    copper: 0,
    sulfur: 0,
    iron: 0,
    silver: 0,
    gold: 0,
    emerald: 0,
    ruby: 0,
    voltite: 0,
    mythril: 0,
    heart_of_sulfur: 0,
  };
}

/** Shortest-path angle lerp so the drill arm swings smoothly, never spinning backwards. */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export class GameEngine {
  public grid: TileType[][];
  public explored: Uint8Array;
  public player: PlayerState;
  public input: InputState = {
    moveX: 0,
    moveY: 0,
    thrustHeld: false,
    drillHeld: false,
    pointerActive: false,
    pointerWorldX: 0,
    pointerWorldY: 0,
  };

  public drops: DroppedOre[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public bombs: ActiveBomb[] = [];
  public torches: PlacedTorch[] = [];
  public gasClouds: GasCloud[] = [];
  public marketSurge: MarketSurge;

  public camX = 0;
  public camY = 0;
  public zoom = 3;
  public viewW = 800;
  public viewH = 600;
  public shakeTime = 0;
  public shakeIntensity = 0;
  public time = 0;
  public paused = false;
  public statusBanner: string | null = null;
  public adminUnlocked = false;
  public npcs: Npc[] = createNpcs(TILE_SIZE);
  public dialogue: DialogueLine | null = null;
  public drips: CaveDrip[] = [];
  public sonarWaves: SonarWave[] = [];
  public radarCooldown = 0;
  public recentAchievement: AchievementDef | null = null;
  public settings: GameSettings = { ...DEFAULT_SETTINGS };

  private dialogueTimer = 0;
  private dialogueQueue: DialogueLine[] = [];
  private nextDialogueId = 1;
  private idleFxTimer = 0;
  private dripSpawnTimer = 0.5;
  private recentAchievementTimer = 0;
  private statusBannerTimer = 0;

  /* --------------------------- STORY / DIALOGUE --------------------------- */
  public say(speaker: DialogueLine['speaker'], text: string) {
    if (this.dialogueQueue.length > 4) return;
    this.dialogueQueue.push({ id: this.nextDialogueId++, speaker, text });
  }

  /** One-time story beat, persisted in the save so it never repeats. */
  public storyBeat(flag: string, speaker: DialogueLine['speaker'], text: string) {
    if (this.player.storyFlags.includes(flag)) return;
    this.player.storyFlags.push(flag);
    this.say(speaker, text);
  }

  public dismissDialogue() {
    this.dialogue = null;
    this.dialogueTimer = 0;
    this.emitHud(true);
  }

  private updateDialogue(dt: number) {
    if (this.dialogue) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) {
        this.dialogue = null;
        this.emitHud(true);
      }
    }
    if (!this.dialogue && this.dialogueQueue.length > 0) {
      this.dialogue = this.dialogueQueue.shift()!;
      this.dialogueTimer = 2.6 + this.dialogue.text.length * 0.05;
      sound.playBlip(this.dialogue.speaker === 'cube' ? 1.6 : 1);
      this.emitHud(true);
    }
  }

  private checkStoryBeats() {
    const p = this.player;
    const depth = Math.max(0, Math.floor(p.y / TILE_SIZE) - SURFACE_Y);
    if (this.time > 0.4)
      this.storyBeat('welcome', 'mara', "Welcome to the outpost, CUBE-07. The old shaft is right there. Dig deep and bring us ore!");
    if (!p.storyFlags.includes('welcome')) return;
    if (depth >= 3)
      this.storyBeat('enter_mine', 'cube', 'LOG: Rock density rising. Scrap drill nominal. Searching for ore...');
    if (depth >= 15)
      this.storyBeat('depth_15', 'gus', "15 meters and your welds still hold! Bring copper, I'll forge you better thrusters.");
    if (depth >= 36)
      this.storyBeat('depth_36', 'mara', 'Sulfured limestone... my grandfather mined this layer, long before the sky city forgot us.');
    if (depth >= 86)
      this.storyBeat('depth_86', 'ilse', "Brimstone basalt. It's hot down there. Get Gus to harden that drill before you go deeper.");
    if (depth >= 142)
      this.storyBeat('depth_142', 'cube', "LOG: Abyssal obsidian. Aether's archives called this zone 'unreachable.' They were wrong.");
    if (depth >= 186)
      this.storyBeat('depth_186', 'mara', 'The Sulfured Core. Legend says the Heart of Sulfur once powered Aether itself. Find it, Cube.');
    if (p.hull / p.maxHull < 0.3 && !p.godMode)
      this.storyBeat('low_hull', 'ilse', "Your hull's cracking! Get back to the Service Bay before you fall apart again!");
  }

  private updateNpcs(dt: number) {
    const p = this.player;
    const onSurface = Math.floor(p.y / TILE_SIZE) <= SURFACE_Y + 1;
    for (const n of this.npcs) {
      n.bubbleTimer -= dt;
      if (n.bubbleTimer <= 0) n.bubble = null;
      n.waveTimer -= dt;
      n.greetCooldown -= dt;

      if (n.wait > 0) {
        n.wait -= dt;
      } else {
        const dx = n.targetX - n.x;
        if (Math.abs(dx) < 1) {
          n.wait = 1.4 + Math.random() * 3.2;
          n.targetX = n.homeX + (Math.random() * 2 - 1) * n.range;
        } else {
          const dir = dx > 0 ? 1 : -1;
          n.facing = dir;
          n.x += dir * Math.min(Math.abs(dx), (n.id === 'pip' ? 24 : 15) * dt);
          n.walkPhase += dt * (n.id === 'pip' ? 11 : 8);
        }
      }

      const dist = Math.abs(p.x - n.x);
      if (onSurface && dist < 34 && n.greetCooldown <= 0) {
        const lines = NPC_LINES[n.id];
        n.bubble = lines[Math.floor(Math.random() * lines.length)];
        n.bubbleTimer = 3.4;
        n.waveTimer = 1.3;
        n.greetCooldown = 14 + Math.random() * 10;
        n.facing = p.x > n.x ? 1 : -1;
        n.wait = Math.max(n.wait, 2.2);
      } else if (onSurface && dist < 170 && !n.bubble && Math.random() < dt * 0.012) {
        const lines = NPC_LINES[n.id];
        n.bubble = lines[Math.floor(Math.random() * lines.length)];
        n.bubbleTimer = 3;
      }
    }
  }

  private renderNpcs(ctx: CanvasRenderingContext2D) {
    const groundY = SURFACE_Y * TILE_SIZE;
    for (const n of this.npcs) {
      const info = CHARACTERS[n.id];
      if (!info.look) continue;
      const walking = n.wait <= 0 && Math.abs(n.targetX - n.x) > 1;
      // Soft contact shadow
      ctx.fillStyle = 'rgba(8,6,14,0.35)';
      ctx.fillRect(Math.round(n.x) - 5, groundY - 1, 10, 2);
      drawCachedNpc(
        ctx, n.id, n.x, groundY, info.look,
        walking ? 'walk' : n.waveTimer > 0 ? 'wave' : 'idle',
        walking ? n.walkPhase / 8 : this.time + n.homeX,
        n.facing,
        n.id === 'gus' ? 'wrench' : n.id === 'ilse' ? 'lantern' : n.id === 'mara' ? 'clipboard' : null
      );

      const near = Math.abs(this.player.x - n.x) < 70 && Math.floor(this.player.y / TILE_SIZE) <= SURFACE_Y;
      // The speech line itself renders in React; canvas only draws a compact name tag.
      if (near) {
        const headY = groundY - (info.look.small ? 23 : 31);
        const bob = Math.sin(this.time * 4 + n.homeX) * 1.5;
        ctx.font = 'bold 6px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#08060e';
        ctx.fillText(info.name, Math.round(n.x) + 1, headY - 6 + bob + 1);
        ctx.fillStyle = info.accent;
        ctx.fillText(info.name, Math.round(n.x), headY - 6 + bob);
        ctx.fillStyle = n.bubble ? '#fde047' : '#7dd3fc';
        ctx.fillText(n.bubble ? '!' : '?', Math.round(n.x), headY - 16 + bob);
        ctx.textAlign = 'left';
      }
    }
  }

  /** Screen-space anchor for the React NPC speech bubble. */
  private getNpcBubbleAnchor(): { speaker: SpeakerId; text: string; x: number; y: number } | null {
    const talking = this.npcs.find((n) => n.bubble);
    if (!talking) return null;
    const info = CHARACTERS[talking.id];
    const headY = SURFACE_Y * TILE_SIZE - (info.look?.small ? 23 : 31);
    const rawX = (talking.x - this.camX) * this.zoom + this.viewW / 2;
    const rawY = (headY - this.camY) * this.zoom + this.viewH / 2;
    // Dismiss automatically if the player goes deep underground or far away
    if (Math.floor(this.player.y / TILE_SIZE) > SURFACE_Y + 2) {
      talking.bubble = null;
      return null;
    }
    return {
      speaker: talking.id,
      text: talking.bubble!,
      x: rawX,
      y: rawY,
    };
  }

  public interactNpcAt(worldX: number, worldY: number): boolean {
    const groundY = SURFACE_Y * TILE_SIZE;
    if (worldY > groundY + 8 || worldY < groundY - 46) return false;
    for (const n of this.npcs) {
      if (Math.abs(worldX - n.x) <= 18) {
        this.cycleNpcLine(n.id);
        return true;
      }
    }
    return false;
  }

  public cycleNpcLine(speaker: SpeakerId) {
    const npc = this.npcs.find((n) => n.id === speaker);
    if (!npc) return;
    const lines = NPC_LINES[npc.id];
    const currentIdx = npc.bubble ? lines.indexOf(npc.bubble) : -1;
    const nextIdx = (currentIdx + 1) % lines.length;
    // Clear other active bubbles so only one displays cleanly
    for (const other of this.npcs) {
      if (other.id !== npc.id) other.bubble = null;
    }
    npc.bubble = lines[nextIdx];
    npc.bubbleTimer = 5.0;
    npc.waveTimer = 1.4;
    npc.facing = this.player.x >= npc.x ? 1 : -1;
    npc.wait = Math.max(npc.wait, 3.0);
    sound.playBlip(1.05);
    this.emitHud(true);
  }

  public dismissNpcBubble() {
    for (const n of this.npcs) {
      n.bubble = null;
      n.bubbleTimer = 0;
    }
    this.emitHud(true);
  }

  private accumulator = 0;
  private interpAlpha = 1;
  private nextEntityId = 1;
  private saveCooldown = 0;
  private hudEmitCooldown = 0;
  private ambientCooldown = 0;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onOpenOutpost: (building: OutpostBuilding) => void;

  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private edgeColorCache = new Map<TileType, [string, string]>();

  /** Memoized bevel colors per tile type (highlight, shadow). */
  private getEdgeColors(type: TileType): [string, string] {
    let cached = this.edgeColorCache.get(type);
    if (!cached) {
      const base = TILES[type].particleColor;
      cached = [shade(base, 0.45), shade(base, -0.52)];
      this.edgeColorCache.set(type, cached);
    }
    return cached;
  }

  constructor(
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onOpenOutpost: (building: OutpostBuilding) => void
  ) {
    this.onHudUpdate = onHudUpdate;
    this.onOpenOutpost = onOpenOutpost;

    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d')!;

    this.grid = generateWorld();
    this.explored = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    this.player = this.createInitialPlayer();
    this.marketSurge = this.rollMarketSurge();

    this.loadGame();
    this.snapCameraToPlayer();
    this.revealAroundPlayer();
  }

  private createInitialPlayer(): PlayerState {
    // Spawn standing safely on the outpost steel deck, right beside the shaft mouth
    const startX = (OUTPOST_ZONES.SHAFT.startX - 2) * TILE_SIZE + TILE_SIZE / 2;
    const startY = (SURFACE_Y - 1) * TILE_SIZE;
    return {
      x: startX,
      y: startY,
      prevX: startX,
      prevY: startY,
      vx: 0,
      vy: 0,
      width: 13,
      height: 14,
      onGround: false,
      facing: 'down',
      aimAngle: Math.PI / 2,
      aimVisual: Math.PI / 2,
      isDrilling: false,
      isThrusting: false,
      thrustVisual: 0,
      drillExtend: 0,
      drillSpin: 0,
      drillTarget: null,
      drillProgress: 0,
      drillHeat: 0,
      wheelPhase: 0,
      bobPhase: 0,
      squashX: 1,
      squashY: 1,
      invulnTimer: 0,
      damageFlash: 0,
      godMode: false,
      infiniteFuel: false,
      idleTime: 0,
      storyFlags: [],
      miningCombo: 0,
      comboTimer: 0,
      credits: 25,
      hull: 100,
      maxHull: 100,
      fuel: 100,
      maxFuel: 100,
      cargo: createEmptyCargo(),
      upgrades: { drill: 1, thruster: 1, cargo: 1, fuel: 1, armor: 1, headlamp: 1 },
      consumables: { bomb: 2, torch: 4, recall: 1 },
      achievements: [],
      maxDepthReached: 0,
      totalBlocksMined: 0,
      totalCreditsEarned: 0,
    };
  }

  private rollMarketSurge(): MarketSurge {
    const maxD = Math.max(15, this.player?.maxDepthReached || 25);
    const eligible = ORE_LIST.filter((o) => o.minDepth <= maxD + 20);
    const chosen = eligible[Math.floor(Math.random() * eligible.length)] || ORES.sulfur;
    return { oreId: chosen.id, multiplier: 1.35, timeRemaining: 120 };
  }

  /* --------------------------- QUERIES --------------------------- */
  public getUpgradeValue(key: UpgradeKey): number {
    const lvl = this.player.upgrades[key];
    const tiers = UPGRADE_TRACKS[key].tiers;
    return tiers[Math.max(0, Math.min(tiers.length - 1, lvl - 1))].value;
  }

  public getCargoCount(): number {
    let total = 0;
    for (const k of Object.keys(this.player.cargo) as OreId[]) total += this.player.cargo[k] || 0;
    return total;
  }

  public getCargoCapacity(): number {
    return this.getUpgradeValue('cargo');
  }

  public getNearbyBuilding(): OutpostBuilding {
    const gx = this.player.x / TILE_SIZE;
    const gy = Math.floor(this.player.y / TILE_SIZE);
    if (gy > SURFACE_Y + 1) return null;
    if (gx >= OUTPOST_ZONES.REFINERY.startX - 0.5 && gx <= OUTPOST_ZONES.REFINERY.endX + 0.5)
      return 'refinery';
    if (gx >= OUTPOST_ZONES.FORGE.startX - 0.5 && gx <= OUTPOST_ZONES.FORGE.endX + 0.5)
      return 'forge';
    if (gx >= OUTPOST_ZONES.REPAIR.startX - 0.5 && gx <= OUTPOST_ZONES.REPAIR.endX + 0.5)
      return 'repair';
    return null;
  }

  public setBanner(msg: string, duration = 2.6) {
    this.statusBanner = msg;
    this.statusBannerTimer = duration;
    this.emitHud(true);
  }

  public addFloatingText(x: number, y: number, text: string, color: string) {
    if (this.floatingTexts.length > 40) this.floatingTexts.shift();
    this.floatingTexts.push({ x, y, vy: -26, text, color, life: 1.2, maxLife: 1.2 });
  }

  public addShake(intensity: number, duration: number) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  public spawnParticles(
    x: number,
    y: number,
    color: string,
    count: number,
    speed = 55,
    glow = false
  ) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.25 + Math.random() * 0.75) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 18,
        size: Math.random() < 0.4 ? 2 : 1,
        color,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
        gravity: 165,
        glow,
      });
    }
    if (this.particles.length > 420) {
      this.particles.splice(0, this.particles.length - 420);
    }
  }

  public getOreSellPrice(oreId: OreId): number {
    const base = ORES[oreId].baseValue;
    return this.marketSurge.oreId === oreId ? Math.round(base * this.marketSurge.multiplier) : base;
  }

  /* ------------------------- ECONOMY ------------------------- */
  public sellAllOres(): number {
    let earned = 0;
    let soldCount = 0;
    for (const ore of ORE_LIST) {
      const qty = this.player.cargo[ore.id] || 0;
      if (qty > 0) {
        earned += qty * this.getOreSellPrice(ore.id);
        soldCount += qty;
        this.player.cargo[ore.id] = 0;
      }
    }
    if (earned > 0) {
      this.player.credits += earned;
      this.player.totalCreditsEarned += earned;
      sound.playSellCash();
      this.addFloatingText(this.player.x, this.player.y - 16, `+$${earned}`, '#fde047');
      this.spawnParticles(this.player.x, this.player.y - 6, '#fde047', 16, 60, true);
      this.setBanner(`SOLD ${soldCount} ORES FOR $${earned}!`, 2.2);
      this.storyBeat('first_sale', 'mara', "Good haul, little cube! Now go see Gus at the Forge. He's been saving parts just for you.");

      this.checkAchievement('first_sale');
      if (this.player.cargo[this.marketSurge.oreId] === 0) {
        this.checkAchievement('market_surge');
      }

      this.saveGame();
      this.emitHud(true);
    }
    return earned;
  }

  public sellSingleOre(oreId: OreId, amount = 1): number {
    const have = this.player.cargo[oreId] || 0;
    const qty = Math.min(have, amount);
    if (qty <= 0) return 0;
    const earned = qty * this.getOreSellPrice(oreId);
    this.player.cargo[oreId] -= qty;
    this.player.credits += earned;
    this.player.totalCreditsEarned += earned;
    sound.playSellCash();
    this.addFloatingText(this.player.x, this.player.y - 16, `+$${earned}`, '#fde047');
    this.saveGame();
    this.emitHud(true);
    return earned;
  }

  public buyUpgrade(key: UpgradeKey): boolean {
    const currentLvl = this.player.upgrades[key];
    const track = UPGRADE_TRACKS[key];
    if (currentLvl >= track.tiers.length) return false;
    const nextTier = track.tiers[currentLvl];
    if (this.player.credits < nextTier.cost) return false;

    this.player.credits -= nextTier.cost;
    this.player.upgrades[key] = currentLvl + 1;
    if (key === 'fuel') {
      this.player.maxFuel = nextTier.value;
      this.player.fuel = this.player.maxFuel;
    } else if (key === 'armor') {
      this.player.maxHull = nextTier.value;
      this.player.hull = this.player.maxHull;
    }

    sound.playUpgrade();
    this.spawnParticles(this.player.x, this.player.y, track.accentColor, 22, 75, true);
    this.addFloatingText(this.player.x, this.player.y - 18, nextTier.title, track.accentColor);
    this.setBanner(`UPGRADED: ${nextTier.title.toUpperCase()}`, 2.4);
    this.storyBeat('first_upgrade', 'gus', "There! Better than anything they bolted on you up in Aether, eh? Keep the ore coming.");
    this.checkAchievement('first_upgrade');

    if (currentLvl + 1 >= track.tiers.length) {
      this.storyBeat(`maxed_${key}`, 'cube', `LOG: ${track.name} at maximum. Aether never built me this well.`);
      this.checkAchievement('tier5_system');
    }
    this.saveGame();
    this.emitHud(true);
    return true;
  }

  public buyConsumable(key: ConsumableKey): boolean {
    const def = CONSUMABLES[key];
    const current = this.player.consumables[key] || 0;
    if (current >= def.maxCarry || this.player.credits < def.cost) return false;
    this.player.credits -= def.cost;
    this.player.consumables[key] = current + 1;
    sound.playOreCollect(40);
    this.saveGame();
    this.emitHud(true);
    return true;
  }

  public instantServiceRefill(): boolean {
    const needHull = this.player.hull < this.player.maxHull;
    const needFuel = this.player.fuel < this.player.maxFuel;
    if (!needHull && !needFuel) return false;
    this.player.hull = this.player.maxHull;
    this.player.fuel = this.player.maxFuel;
    sound.playUpgrade();
    this.spawnParticles(this.player.x, this.player.y, '#4ade80', 16, 55, true);
    this.addFloatingText(this.player.x, this.player.y - 16, 'SYSTEMS 100%', '#4ade80');
    this.saveGame();
    this.emitHud(true);
    return true;
  }

  public useConsumable(key: ConsumableKey): boolean {
    if (this.paused) return false;
    const count = this.player.consumables[key] || 0;
    if (count <= 0) {
      this.setBanner(`OUT OF ${CONSUMABLES[key].name.toUpperCase()}S!`, 1.6);
      return false;
    }

    if (key === 'bomb') {
      this.player.consumables.bomb--;
      let throwVx = 0;
      if (this.player.facing === 'right') throwVx = 60;
      if (this.player.facing === 'left') throwVx = -60;
      this.bombs.push({
        id: this.nextEntityId++,
        x: this.player.x,
        y: this.player.y,
        vx: throwVx,
        vy: -45,
        fuse: 1.5,
        maxFuse: 1.5,
      });
      sound.playTorch();
      this.emitHud(true);
      return true;
    }

    if (key === 'torch') {
      const gx = Math.floor(this.player.x / TILE_SIZE);
      const gy = Math.floor(this.player.y / TILE_SIZE);
      if (this.torches.some((t) => t.gx === gx && t.gy === gy)) return false;
      this.player.consumables.torch--;
      this.torches.push({ gx, gy, flickerOffset: Math.random() * 10 });
      sound.playTorch();
      this.spawnParticles(gx * TILE_SIZE + 8, gy * TILE_SIZE + 8, '#fde047', 10, 32, true);
      this.saveGame();
      this.emitHud(true);
      return true;
    }

    if (key === 'recall') {
      const depth = Math.floor(this.player.y / TILE_SIZE) - SURFACE_Y;
      if (depth <= 1) {
        this.setBanner('ALREADY AT SURFACE OUTPOST!', 1.5);
        return false;
      }
      this.player.consumables.recall--;
      this.spawnParticles(this.player.x, this.player.y, '#38bdf8', 26, 90, true);
      this.player.x = OUTPOST_ZONES.REFINERY.centerX * TILE_SIZE;
      this.player.y = (SURFACE_Y - 1) * TILE_SIZE;
      this.player.prevX = this.player.x;
      this.player.prevY = this.player.y;
      this.player.vx = 0;
      this.player.vy = 0;
      sound.playWarp();
      this.spawnParticles(this.player.x, this.player.y, '#38bdf8', 26, 90, true);
      this.addFloatingText(this.player.x, this.player.y - 18, 'WARP COMPLETE!', '#38bdf8');
      this.saveGame();
      this.emitHud(true);
      return true;
    }
    return false;
  }

  public interactWithNearbyBuilding(): boolean {
    const b = this.getNearbyBuilding();
    if (!b) return false;
    if (b === 'repair') {
      this.instantServiceRefill();
      return true;
    }
    this.onOpenOutpost(b);
    return true;
  }

  public checkAchievement(id: string) {
    if (this.player.achievements.includes(id)) return;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;

    this.player.achievements.push(id);
    this.player.credits += def.rewardCredits;
    this.player.totalCreditsEarned += def.rewardCredits;
    this.recentAchievement = def;
    this.recentAchievementTimer = 4.2;

    sound.playAchievement();
    this.addFloatingText(this.player.x, this.player.y - 24, `★ ${def.title.toUpperCase()}! (+$${def.rewardCredits})`, '#fde047');
    this.spawnParticles(this.player.x, this.player.y - 12, '#fde047', 24, 85, true);
    this.setBanner(`ACHIEVEMENT: ${def.title.toUpperCase()} (+$${def.rewardCredits})`, 3.5);
    this.saveGame();
    this.emitHud(true);
  }

  public triggerRadarPing(): boolean {
    if (this.radarCooldown > 0) return false;
    this.radarCooldown = 7.5;
    sound.playSonarPing();
    this.sonarWaves.push({
      x: this.player.x,
      y: this.player.y,
      radius: 12,
      maxRadius: 280,
      life: 0.9,
      maxLife: 0.9,
    });
    this.addFloatingText(this.player.x, this.player.y - 18, 'RADAR PING!', '#38bdf8');
    this.addShake(1.5, 0.12);
    this.emitHud(true);
    return true;
  }

  public updateSettings(partial: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...partial };
    try {
      localStorage.setItem('sulfured_settings', JSON.stringify(this.settings));
    } catch {
      // storage quota
    }
    sound.setVolumes(this.settings.sfxVolume, this.settings.musicVolume);
    this.emitHud(true);
  }

  public resetNewExpedition() {
    localStorage.removeItem(SAVE_KEY);
    this.grid = generateWorld(Date.now());
    this.explored = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    this.player = this.createInitialPlayer();
    this.drops = [];
    this.particles = [];
    this.floatingTexts = [];
    this.bombs = [];
    this.torches = [];
    this.gasClouds = [];
    this.marketSurge = this.rollMarketSurge();
    this.snapCameraToPlayer();
    this.revealAroundPlayer();
    this.saveGame();
    this.setBanner('NEW EXPEDITION STARTED!', 2.5);
    this.emitHud(true);
  }

  public snapCameraToPlayer() {
    this.camX = this.player.x;
    this.camY = this.player.y;
  }

  /* --------------------------- TILE API --------------------------- */
  private getTile(gx: number, gy: number): TileType {
    if (gx < 0 || gx >= WORLD_WIDTH || gy < 0 || gy >= WORLD_HEIGHT) return TileType.CORE_BEDROCK;
    return this.grid[gy][gx];
  }

  private setTile(gx: number, gy: number, type: TileType) {
    if (gx >= 0 && gx < WORLD_WIDTH && gy >= 0 && gy < WORLD_HEIGHT) this.grid[gy][gx] = type;
  }

  private isSolid(gx: number, gy: number): boolean {
    return TILES[this.getTile(gx, gy)].solid;
  }

  /* --------------------------- MAIN LOOP --------------------------- */
  public update(dt: number, viewWidth: number, viewHeight: number) {
    if (this.paused) {
      this.interpAlpha = 1;
      return;
    }

    const clampedDt = Math.min(dt, 0.1);
    this.time += clampedDt;
    this.viewW = viewWidth;
    this.viewH = viewHeight;

    const minDim = Math.min(viewWidth, viewHeight);
    this.zoom = Math.max(2, Math.min(4, Math.round(minDim / 210)));

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - clampedDt);
      if (this.shakeTime === 0) this.shakeIntensity = 0;
    } else {
      this.shakeIntensity *= 0.86;
    }

    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= clampedDt;
      if (this.statusBannerTimer <= 0) this.statusBanner = null;
    }

    this.marketSurge.timeRemaining -= clampedDt;
    if (this.marketSurge.timeRemaining <= 0) {
      this.marketSurge = this.rollMarketSurge();
      this.setBanner(`MARKET SURGE: ${ORES[this.marketSurge.oreId].name.toUpperCase()} +35%!`, 3.0);
    }

    // Fixed-timestep physics with render interpolation
    this.accumulator += clampedDt;
    let iterations = 0;
    while (this.accumulator >= FIXED_STEP && iterations < 10) {
      this.player.prevX = this.player.x;
      this.player.prevY = this.player.y;
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      iterations++;
    }
    if (iterations === 10) this.accumulator = 0;
    this.interpAlpha = this.accumulator / FIXED_STEP;

    this.spawnAmbient(clampedDt);
    this.updateParticles(clampedDt);
    this.updateFloatingTexts(clampedDt);
    this.revealAroundPlayer();
    this.updateNpcs(clampedDt);
    this.checkStoryBeats();
    this.updateDialogue(clampedDt);
    this.updateIdleFx(clampedDt);

    // Smooth critically-damped camera with directional lookahead
    const rx = this.player.prevX + (this.player.x - this.player.prevX) * this.interpAlpha;
    const ry = this.player.prevY + (this.player.y - this.player.prevY) * this.interpAlpha;
    const lookX = this.player.vx * 0.16;
    const lookY = this.player.vy * 0.1;
    const smoothing = 1 - Math.pow(0.0016, clampedDt);
    this.camX += (rx + lookX - this.camX) * smoothing;
    this.camY += (ry + lookY - this.camY) * smoothing;

    const halfW = viewWidth / (2 * this.zoom);
    const halfH = viewHeight / (2 * this.zoom);
    const worldPxW = WORLD_WIDTH * TILE_SIZE;
    const worldPxH = WORLD_HEIGHT * TILE_SIZE;
    this.camX = worldPxW > halfW * 2 ? Math.max(halfW, Math.min(worldPxW - halfW, this.camX)) : worldPxW / 2;
    this.camY = Math.max(halfH - 40, Math.min(worldPxH - halfH, this.camY));

    this.saveCooldown -= clampedDt;
    if (this.saveCooldown <= 0) {
      this.saveCooldown = 5.0;
      this.saveGame();
    }

    this.hudEmitCooldown -= clampedDt;
    if (this.hudEmitCooldown <= 0) {
      this.hudEmitCooldown = 0.06;
      this.emitHud(false);
    }
  }

  /** Idle personality FX: steam puffs while waiting, floating Zzz when asleep. */
  private updateIdleFx(dt: number) {
    const p = this.player;
    if (p.idleTime < 2) {
      this.idleFxTimer = 0.6;
      return;
    }
    this.idleFxTimer -= dt;
    if (this.idleFxTimer > 0) return;
    if (p.idleTime > 9) {
      this.idleFxTimer = 1.3;
      this.floatingTexts.push({
        x: p.x + 7,
        y: p.y - 14,
        vy: -14,
        text: Math.random() < 0.5 ? 'z' : 'Z',
        color: '#a5b4fc',
        life: 1.6,
        maxLife: 1.6,
      });
    } else {
      this.idleFxTimer = 2.2 + Math.random() * 1.5;
      // Little exhaust steam sigh from the back vent
      for (let i = 0; i < 5; i++) {
        this.particles.push({
          x: p.x - 7 * (p.facing === 'left' ? -1 : 1),
          y: p.y - 4,
          vx: (p.facing === 'left' ? 1 : -1) * (6 + Math.random() * 8),
          vy: -10 - Math.random() * 10,
          size: 2,
          color: '#cbd5e1',
          life: 0.7,
          maxLife: 0.7,
          gravity: -8,
          glow: false,
        });
      }
    }
  }

  /** Single deterministic physics tick. */
  private step(h: number) {
    this.updatePlayer(h);
    this.updateBombs(h);
    this.updateGasClouds(h);
    this.updateDrops(h);
    this.updateDrips(h);
    this.updateSonarWaves(h);
  }

  private updatePlayer(h: number) {
    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - h);
    p.damageFlash = Math.max(0, p.damageFlash - h * 3.4);
    p.squashX += (1 - p.squashX) * Math.min(1, h * 16);
    p.squashY += (1 - p.squashY) * Math.min(1, h * 16);
    p.bobPhase += h * (p.onGround && Math.abs(p.vx) < 3 ? 2.1 : 5.4);

    // Combo streak decay
    if (p.comboTimer > 0) {
      p.comboTimer -= h;
      if (p.comboTimer <= 0) p.miningCombo = 0;
    }
    if (this.radarCooldown > 0) this.radarCooldown = Math.max(0, this.radarCooldown - h);
    if (this.recentAchievementTimer > 0) {
      this.recentAchievementTimer -= h;
      if (this.recentAchievementTimer <= 0) this.recentAchievement = null;
    }

    const active =
      Math.abs(this.input.moveX) > 0.1 ||
      Math.abs(this.input.moveY) > 0.1 ||
      this.input.thrustHeld ||
      this.input.drillHeld ||
      this.input.pointerActive ||
      !p.onGround ||
      p.damageFlash > 0.1;
    if (active && p.idleTime > 9) {
      // Startled awake!
      p.squashX = 0.86;
      p.squashY = 1.18;
    }
    p.idleTime = active ? 0 : p.idleTime + h;

    const gy = Math.floor(p.y / TILE_SIZE);
    const depthMeters = Math.max(0, gy - SURFACE_Y);
    if (depthMeters > p.maxDepthReached) p.maxDepthReached = depthMeters;

    if (depthMeters >= 50) this.checkAchievement('depth_50');
    if (depthMeters >= 100) this.checkAchievement('depth_100');
    sound.setStrataMusic(this.stratumIndexOf(gy));

    // Surface services
    if (gy <= SURFACE_Y) {
      p.fuel = Math.min(p.maxFuel, p.fuel + 60 * h);
      if (this.getNearbyBuilding() === 'repair' && p.hull < p.maxHull) {
        p.hull = Math.min(p.maxHull, p.hull + 40 * h);
      }
    }
    if (p.infiniteFuel) p.fuel = p.maxFuel;

    // Horizontal movement
    const moveSpeed = 88;
    const targetVx = this.input.moveX * moveSpeed;
    const accel = p.onGround ? 15 : 10;
    p.vx += (targetVx - p.vx) * Math.min(1, h * accel);
    if (Math.abs(p.vx) < 1.2 && Math.abs(this.input.moveX) < 0.05) p.vx = 0;

    // Thrusters
    const wantsThrust = this.input.thrustHeld || this.input.moveY < -0.35;
    p.isThrusting = false;
    if (wantsThrust && (p.fuel > 0 || p.infiniteFuel)) {
      const liftSpeed = this.getUpgradeValue('thruster');
      p.vy += (-liftSpeed - p.vy) * Math.min(1, h * 8);
      p.isThrusting = true;
      if (!p.infiniteFuel) p.fuel = Math.max(0, p.fuel - 9.5 * h);
      if (Math.random() < 0.5) {
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 9,
          y: p.y + 8,
          vx: (Math.random() - 0.5) * 20,
          vy: 40 + Math.random() * 30,
          size: Math.random() < 0.4 ? 2 : 1,
          color: Math.random() < 0.45 ? '#fff3b0' : '#f97316',
          life: 0.24,
          maxLife: 0.24,
          gravity: 25,
          glow: true,
        });
      }
    } else {
      p.vy = Math.min(250, p.vy + 325 * h);
    }
    // Smooth flame ramp (no popping)
    p.thrustVisual += ((p.isThrusting ? 1 : 0) - p.thrustVisual) * Math.min(1, h * 12);

    this.updateAimAndFacing(h);

    // Collisions
    const prevY = p.y;
    p.x += p.vx * h;
    this.resolveHorizontalCollisions();
    const preLandVy = p.vy;
    const wasOnGround = p.onGround;
    p.y += p.vy * h;
    this.resolveVerticalCollisions(wasOnGround, preLandVy);

    if (p.onGround && Math.abs(p.vx) > 3) {
      p.wheelPhase += p.vx * h * 0.5;
      if (Math.random() < Math.abs(p.vx) * h * 0.035) {
        this.particles.push({
          x: p.x - Math.sign(p.vx) * 7,
          y: p.y + 8,
          vx: -Math.sign(p.vx) * (8 + Math.random() * 14),
          vy: -8 - Math.random() * 14,
          size: 1,
          color: '#9a8f86',
          life: 0.3 + Math.random() * 0.2,
          maxLife: 0.5,
          gravity: -12,
        });
      }
    }
    else if (!p.onGround) p.wheelPhase += h * 2;

    this.checkEnvironmentalHazards();
    this.updateDrilling(h);

    // Failure states
    if (p.hull <= 0 && !p.godMode) {
      this.triggerEmergencyRescue('HULL CRITICAL! RESCUE DRONE DEPLOYED');
    } else if (
      !p.infiniteFuel &&
      p.fuel <= 0 &&
      gy > SURFACE_Y + 4 &&
      Math.abs(p.vy) < 2 &&
      Math.abs(prevY - p.y) < 0.02 &&
      wantsThrust
    ) {
      this.triggerEmergencyRescue('ENERGY DEPLETED! RESCUE DRONE DEPLOYED');
    }
  }

  private updateAimAndFacing(h: number) {
    const p = this.player;
    let targetAngle = p.aimAngle;

    if (this.input.pointerActive) {
      const dx = this.input.pointerWorldX - p.x;
      const dy = this.input.pointerWorldY - p.y;
      if (Math.hypot(dx, dy) > 3) {
        targetAngle = Math.atan2(dy, dx);
        p.facing =
          Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
      }
    } else {
      const mx = this.input.moveX;
      const my = this.input.moveY;
      if (Math.abs(mx) > 0.25 || Math.abs(my) > 0.25) {
        if (Math.abs(my) > Math.abs(mx) * 1.15) {
          p.facing = my > 0 ? 'down' : 'up';
          targetAngle = my > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          p.facing = mx > 0 ? 'right' : 'left';
          targetAngle = mx > 0 ? 0 : Math.PI;
        }
      }
    }

    p.aimAngle = targetAngle;
    // Eased visual swing; when idle the drill arm relaxes downward and sways
    const resting = p.idleTime > 1.2;
    const sleepy = p.idleTime > 9;
    const rest = (p.facing === 'left' ? Math.PI - 0.8 : 0.8) * (sleepy ? 1.35 : 1);
    const sway = Math.sin(p.idleTime * 1.1) * (sleepy ? 0.03 : 0.09);
    p.aimVisual = lerpAngle(
      p.aimVisual,
      resting ? rest + sway : targetAngle,
      Math.min(1, h * (resting ? 3 : 18))
    );
  }

  private resolveHorizontalCollisions() {
    const p = this.player;
    const halfW = p.width / 2;
    const halfH = p.height / 2 - 2;
    const topGy = Math.floor((p.y - halfH) / TILE_SIZE);
    const botGy = Math.floor((p.y + halfH) / TILE_SIZE);

    if (p.vx > 0) {
      const rightGx = Math.floor((p.x + halfW) / TILE_SIZE);
      for (let gy = topGy; gy <= botGy; gy++) {
        if (this.isSolid(rightGx, gy)) {
          p.x = rightGx * TILE_SIZE - halfW - 0.01;
          p.vx = 0;
          break;
        }
      }
    } else if (p.vx < 0) {
      const leftGx = Math.floor((p.x - halfW) / TILE_SIZE);
      for (let gy = topGy; gy <= botGy; gy++) {
        if (this.isSolid(leftGx, gy)) {
          p.x = (leftGx + 1) * TILE_SIZE + halfW + 0.01;
          p.vx = 0;
          break;
        }
      }
    }
  }

  private resolveVerticalCollisions(wasOnGround: boolean, preLandVy: number) {
    const p = this.player;
    const halfW = p.width / 2 - 2;
    const halfH = p.height / 2;
    const leftGx = Math.floor((p.x - halfW) / TILE_SIZE);
    const rightGx = Math.floor((p.x + halfW) / TILE_SIZE);
    p.onGround = false;

    if (p.vy >= 0) {
      const botGy = Math.floor((p.y + halfH) / TILE_SIZE);
      for (let gx = leftGx; gx <= rightGx; gx++) {
        if (this.isSolid(gx, botGy)) {
          p.y = botGy * TILE_SIZE - halfH - 0.01;
          p.vy = 0;
          p.onGround = true;
          if (!wasOnGround && preLandVy > 105) {
            p.squashX = 1 + Math.min(0.28, (preLandVy - 105) / 420);
            p.squashY = 1 - Math.min(0.24, (preLandVy - 105) / 500);
            this.spawnParticles(p.x, p.y + halfH, '#8a8074', 6, 40);
            if (preLandVy > 200) {
              const resist = [0, 0.25, 0.5, 0.7, 0.85][p.upgrades.armor - 1] || 0;
              const dmg = Math.max(1, Math.round(((preLandVy - 200) / 60) * 18 * (1 - resist)));
              this.damagePlayer(dmg, 'FALL IMPACT!');
            }
          }
          break;
        }
      }
    } else {
      const topGy = Math.floor((p.y - halfH) / TILE_SIZE);
      for (let gx = leftGx; gx <= rightGx; gx++) {
        if (this.isSolid(gx, topGy)) {
          p.y = (topGy + 1) * TILE_SIZE + halfH + 0.01;
          p.vy = 0;
          break;
        }
      }
    }
  }

  private checkEnvironmentalHazards() {
    const p = this.player;
    if (p.invulnTimer > 0 || p.godMode) return;
    const gx = Math.floor(p.x / TILE_SIZE);
    const gy = Math.floor(p.y / TILE_SIZE);
    const neighbors = [
      [gx, gy + 1],
      [gx - 1, gy],
      [gx + 1, gy],
      [gx, gy - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (this.getTile(nx, ny) === TileType.MAGMA_ROCK) {
        const resist = [0, 0.25, 0.5, 0.7, 0.85][p.upgrades.armor - 1] || 0;
        this.damagePlayer(Math.max(2, Math.round(10 * (1 - resist))), 'MAGMA HEAT!');
        break;
      }
    }
  }

  private damagePlayer(amount: number, label: string) {
    const p = this.player;
    if (p.invulnTimer > 0 || p.godMode) return;
    p.hull = Math.max(0, p.hull - amount);
    p.invulnTimer = 0.75;
    p.damageFlash = 1;
    sound.playHurt();
    this.addShake(4, 0.2);
    this.spawnParticles(p.x, p.y, '#ef4444', 12, 65, true);
    this.addFloatingText(p.x, p.y - 14, `-${amount} ${label}`, '#fb7185');
    this.emitHud(true);
  }

  private triggerEmergencyRescue(reason: string) {
    const p = this.player;
    sound.playWarp();
    this.spawnParticles(p.x, p.y, '#38bdf8', 28, 95, true);
    p.x = OUTPOST_ZONES.REPAIR.centerX * TILE_SIZE;
    p.y = (SURFACE_Y - 1) * TILE_SIZE;
    p.prevX = p.x;
    p.prevY = p.y;
    p.vx = 0;
    p.vy = 0;
    p.hull = Math.round(p.maxHull * 0.65);
    p.fuel = Math.round(p.maxFuel * 0.65);
    p.invulnTimer = 1.5;
    this.snapCameraToPlayer();
    this.setBanner(reason, 3.5);
    this.saveGame();
    this.emitHud(true);
  }

  private updateDrilling(h: number) {
    const p = this.player;
    p.isDrilling = false;

    const gx = Math.floor(p.x / TILE_SIZE);
    const gy = Math.floor(p.y / TILE_SIZE);
    let targetGx = gx;
    let targetGy = gy;
    let wantsDrill = this.input.drillHeld;

    if (this.input.pointerActive) {
      const ptrGx = Math.floor(this.input.pointerWorldX / TILE_SIZE);
      const ptrGy = Math.floor(this.input.pointerWorldY / TILE_SIZE);
      const dist = Math.hypot(ptrGx - gx, ptrGy - gy);
      if (dist > 0 && dist <= 2.0 && this.isSolid(ptrGx, ptrGy)) {
        targetGx = ptrGx;
        targetGy = ptrGy;
        wantsDrill = true;
      }
    }

    if (targetGx === gx && targetGy === gy) {
      if (this.input.moveX > 0.35) {
        targetGx = gx + 1;
        wantsDrill = true;
      } else if (this.input.moveX < -0.35) {
        targetGx = gx - 1;
        wantsDrill = true;
      } else if (this.input.moveY > 0.35) {
        targetGy = gy + 1;
        wantsDrill = true;
      } else if (this.input.drillHeld) {
        if (p.facing === 'right') targetGx = gx + 1;
        else if (p.facing === 'left') targetGx = gx - 1;
        else if (p.facing === 'down') targetGy = gy + 1;
        else targetGy = gy - 1;
      }
    }

    if (!wantsDrill || (targetGx === gx && targetGy === gy)) {
      p.drillTarget = null;
      p.drillProgress = 0;
      p.drillExtend += (0 - p.drillExtend) * Math.min(1, h * 10);
      p.drillSpin += h * 0.35; // Idle slow spin
      return;
    }

    const tileType = this.getTile(targetGx, targetGy);
    const def = TILES[tileType];
    if (!def.solid || !def.destructible) {
      p.drillTarget = null;
      p.drillProgress = 0;
      p.drillExtend += (0 - p.drillExtend) * Math.min(1, h * 10);
      return;
    }

    if (p.fuel <= 0 && !p.infiniteFuel) {
      p.drillTarget = null;
      p.drillProgress = 0;
      this.setBanner('LOW ENERGY! RETURN TO SURFACE', 1.5);
      return;
    }

    const tileCenterX = targetGx * TILE_SIZE + TILE_SIZE / 2;
    const tileCenterY = targetGy * TILE_SIZE + TILE_SIZE / 2;
    p.aimAngle = Math.atan2(tileCenterY - p.y, tileCenterX - p.x);
    // Swing the arm smoothly toward the block actually being drilled
    p.aimVisual = lerpAngle(p.aimVisual, p.aimAngle, Math.min(1, h * 22));

    const drillTier = p.upgrades.drill;
    if (drillTier < def.minDrillTier) {
      p.isDrilling = true;
      p.drillProgress = 0;
      p.drillExtend += (0.55 - p.drillExtend) * Math.min(1, h * 12);
      p.drillSpin += h * 2.2;
      sound.playDrillTick(0, true);
      if (Math.random() < 0.3) this.spawnParticles(tileCenterX, tileCenterY, '#fde047', 2, 50, true);
      this.setBanner(`NEED DRILL MK.${def.minDrillTier} FOR ${def.name.toUpperCase()}!`, 1.4);
      return;
    }

    if (!p.drillTarget || p.drillTarget.gx !== targetGx || p.drillTarget.gy !== targetGy) {
      p.drillTarget = { gx: targetGx, gy: targetGy };
      p.drillProgress = 0;
    }

    p.isDrilling = true;
    const baseDrillPower = this.getUpgradeValue('drill');
    // Mining combo multiplier bonus (+5% speed per combo tier!)
    const comboMult = 1 + p.miningCombo * 0.05;
    const drillPower = baseDrillPower * comboMult;
    const fuelEfficiency = 1 / (1 + (p.upgrades.fuel - 1) * 0.14);
    if (!p.infiniteFuel) p.fuel = Math.max(0, p.fuel - 5.2 * fuelEfficiency * h);

    p.drillProgress += (drillPower / def.hardness) * h;
    p.drillExtend += (1 - p.drillExtend) * Math.min(1, h * 14);
    p.drillSpin += h * (2.6 + drillPower * 0.9);
    sound.playDrillTick(Math.min(1, p.drillProgress), false, p.upgrades.drill);

    // Rock chips + occasional sparks
    if (Math.random() < 0.5) {
      this.spawnParticles(
        tileCenterX + (Math.random() - 0.5) * 9,
        tileCenterY + (Math.random() - 0.5) * 9,
        def.particleColor,
        2,
        45
      );
    }
    if (Math.random() < 0.16) {
      this.particles.push({
        x: tileCenterX + (Math.random() - 0.5) * 6,
        y: tileCenterY + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 90,
        vy: -30 - Math.random() * 55,
        size: 1,
        color: Math.random() < 0.5 ? '#fff3b0' : '#fbbf24',
        life: 0.26,
        maxLife: 0.26,
        gravity: 190,
        glow: true,
      });
    }

    if (p.drillProgress >= 1) {
      this.breakTile(targetGx, targetGy);
      p.drillTarget = null;
      p.drillProgress = 0;
    }
  }

  private breakTile(gx: number, gy: number) {
    const type = this.getTile(gx, gy);
    const def = TILES[type];
    if (!def.solid || !def.destructible) return;

    this.setTile(gx, gy, TileType.AIR);
    this.player.totalBlocksMined++;

    const cx = gx * TILE_SIZE + TILE_SIZE / 2;
    const cy = gy * TILE_SIZE + TILE_SIZE / 2;

    sound.playBlockBreak(Boolean(def.oreId));
    this.addShake(def.oreId ? 2.4 : 1.4, 0.1);
    this.spawnParticles(cx, cy, def.particleColor, def.oreId ? 16 : 10, 70, Boolean(def.oreId));
    // Chunky rock shards that tumble out of the broken block
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 10,
        y: cy + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 70,
        vy: -40 - Math.random() * 50,
        size: 3,
        color: i % 2 ? def.particleColor : shade(def.particleColor, -0.35),
        life: 0.55 + Math.random() * 0.3,
        maxLife: 0.85,
        gravity: 260,
      });
    }

    // Combo momentum streak
    this.player.miningCombo = Math.min(10, this.player.miningCombo + 1);
    this.player.comboTimer = 2.4;
    sound.playComboChime(this.player.miningCombo);

    if (this.player.miningCombo >= 3) {
      const comboColors = ['#fde047', '#fde047', '#fde047', '#fde047', '#fb923c', '#fb923c', '#f87171', '#f87171', '#c084fc', '#ff0055'];
      const col = comboColors[this.player.miningCombo - 1] || '#fde047';
      this.addFloatingText(cx, cy - 14, `x${this.player.miningCombo} COMBO!`, col);
    }

    // Achievement triggers
    this.checkAchievement('first_mine');
    if (this.player.miningCombo >= 5) this.checkAchievement('combo_5');
    if (this.player.miningCombo >= 10) this.checkAchievement('combo_10');
    if (def.oreId === 'sulfur') this.checkAchievement('sulfur_found');
    if (def.oreId === 'heart_of_sulfur') this.checkAchievement('heart_of_sulfur');

    if (def.oreId) {
      this.drops.push({
        id: this.nextEntityId++,
        oreId: def.oreId,
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 44,
        vy: -52 - Math.random() * 26,
        age: 0,
        rotation: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 8,
      });

      // Hyper Bore combo 10x gives 45% chance for double ore drop!
      if (this.player.miningCombo >= 10 && Math.random() < 0.45) {
        this.drops.push({
          id: this.nextEntityId++,
          oreId: def.oreId,
          x: cx,
          y: cy,
          vx: (Math.random() - 0.5) * 44,
          vy: -60 - Math.random() * 25,
          age: 0,
          rotation: Math.random() * Math.PI * 2,
          spinSpeed: (Math.random() - 0.5) * 8,
        });
        this.addFloatingText(cx, cy - 24, 'DOUBLE ORE BONUS!', '#fde047');
        this.spawnParticles(cx, cy, '#fde047', 12, 60, true);
      }
    }

    if (type === TileType.SULFUR_GAS_POCKET) {
      this.gasClouds.push({ x: cx, y: cy, radius: 28, life: 3.5, maxLife: 3.5 });
      this.spawnParticles(cx, cy, '#d9f926', 20, 58, true);
      this.addFloatingText(cx, cy - 10, 'SULFUR GAS!', '#d9f926');
    }
    if (type === TileType.MAGMA_ROCK) {
      this.spawnParticles(cx, cy, '#fb923c', 18, 80, true);
      this.addShake(3, 0.16);
    }
  }

  private updateBombs(h: number) {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.fuse -= h;
      b.vy = Math.min(210, b.vy + 285 * h);

      const nextX = b.x + b.vx * h;
      if (!this.isSolid(Math.floor(nextX / TILE_SIZE), Math.floor(b.y / TILE_SIZE))) b.x = nextX;
      else b.vx *= -0.4;

      const nextY = b.y + b.vy * h;
      if (!this.isSolid(Math.floor(b.x / TILE_SIZE), Math.floor((nextY + 4) / TILE_SIZE))) b.y = nextY;
      else {
        b.vy = 0;
        b.vx *= 0.85;
      }

      if (Math.random() < 0.3) {
        this.particles.push({
          x: b.x,
          y: b.y - 6,
          vx: (Math.random() - 0.5) * 12,
          vy: -22 - Math.random() * 14,
          size: 1,
          color: Math.random() < 0.5 ? '#fde047' : '#f97316',
          life: 0.3,
          maxLife: 0.3,
          gravity: -12,
          glow: true,
        });
      }

      if (b.fuse <= 0) {
        this.detonateBomb(b.x, b.y);
        this.bombs.splice(i, 1);
      }
    }
  }

  private detonateBomb(wx: number, wy: number) {
    const centerGx = Math.floor(wx / TILE_SIZE);
    const centerGy = Math.floor(wy / TILE_SIZE);
    sound.playExplosion();
    this.addShake(6.5, 0.32);
    this.spawnParticles(wx, wy, '#f97316', 34, 120, true);
    this.spawnParticles(wx, wy, '#fff3b0', 20, 85, true);
    this.spawnParticles(wx, wy, '#57534e', 18, 70);
    this.checkAchievement('bomb_blast');

    const radius = 2;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
        const t = this.getTile(centerGx + dx, centerGy + dy);
        if (TILES[t].solid && TILES[t].destructible) this.breakTile(centerGx + dx, centerGy + dy);
      }
    }
  }

  private updateGasClouds(h: number) {
    const p = this.player;
    for (let i = this.gasClouds.length - 1; i >= 0; i--) {
      const g = this.gasClouds[i];
      g.life -= h;
      if (g.life <= 0) {
        this.gasClouds.splice(i, 1);
        continue;
      }
      if (Math.random() < 0.4) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * g.radius * 0.75;
        this.particles.push({
          x: g.x + Math.cos(ang) * r,
          y: g.y + Math.sin(ang) * r,
          vx: (Math.random() - 0.5) * 16,
          vy: -14 - Math.random() * 14,
          size: 2,
          color: Math.random() < 0.4 ? '#f4ffb0' : '#d9f926',
          life: 0.5,
          maxLife: 0.5,
          gravity: -12,
          glow: true,
        });
      }
      const dist = Math.hypot(p.x - g.x, p.y - g.y);
      if (dist < g.radius && p.invulnTimer <= 0 && !p.godMode) {
        const resist = [0, 0.25, 0.5, 0.7, 0.85][p.upgrades.armor - 1] || 0;
        this.damagePlayer(Math.max(1, Math.round(9 * (1 - resist))), 'TOXIC SULFUR');
      }
    }
  }

  private updateDrops(h: number) {
    const p = this.player;
    const cap = this.getCargoCapacity();

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += h;
      d.rotation += d.spinSpeed * h;
      d.vy = Math.min(190, d.vy + 245 * h);
      d.vx *= 1 - Math.min(1, h * 1.4);

      const nx = d.x + d.vx * h;
      if (!this.isSolid(Math.floor(nx / TILE_SIZE), Math.floor(d.y / TILE_SIZE))) d.x = nx;
      else d.vx *= -0.5;

      const ny = d.y + d.vy * h;
      if (!this.isSolid(Math.floor(d.x / TILE_SIZE), Math.floor((ny + 3) / TILE_SIZE))) d.y = ny;
      else {
        d.vy = 0;
        d.vx *= 0.8;
      }

      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      const hasRoom = this.getCargoCount() < cap;

      // Smooth magnetic attraction with easing
      if (hasRoom && d.age > 0.12 && dist < 52) {
        const pull = (1 - dist / 52) * 320 * h + 90 * h;
        const ang = Math.atan2(p.y - d.y, p.x - d.x);
        d.vx += Math.cos(ang) * pull * 3;
        d.vy += Math.sin(ang) * pull * 3 - 60 * h;
      }

      if (dist < 14) {
        if (hasRoom) {
          const ore = ORES[d.oreId];
          p.cargo[d.oreId] = (p.cargo[d.oreId] || 0) + 1;
          p.squashX = 1.12;
          p.squashY = 0.9;
          sound.playOreCollect(ore.baseValue);
          this.addFloatingText(d.x, d.y - 10, `+1 ${ore.name.split(' ')[0]}`, ore.accentColor);
          this.spawnParticles(d.x, d.y, ore.accentColor, 6, 45, true);
          this.drops.splice(i, 1);
          this.storyBeat('first_ore', 'cube', `LOG: ${ore.name} secured. The humans call this a 'payday.'`);
          if (this.getCargoCount() >= cap) {
            this.setBanner('CARGO FULL! RETURN TO REFINERY TO SELL', 3.0);
            this.storyBeat('cargo_full', 'mara', "Cargo's full! Fly back up, the Refinery's furnace is hungry.");
          }
          this.emitHud(true);
        } else if (d.age > 0.4) {
          this.setBanner('CARGO FULL! SELL ORES AT SURFACE', 2.0);
        }
      }
    }
  }

  private updateDrips(h: number) {
    this.dripSpawnTimer -= h;
    if (this.dripSpawnTimer <= 0) {
      this.dripSpawnTimer = 0.35 + Math.random() * 0.45;
      const playerGx = Math.floor(this.player.x / TILE_SIZE);
      const playerGy = Math.floor(this.player.y / TILE_SIZE);
      if (playerGy > SURFACE_Y + 1 && playerGy < 160) {
        const rx = playerGx + Math.floor((Math.random() - 0.5) * 24);
        const ry = playerGy + Math.floor((Math.random() - 0.5) * 16);
        if (rx > 1 && rx < WORLD_WIDTH - 2 && ry > SURFACE_Y + 1 && ry < WORLD_HEIGHT - 3) {
          if (!this.isSolid(rx, ry) && this.isSolid(rx, ry - 1)) {
            this.drips.push({
              id: this.nextEntityId++,
              x: rx * TILE_SIZE + 8,
              y: ry * TILE_SIZE + 1,
              vy: 25,
              color: ry > 36 && ry < 86 ? '#d9f926' : '#7dd3fc',
            });
          }
        }
      }
    }

    for (let i = this.drips.length - 1; i >= 0; i--) {
      const d = this.drips[i];
      d.vy += 220 * h;
      d.y += d.vy * h;
      const gx = Math.floor(d.x / TILE_SIZE);
      const gy = Math.floor(d.y / TILE_SIZE);
      if (this.isSolid(gx, gy) || gy >= WORLD_HEIGHT - 1) {
        for (let s = 0; s < 3; s++) {
          this.particles.push({
            x: d.x,
            y: gy * TILE_SIZE,
            vx: (Math.random() - 0.5) * 28,
            vy: -15 - Math.random() * 20,
            size: 1,
            color: d.color,
            life: 0.22,
            maxLife: 0.22,
            gravity: 140,
          });
        }
        this.drips.splice(i, 1);
      }
    }
  }

  private updateSonarWaves(h: number) {
    for (let i = this.sonarWaves.length - 1; i >= 0; i--) {
      const w = this.sonarWaves[i];
      w.life -= h;
      w.radius += (w.maxRadius - w.radius) * Math.min(1, h * 4.5);
      if (w.life <= 0) {
        this.sonarWaves.splice(i, 1);
      }
    }
  }

  /** Ambient drifting embers / dust motes for atmosphere. */
  private spawnAmbient(dt: number) {
    this.ambientCooldown -= dt;
    if (this.ambientCooldown > 0 || this.particles.length > 240) return;
    this.ambientCooldown = 0.09;

    const gy = Math.floor(this.player.y / TILE_SIZE);
    const depth = gy - SURFACE_Y;
    const halfW = 90 / this.zoom;
    const halfH = 70 / this.zoom;
    const x = this.camX + (Math.random() - 0.5) * halfW * 2;
    const y = this.camY + (Math.random() - 0.5) * halfH * 2;

    if (depth <= 0) return;

    const deep = depth > 140;
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: deep ? -6 - Math.random() * 8 : 4 + Math.random() * 6,
      size: 1,
      color: deep ? (Math.random() < 0.5 ? '#ff9d4d' : '#fde68a') : '#8b8296',
      life: 1.6,
      maxLife: 1.6,
      gravity: 0,
      glow: deep,
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.vy += pt.gravity * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
  }

  private updateFloatingTexts(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.vy += 26 * dt; // Ease-out rise
      ft.y += ft.vy * dt;
    }
  }

  private revealAroundPlayer() {
    const gx = Math.floor(this.player.x / TILE_SIZE);
    const gy = Math.floor(this.player.y / TILE_SIZE);
    const radius = Math.ceil(this.getUpgradeValue('headlamp')) + 2;
    const minX = Math.max(0, gx - radius);
    const maxX = Math.min(WORLD_WIDTH - 1, gx + radius);
    const minY = Math.max(0, gy - radius);
    const maxY = Math.min(WORLD_HEIGHT - 1, gy + radius);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if ((x - gx) * (x - gx) + (y - gy) * (y - gy) <= radius * radius) {
          this.explored[y * WORLD_WIDTH + x] = 1;
        }
      }
    }
  }

  /* --------------------------- RENDER --------------------------- */
  public render(ctx: CanvasRenderingContext2D, viewW: number, viewH: number) {
    sprites.ensureInit();
    ctx.imageSmoothingEnabled = false;

    const p = this.player;
    const alpha = this.interpAlpha;
    const rx = p.prevX + (p.x - p.prevX) * alpha;
    const ry = p.prevY + (p.y - p.prevY) * alpha;

    const depth = Math.max(0, Math.floor(ry / TILE_SIZE) - SURFACE_Y);
    const stratum = getStratumAtDepth(depth);

    this.renderBackground(ctx, viewW, viewH, stratum.bgTint);

    ctx.save();
    const shakeX = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeIntensity * 2 : 0;
    const shakeY = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeIntensity * 2 : 0;
    // Uniform sub-pixel translation keeps every sprite crisp while scrolling smoothly
    ctx.translate(viewW / 2 - this.camX * this.zoom + shakeX, viewH / 2 - this.camY * this.zoom + shakeY);
    ctx.scale(this.zoom, this.zoom);

    const halfW = viewW / (2 * this.zoom) + TILE_SIZE * 2;
    const halfH = viewH / (2 * this.zoom) + TILE_SIZE * 2;
    const startGx = Math.max(0, Math.floor((this.camX - halfW) / TILE_SIZE));
    const endGx = Math.min(WORLD_WIDTH - 1, Math.ceil((this.camX + halfW) / TILE_SIZE));
    const startGy = Math.max(0, Math.floor((this.camY - halfH) / TILE_SIZE));
    const endGy = Math.min(WORLD_HEIGHT - 1, Math.ceil((this.camY + halfH) / TILE_SIZE));

    this.renderBackwalls(ctx, startGx, endGx, startGy, endGy);
    if (startGy <= SURFACE_Y + 2) this.renderSurfaceOutpost(ctx);
    this.renderTiles(ctx, startGx, endGx, startGy, endGy);
    this.renderTorches(ctx, startGx, endGx, startGy, endGy);
    this.renderBombs(ctx);
    this.renderDrips(ctx);
    this.renderDrops(ctx);
    this.renderGasClouds(ctx);
    this.renderSonarWaves(ctx);
    this.renderTargetReticle(ctx);

    drawCubeMiner(ctx, {
      x: rx,
      y: ry,
      facing: p.facing,
      aimAngle: p.aimVisual,
      drillSpin: p.drillSpin % 1,
      drillExtend: p.drillExtend,
      thrustPower: p.thrustVisual,
      isDrilling: p.isDrilling,
      drillTier: p.upgrades.drill,
      armorTier: p.upgrades.armor,
      thrusterTier: p.upgrades.thruster,
      cargoFill: Math.min(1, this.getCargoCount() / Math.max(1, this.getCargoCapacity())),
      treadPhase: p.wheelPhase,
      bob: p.onGround ? Math.sin(p.bobPhase) * 0.9 : Math.sin(p.bobPhase * 0.6) * 0.4,
      squashX: p.squashX,
      squashY: p.squashY,
      time: this.time,
      invuln: p.invulnTimer > 0 && !p.godMode,
      tint: p.damageFlash > 0.05 ? (p.godMode ? '#fde047' : '#ff8f9e') : null,
      godMode: p.godMode,
      idleTime: p.idleTime,
      combo: p.miningCombo,
      lowHull: p.hull / p.maxHull < 0.3,
      lowFuel: p.fuel / p.maxFuel < 0.2,
      cargoFull: this.getCargoCount() >= this.getCargoCapacity(),
    });

    this.renderParticles(ctx);
    this.renderLighting(ctx, startGx, endGx, startGy, endGy, rx, ry);
    this.renderGlowPass(ctx, startGx, endGx, startGy, endGy, rx, ry);
    this.renderRadarGlints(ctx, startGx, endGx, startGy, endGy, rx, ry);
    this.renderFloatingTexts(ctx);
    ctx.restore();

    this.renderScreenFX(ctx, viewW, viewH, stratum.accent);
  }

  private renderBackground(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    stratumTint: string
  ) {
    const surfaceScreenY = viewH / 2 + (SURFACE_Y * TILE_SIZE - this.camY) * this.zoom;

    if (surfaceScreenY > 0) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, Math.max(140, surfaceScreenY));
      skyGrad.addColorStop(0, '#120e1e');
      skyGrad.addColorStop(0.45, '#2a1d2b');
      skyGrad.addColorStop(0.8, '#5c3a22');
      skyGrad.addColorStop(1, '#8a4f21');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, viewW, Math.min(viewH, surfaceScreenY + 6));

      // Twinkling pixel stars
      for (let i = 0; i < 40; i++) {
        const sx = (((i * 173 + 41) % 1000) / 1000) * viewW;
        const sy = (((i * 97 + 19) % 100) / 100) * Math.min(viewH, Math.max(0, surfaceScreenY - 26));
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(this.time * 1.6 + i));
        ctx.globalAlpha = tw * 0.8;
        ctx.fillStyle = i % 7 === 0 ? '#ffd9a0' : '#fff3c4';
        ctx.fillRect(Math.floor(sx), Math.floor(sy), i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;

      // Layered parallax volcanic ridges
      const ridgeLayers = [
        { off: 0.14, color: '#1d1524', h: 40, yOff: 6 },
        { off: 0.3, color: '#2a1c26', h: 28, yOff: 0 },
      ];
      for (const layer of ridgeLayers) {
        ctx.fillStyle = layer.color;
        const baseY = surfaceScreenY - layer.yOff;
        for (let x = -24; x < viewW + 24; x += 20) {
          const wx = x + this.camX * layer.off * this.zoom;
          const h = Math.abs(Math.sin(wx * 0.012) * layer.h) + Math.abs(Math.sin(wx * 0.031) * 8) + 6;
          ctx.fillRect(Math.floor(x), Math.floor(baseY - h), 20, Math.ceil(h + 40));
        }
      }

      // Distant smelter glow on the horizon
      ctx.globalCompositeOperation = 'lighter';
      const horizonGlow = ctx.createLinearGradient(0, surfaceScreenY - 40, 0, surfaceScreenY);
      horizonGlow.addColorStop(0, 'rgba(255,140,40,0)');
      horizonGlow.addColorStop(1, 'rgba(255,140,40,0.16)');
      ctx.fillStyle = horizonGlow;
      ctx.fillRect(0, surfaceScreenY - 40, viewW, 40);
      ctx.globalCompositeOperation = 'source-over';
    }

    if (surfaceScreenY < viewH) {
      const caveGrad = ctx.createLinearGradient(0, Math.max(0, surfaceScreenY), 0, viewH);
      caveGrad.addColorStop(0, stratumTint);
      caveGrad.addColorStop(1, '#08060e');
      ctx.fillStyle = caveGrad;
      ctx.fillRect(0, Math.max(0, surfaceScreenY), viewW, viewH - Math.max(0, surfaceScreenY));
    }
  }

  private stratumIndexOf(gy: number): number {
    const depth = gy - SURFACE_Y;
    if (depth < 14) return 0;
    if (depth < 36) return 1;
    if (depth < 86) return 2;
    if (depth < 142) return 3;
    if (depth < 186) return 4;
    return 5;
  }

  /** Dark cavern backwall so excavated tunnels read as depth, not void. */
  private renderBackwalls(
    ctx: CanvasRenderingContext2D,
    startGx: number,
    endGx: number,
    startGy: number,
    endGy: number
  ) {
    for (let gy = Math.max(startGy, SURFACE_Y + 1); gy <= endGy; gy++) {
      const band = this.stratumIndexOf(gy);
      for (let gx = startGx; gx <= endGx; gx++) {
        if (this.grid[gy][gx] !== TileType.AIR) continue;
        const wall = sprites.getBackwall(band, gx, gy);
        if (wall) ctx.drawImage(wall, gx * TILE_SIZE, gy * TILE_SIZE);
      }
    }
  }

  private renderTiles(
    ctx: CanvasRenderingContext2D,
    startGx: number,
    endGx: number,
    startGy: number,
    endGy: number
  ) {
    const t = this.time;
    for (let gy = startGy; gy <= endGy; gy++) {
      for (let gx = startGx; gx <= endGx; gx++) {
        const type = this.grid[gy][gx];
        if (type === TileType.AIR) continue;

        const px = gx * TILE_SIZE;
        const py = gy * TILE_SIZE;
        const frame = sprites.getTileFrame(type, gx, gy, t);
        if (!frame) continue;
        ctx.drawImage(frame, px, py);

        // Exposed-face bevels + ambient occlusion corners (Minecraft-like depth)
        const openUp = !this.isSolid(gx, gy - 1);
        const openDown = !this.isSolid(gx, gy + 1);
        const openLeft = !this.isSolid(gx - 1, gy);
        const openRight = !this.isSolid(gx + 1, gy);

        if (openUp || openDown || openLeft || openRight) {
          const [hi, lo] = this.getEdgeColors(type);

          if (openUp) {
            ctx.fillStyle = hi;
            ctx.fillRect(px, py, TILE_SIZE, 2);
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            ctx.fillRect(px, py, TILE_SIZE, 1);
          }
          if (openLeft) {
            ctx.fillStyle = hi;
            ctx.fillRect(px, py, 1, TILE_SIZE);
          }
          if (openDown) {
            ctx.fillStyle = lo;
            ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
          }
          if (openRight) {
            ctx.fillStyle = lo;
            ctx.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
          }
          // Corner AO where two faces are exposed
          ctx.fillStyle = 'rgba(6,4,12,0.4)';
          if (openUp && openLeft) ctx.fillRect(px, py, 2, 2);
          if (openUp && openRight) ctx.fillRect(px + TILE_SIZE - 2, py, 2, 2);
          if (openDown && openLeft) ctx.fillRect(px, py + TILE_SIZE - 2, 2, 2);
          if (openDown && openRight) ctx.fillRect(px + TILE_SIZE - 2, py + TILE_SIZE - 2, 2, 2);
        }

        // Crack overlay while drilling
        if (
          this.player.drillTarget &&
          this.player.drillTarget.gx === gx &&
          this.player.drillTarget.gy === gy &&
          this.player.drillProgress > 0
        ) {
          const stage = Math.min(5, Math.floor(this.player.drillProgress * 6));
          const crack = sprites.getCrack(stage);
          if (crack) ctx.drawImage(crack, px, py);
        }
      }
    }
  }

  private renderSurfaceOutpost(ctx: CanvasRenderingContext2D) {
    const groundY = SURFACE_Y * TILE_SIZE;
    const t = this.time;

    /* ---------- REFINERY DEPOT (Upgraded Industrial Smelter) ---------- */
    {
      const rx = OUTPOST_ZONES.REFINERY.startX * TILE_SIZE + 6;
      const rw = 8 * TILE_SIZE + 4;
      const rh = 52;
      const topY = groundY - rh;

      // Twin industrial smokestacks + staggered rising smoke plumes
      for (const [cxOff, hOff] of [[10, 26], [26, 20]] as const) {
        ctx.fillStyle = '#08060e';
        ctx.fillRect(rx + cxOff, topY - hOff, 12, hOff + 2);
        ctx.fillStyle = '#3d3849';
        ctx.fillRect(rx + cxOff + 1, topY - hOff + 1, 10, hOff);
        ctx.fillStyle = '#685e7a';
        ctx.fillRect(rx + cxOff + 1, topY - hOff + 1, 3, hOff);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(rx + cxOff, topY - hOff + 3, 12, 2);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const life = (t * 0.38 + i * 0.16) % 1;
        const stackX = i % 2 === 0 ? rx + 13 : rx + 29;
        const sx = stackX + Math.sin(life * 6 + i) * 5 + life * 4;
        const sy = topY - 28 - life * 36;
        const size = 3 + life * 8;
        ctx.fillStyle = `rgba(220, 198, 128, ${0.22 * (1 - life)})`;
        ctx.fillRect(Math.round(sx), Math.round(sy), Math.round(size), Math.round(size));
      }
      ctx.globalCompositeOperation = 'source-over';

      // External ore intake hopper & moving conveyor belt on left side
      ctx.fillStyle = '#08060e';
      ctx.fillRect(rx - 14, groundY - 22, 16, 22);
      ctx.fillStyle = '#473e54';
      ctx.fillRect(rx - 12, groundY - 20, 12, 10);
      ctx.fillStyle = '#262030';
      ctx.fillRect(rx - 12, groundY - 9, 14, 9);
      const beltOff = Math.floor(t * 16) % 4;
      ctx.fillStyle = '#eab308';
      for (let bx = rx - 11 + beltOff; bx < rx; bx += 4) {
        ctx.fillRect(bx, groundY - 12, 2, 2);
      }

      // Main Smelter Structure
      ctx.fillStyle = '#08060e';
      ctx.fillRect(rx, topY, rw, rh);
      ctx.fillStyle = '#332d3d';
      ctx.fillRect(rx + 2, topY + 2, rw - 4, rh - 2);
      ctx.fillStyle = '#4f465e';
      ctx.fillRect(rx + 2, topY + 2, rw - 4, 4);
      // Corrugated wall ribbing & horizontal girder
      ctx.fillStyle = '#241f2e';
      for (let x = rx + 5; x < rx + rw - 4; x += 6) ctx.fillRect(x, topY + 8, 2, rh - 10);
      ctx.fillStyle = '#1b1724';
      ctx.fillRect(rx + 2, topY + 28, rw - 4, 3);

      // Stepped Roof + hazard trim
      ctx.fillStyle = '#08060e';
      ctx.fillRect(rx - 3, topY - 4, rw + 6, 6);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(rx - 2, topY - 3, rw + 4, 4);
      ctx.fillStyle = '#fde047';
      for (let x = rx - 2; x < rx + rw + 2; x += 8) ctx.fillRect(x, topY - 3, 4, 4);

      // Roaring Blast Furnace Mouth + Molten Ingot Mold Trough
      ctx.fillStyle = '#08060e';
      ctx.fillRect(rx + 8, groundY - 22, 28, 22);
      const heat = 0.65 + 0.35 * Math.sin(t * 5.5);
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(rx + 10, groundY - 20, 24, 20);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(249,115,22,${0.55 + heat * 0.35})`;
      ctx.fillRect(rx + 12, groundY - 18, 20, 18);
      ctx.fillStyle = `rgba(254,240,138,${0.45 + heat * 0.5})`;
      ctx.fillRect(rx + 14, groundY - 12, 16, 12);
      ctx.globalCompositeOperation = 'source-over';
      // Furnace grate bars
      ctx.fillStyle = '#1c1917';
      for (let x = rx + 13; x < rx + 33; x += 4) ctx.fillRect(x, groundY - 18, 1, 17);

      // Molten gold pouring into ingot molds on the right
      ctx.fillStyle = '#08060e';
      ctx.fillRect(rx + 42, groundY - 10, 44, 10);
      ctx.fillStyle = '#292524';
      ctx.fillRect(rx + 44, groundY - 8, 40, 8);
      for (let m = 0; m < 3; m++) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(rx + 46 + m * 12, groundY - 6, 9, 4);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(rx + 47 + m * 12, groundY - 6, 7, 2);
      }

      // Signboard
      const flick = Math.sin(t * 13) > -0.85 ? 1 : 0.45;
      ctx.fillStyle = '#08060e';
      ctx.fillRect(rx + 42, topY + 8, 82, 18);
      ctx.fillStyle = '#1f1a2b';
      ctx.fillRect(rx + 44, topY + 10, 78, 14);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(rx + 44, topY + 10, 78, 1);
      ctx.globalAlpha = flick;
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 8px "Press Start 2P", monospace';
      ctx.fillText('$ REFINERY', rx + 49, topY + 21);
      ctx.globalAlpha = 1;
    }

    /* ---------- MINE SHAFT GANTRY ---------- */
    {
      const sx = OUTPOST_ZONES.SHAFT.startX * TILE_SIZE;
      const sw = (OUTPOST_ZONES.SHAFT.endX - OUTPOST_ZONES.SHAFT.startX + 1) * TILE_SIZE;
      const cx = sx + sw / 2;

      // Headframe posts + cross braces
      ctx.fillStyle = '#08060e';
      ctx.fillRect(sx + 4, groundY - 42, 7, 42);
      ctx.fillRect(sx + sw - 11, groundY - 42, 7, 42);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(sx + 5, groundY - 41, 5, 41);
      ctx.fillRect(sx + sw - 10, groundY - 41, 5, 41);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(sx + 5, groundY - 41, 2, 41);
      // Diagonal braces
      ctx.fillStyle = '#475569';
      for (let i = 0; i < 4; i++) {
        const by = groundY - 38 + i * 10;
        ctx.fillRect(sx + 11, by, sw - 22, 2);
        ctx.fillRect(sx + 11 + i * 4, by, 2, 10);
        ctx.fillRect(sx + sw - 13 - i * 4, by, 2, 10);
      }
      // Top beam + blinking warning beacons
      ctx.fillStyle = '#08060e';
      ctx.fillRect(sx, groundY - 46, sw, 7);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(sx + 1, groundY - 45, sw - 2, 5);
      ctx.fillStyle = '#1c1917';
      for (let x = sx + 2; x < sx + sw - 2; x += 6) ctx.fillRect(x, groundY - 45, 3, 5);

      const beaconOn = Math.floor(t * 2) % 2 === 0;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = beaconOn ? 'rgba(255,80,80,0.95)' : 'rgba(120,30,30,0.5)';
      ctx.fillRect(sx + 6, groundY - 50, 4, 4);
      ctx.fillRect(sx + sw - 10, groundY - 50, 4, 4);
      if (beaconOn) {
        ctx.fillStyle = 'rgba(255,60,60,0.22)';
        ctx.fillRect(sx + 2, groundY - 54, 12, 12);
        ctx.fillRect(sx + sw - 14, groundY - 54, 12, 12);
      }
      ctx.globalCompositeOperation = 'source-over';

      // Pulley wheel that rotates with mining activity
      ctx.fillStyle = '#08060e';
      ctx.fillRect(cx - 6, groundY - 40, 12, 12);
      ctx.fillStyle = '#8b93a5';
      ctx.fillRect(cx - 5, groundY - 39, 10, 10);
      ctx.fillStyle = '#2b303b';
      const spin = Math.floor(t * 3) % 4;
      ctx.fillRect(cx - 1 + (spin === 0 ? -3 : spin === 1 ? 3 : 0), groundY - 35 + (spin === 2 ? -3 : spin === 3 ? 3 : 0), 2, 2);

      // Shaft interior with rails + descending cage cable
      ctx.fillStyle = 'rgba(8,6,14,0.72)';
      ctx.fillRect(sx + 16, groundY, sw - 32, 10 * TILE_SIZE);
      ctx.fillStyle = '#334155';
      ctx.fillRect(sx + 20, groundY, 2, 10 * TILE_SIZE);
      ctx.fillRect(sx + sw - 22, groundY, 2, 10 * TILE_SIZE);
      ctx.fillStyle = '#1e293b';
      for (let y = groundY; y < groundY + 10 * TILE_SIZE; y += 12) {
        ctx.fillRect(sx + 20, y, sw - 40, 1);
      }
      // Moving cage
      const cageY = groundY + ((t * 22) % (10 * TILE_SIZE));
      ctx.fillStyle = '#08060e';
      ctx.fillRect(cx - 9, cageY - 8, 18, 12);
      ctx.fillStyle = '#7c6a4f';
      ctx.fillRect(cx - 8, cageY - 7, 16, 10);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(cx - 3, cageY - 5, 6, 3);

      // Bobbing prompt arrow
      const bob = Math.sin(t * 4) * 2;
      ctx.fillStyle = 'rgba(8,6,14,0.75)';
      ctx.fillRect(cx - 34, groundY - 26 + bob, 68, 12);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 7px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▼ MINE SHAFT ▼', cx, groundY - 17 + bob);
      ctx.textAlign = 'left';
    }

    /* ---------- DRILL FORGE (Upgraded Mechanical & Plasma Workshop) ---------- */
    {
      const fx = OUTPOST_ZONES.FORGE.startX * TILE_SIZE + 2;
      const fw = 8 * TILE_SIZE + 4;
      const fh = 50;
      const topY = groundY - fh;

      // Roof gantry crane jib + suspended spare drill bit
      ctx.fillStyle = '#08060e';
      ctx.fillRect(fx + 10, topY - 16, 4, 16);
      ctx.fillRect(fx + 8, topY - 18, 38, 4);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(fx + 11, topY - 15, 2, 15);
      ctx.fillRect(fx + 9, topY - 17, 36, 2);
      const hoistX = fx + 28 + Math.round(Math.sin(t * 1.4) * 6);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(hoistX, topY - 14, 1, 8);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(hoistX - 3, topY - 7, 7, 4);

      // Main Forge Structure
      ctx.fillStyle = '#08060e';
      ctx.fillRect(fx, topY, fw, fh);
      ctx.fillStyle = '#26303f';
      ctx.fillRect(fx + 2, topY + 2, fw - 4, fh - 2);
      ctx.fillStyle = '#3b4c63';
      ctx.fillRect(fx + 2, topY + 2, fw - 4, 4);
      for (let x = fx + 6; x < fx + fw - 4; x += 8) {
        ctx.fillStyle = '#1e2633';
        ctx.fillRect(x, topY + 8, 2, fh - 10);
      }
      ctx.fillStyle = '#08060e';
      ctx.fillRect(fx - 3, topY - 4, fw + 6, 6);
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(fx - 2, topY - 3, fw + 4, 4);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(fx - 2, topY - 3, fw + 4, 1);

      // Plasma-arc fabrication bay door with scanning laser & welding flash
      ctx.fillStyle = '#08060e';
      ctx.fillRect(fx + 10, groundY - 26, 34, 26);
      ctx.fillStyle = '#15202e';
      ctx.fillRect(fx + 12, groundY - 24, 30, 24);
      ctx.fillStyle = '#0c1520';
      for (let y = groundY - 22; y < groundY - 2; y += 4) ctx.fillRect(fx + 12, y, 30, 2);
      const scanY = groundY - 24 + ((t * 14) % 24);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(56,189,248,0.6)';
      ctx.fillRect(fx + 12, scanY, 30, 2);
      if (Math.sin(t * 19) > 0.4) {
        ctx.fillStyle = 'rgba(186,230,253,0.45)';
        ctx.fillRect(fx + 22, groundY - 12, 10, 8);
      }
      ctx.globalCompositeOperation = 'source-over';

      // Twin interlocking rotating cogwheels
      for (const [gx, gy, sz, dir] of [[fx + 56, groundY - 16, 12, 1], [fx + 67, groundY - 22, 8, -1]] as const) {
        ctx.fillStyle = '#08060e';
        ctx.fillRect(gx - sz / 2 - 1, gy - sz / 2 - 1, sz + 2, sz + 2);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(gx - sz / 2, gy - sz / 2, sz, sz);
        ctx.fillStyle = '#cbd5e1';
        const gspin = ((Math.floor(t * 3 * dir) % 4) + 4) % 4;
        ctx.fillRect(gx - 1 + (gspin % 2 ? 2 : -2), gy - 1, 2, 2);
        ctx.fillRect(gx - 1, gy - 1 + (gspin < 2 ? -2 : 2), 2, 2);
      }

      // External spare drill rack on right
      ctx.fillStyle = '#08060e';
      ctx.fillRect(fx + 82, groundY - 14, 38, 14);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(fx + 84, groundY - 12, 34, 12);
      for (let b = 0; b < 3; b++) {
        ctx.fillStyle = b === 0 ? '#94a3b8' : b === 1 ? '#38bdf8' : '#f59e0b';
        ctx.fillRect(fx + 87 + b * 11, groundY - 10, 6, 8);
      }

      // Signboard
      const flick = Math.sin(t * 11 + 2) > -0.9 ? 1 : 0.45;
      ctx.fillStyle = '#08060e';
      ctx.fillRect(fx + 62, topY + 8, 66, 18);
      ctx.fillStyle = '#141c28';
      ctx.fillRect(fx + 64, topY + 10, 62, 14);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(fx + 64, topY + 10, 62, 1);
      ctx.globalAlpha = flick;
      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 8px "Press Start 2P", monospace';
      ctx.fillText('▲ FORGE', fx + 69, topY + 21);
      ctx.globalAlpha = 1;
    }

    /* ---------- SERVICE BAY (Upgraded Nano-Repair & Energy Station) ---------- */
    {
      const bx = OUTPOST_ZONES.REPAIR.startX * TILE_SIZE + 2;
      const bw = 5 * TILE_SIZE + 4;
      const bh = 38;
      const topY = groundY - bh;

      // Twin roof energy capacitor coils
      for (const cxOff of [10, 24]) {
        ctx.fillStyle = '#08060e';
        ctx.fillRect(bx + cxOff, topY - 10, 8, 10);
        ctx.fillStyle = '#334155';
        ctx.fillRect(bx + cxOff + 1, topY - 9, 6, 8);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(bx + cxOff + 1, topY - 6, 6, 2);
      }

      ctx.fillStyle = '#08060e';
      ctx.fillRect(bx, topY, bw, bh);
      ctx.fillStyle = '#1d3329';
      ctx.fillRect(bx + 2, topY + 2, bw - 4, bh - 2);
      ctx.fillStyle = '#2c4c3e';
      ctx.fillRect(bx + 2, topY + 2, bw - 4, 4);
      ctx.fillStyle = '#08060e';
      ctx.fillRect(bx - 3, topY - 3, bw + 6, 5);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(bx - 2, topY - 2, bw + 4, 3);

      // Recharge dock bay on left + pulsing medical/repair cross on right
      ctx.fillStyle = '#08060e';
      ctx.fillRect(bx + 8, groundY - 20, 22, 20);
      ctx.fillStyle = '#0f2419';
      ctx.fillRect(bx + 10, groundY - 18, 18, 18);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(bx + 12, groundY - 14, 14, 2);

      const pulse = 0.65 + 0.35 * Math.sin(t * 3.4);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(74,222,128,${pulse})`;
      ctx.fillRect(bx + 44, topY + 12, 16, 5);
      ctx.fillRect(bx + 49, topY + 7, 5, 15);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#052e16';
      ctx.fillRect(bx + 46, topY + 14, 12, 1);
      ctx.fillRect(bx + 51, topY + 9, 1, 11);
    }

    this.renderNpcs(ctx);
  }

  private renderTorches(
    ctx: CanvasRenderingContext2D,
    startGx: number,
    endGx: number,
    startGy: number,
    endGy: number
  ) {
    const frames = sprites.getFlareFrames();
    if (!frames.length) return;
    for (const tr of this.torches) {
      if (tr.gx < startGx || tr.gx > endGx || tr.gy < startGy || tr.gy > endGy) continue;
      const px = tr.gx * TILE_SIZE + 3;
      const py = tr.gy * TILE_SIZE + 2;
      const f = frames[Math.floor(this.time * 11 + tr.flickerOffset) % frames.length];
      ctx.drawImage(f, px, py);
    }
  }

  private renderBombs(ctx: CanvasRenderingContext2D) {
    for (const b of this.bombs) {
      const x = Math.round(b.x);
      const y = Math.round(b.y);
      const urgency = 1 - b.fuse / b.maxFuse;
      const blinkRate = 6 + urgency * 22;
      const blink = Math.floor(this.time * blinkRate) % 2 === 0;

      ctx.fillStyle = '#08060e';
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(x - 4, y + 1, 8, 3);
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(x - 3, y - 3, 2, 2);
      // Fuse spark
      ctx.fillStyle = '#08060e';
      ctx.fillRect(x - 1, y - 8, 2, 3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = blink ? 'rgba(253,224,71,0.95)' : 'rgba(249,115,22,0.7)';
      ctx.fillRect(x - 2, y - 10, 4, 3);
      ctx.fillStyle = 'rgba(255,180,60,0.2)';
      ctx.fillRect(x - 6, y - 12, 12, 10);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private renderDrops(ctx: CanvasRenderingContext2D) {
    for (const d of this.drops) {
      const frames = sprites.getOreIconFrames(d.oreId);
      if (!frames) continue;
      const bob = Math.sin(this.time * 5 + d.id * 1.7) * 1.8;
      const f = frames[Math.floor(this.time * 8 + d.id) % frames.length];

      ctx.save();
      ctx.translate(Math.round(d.x), Math.round(d.y + bob));
      ctx.rotate(d.rotation);

      // Soft glow behind the spinning gem
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `${ORES[d.oreId].color}44`;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.globalCompositeOperation = 'source-over';

      ctx.drawImage(f, -7, -7);
      ctx.restore();
    }
  }

  private renderDrips(ctx: CanvasRenderingContext2D) {
    for (const d of this.drips) {
      ctx.fillStyle = d.color;
      ctx.fillRect(Math.round(d.x) - 1, Math.round(d.y) - 2, 2, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(d.x) - 1, Math.round(d.y), 1, 1);
    }
  }

  private renderSonarWaves(ctx: CanvasRenderingContext2D) {
    if (this.sonarWaves.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const w of this.sonarWaves) {
      const alpha = Math.max(0, w.life / w.maxLife);
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.75})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w.x, w.y, Math.max(0, w.radius - 8), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderTargetReticle(ctx: CanvasRenderingContext2D) {
    const target = this.player.drillTarget;
    if (!target || !this.isSolid(target.gx, target.gy)) return;
    const tx = target.gx * TILE_SIZE;
    const ty = target.gy * TILE_SIZE;
    const pulse = (Math.sin(this.time * 12) + 1) * 0.5;
    const col = pulse > 0.4 ? '#fde047' : '#ffffff';

    ctx.fillStyle = col;
    // Top-left corner
    ctx.fillRect(tx, ty, 4, 1);
    ctx.fillRect(tx, ty, 1, 4);
    // Top-right corner
    ctx.fillRect(tx + TILE_SIZE - 4, ty, 4, 1);
    ctx.fillRect(tx + TILE_SIZE - 1, ty, 1, 4);
    // Bottom-left corner
    ctx.fillRect(tx, ty + TILE_SIZE - 1, 4, 1);
    ctx.fillRect(tx, ty + TILE_SIZE - 4, 1, 4);
    // Bottom-right corner
    ctx.fillRect(tx + TILE_SIZE - 4, ty + TILE_SIZE - 1, 4, 1);
    ctx.fillRect(tx + TILE_SIZE - 1, ty + TILE_SIZE - 4, 1, 4);
  }

  private renderGasClouds(ctx: CanvasRenderingContext2D) {
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.gasClouds) {
      const a = Math.max(0, g.life / g.maxLife);
      const pulse = 1 + Math.sin(this.time * 6) * 0.08;
      const r = g.radius * pulse;
      const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, r);
      grad.addColorStop(0, `rgba(217,249,38,${0.3 * a})`);
      grad.addColorStop(0.6, `rgba(163,190,20,${0.16 * a})`);
      grad.addColorStop(1, 'rgba(120,140,10,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(g.x - r, g.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const pt of this.particles) {
      const a = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      const x = Math.round(pt.x);
      const y = Math.round(pt.y);
      if (pt.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = pt.color;
        ctx.fillRect(x, y, pt.size, pt.size);
        ctx.globalAlpha = a * 0.25;
        ctx.fillRect(x - 1, y - 1, pt.size + 2, pt.size + 2);
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = a;
        ctx.fillStyle = pt.color;
        ctx.fillRect(x, y, pt.size, pt.size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Smooth gradient-based fog of war (soft, not blocky). */
  private renderLighting(
    ctx: CanvasRenderingContext2D,
    startGx: number,
    endGx: number,
    startGy: number,
    endGy: number,
    playerX: number,
    playerY: number
  ) {
    const tilesW = endGx - startGx + 1;
    const tilesH = endGy - startGy + 1;
    if (tilesW <= 0 || tilesH <= 0) return;

    const worldX0 = startGx * TILE_SIZE;
    const worldY0 = startGy * TILE_SIZE;
    const lw = Math.max(1, Math.ceil((tilesW * TILE_SIZE) / LIGHT_DIV));
    const lh = Math.max(1, Math.ceil((tilesH * TILE_SIZE) / LIGHT_DIV));

    if (this.lightCanvas.width !== lw || this.lightCanvas.height !== lh) {
      this.lightCanvas.width = lw;
      this.lightCanvas.height = lh;
    }

    const lctx = this.lightCtx;
    lctx.imageSmoothingEnabled = true;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lw, lh);
    lctx.fillStyle = 'rgba(6,4,12,1)';
    lctx.fillRect(0, 0, lw, lh);

    const toLX = (wx: number) => (wx - worldX0) / LIGHT_DIV;
    const toLY = (wy: number) => (wy - worldY0) / LIGHT_DIV;

    const punch = (wx: number, wy: number, radius: number, strength: number) => {
      if (radius <= 0) return;
      const r = radius / LIGHT_DIV;
      const cx = toLX(wx);
      const cy = toLY(wy);
      if (cx < -r || cy < -r || cx > lw + r || cy > lh + r) return;
      const grad = lctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(0,0,0,${strength})`);
      grad.addColorStop(0.45, `rgba(0,0,0,${strength * 0.72})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = grad;
      lctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    };

    // Previously explored areas stay dimly visible
    lctx.globalCompositeOperation = 'destination-out';
    lctx.fillStyle = 'rgba(0,0,0,0.62)';
    for (let gy = startGy; gy <= endGy; gy++) {
      if (gy <= SURFACE_Y) continue;
      let runStart = -1;
      for (let gx = startGx; gx <= endGx + 1; gx++) {
        const isExplored = gx <= endGx && this.explored[gy * WORLD_WIDTH + gx] === 1;
        if (isExplored && runStart < 0) runStart = gx;
        if ((!isExplored || gx > endGx) && runStart >= 0) {
          lctx.fillRect(
            toLX(runStart * TILE_SIZE),
            toLY(gy * TILE_SIZE),
            ((gx - runStart) * TILE_SIZE) / LIGHT_DIV,
            TILE_SIZE / LIGHT_DIV
          );
          runStart = -1;
        }
      }
    }

    // Everything above the surface is fully lit
    if (startGy <= SURFACE_Y) {
      lctx.fillStyle = 'rgba(0,0,0,1)';
      lctx.fillRect(0, 0, lw, Math.max(0, toLY((SURFACE_Y + 1) * TILE_SIZE)));
    }

    // Player headlamp — radius scales with the Optic & Radar upgrade
    const lightRadius = this.getUpgradeValue('headlamp') * TILE_SIZE;
    punch(playerX, playerY, lightRadius, 1);
    // Directional lamp cone
    const p = this.player;
    const coneLen = lightRadius * 1.5;
    const coneX = playerX + Math.cos(p.aimVisual) * coneLen * 0.42;
    const coneY = playerY + Math.sin(p.aimVisual) * coneLen * 0.42;
    punch(coneX, coneY, lightRadius * 0.85, 0.85);

    // Placed flares
    for (const tr of this.torches) {
      if (tr.gx < startGx - 8 || tr.gx > endGx + 8 || tr.gy < startGy - 8 || tr.gy > endGy + 8)
        continue;
      const flick = 0.86 + 0.14 * Math.sin(this.time * 9 + tr.flickerOffset);
      punch(tr.gx * TILE_SIZE + 8, tr.gy * TILE_SIZE + 8, 7.5 * TILE_SIZE * flick, 0.95);
    }

    // Self-illuminating blocks (lava / sulfur / heart)
    let glowBudget = 70;
    for (let gy = startGy; gy <= endGy && glowBudget > 0; gy++) {
      for (let gx = startGx; gx <= endGx && glowBudget > 0; gx++) {
        const type = this.grid[gy][gx];
        if (type === TileType.MAGMA_ROCK) {
          const pulse = 0.75 + 0.25 * Math.sin(this.time * 4 + gx + gy);
          punch(gx * TILE_SIZE + 8, gy * TILE_SIZE + 8, 3.6 * TILE_SIZE * pulse, 0.85);
          glowBudget--;
        } else if (type === TileType.SULFUR_GAS_POCKET) {
          punch(gx * TILE_SIZE + 8, gy * TILE_SIZE + 8, 3.2 * TILE_SIZE, 0.8);
          glowBudget--;
        } else if (type === TileType.ORE_HEART_OF_SULFUR) {
          const pulse = 0.7 + 0.3 * Math.sin(this.time * 3.2 + gx);
          punch(gx * TILE_SIZE + 8, gy * TILE_SIZE + 8, 5.5 * TILE_SIZE * pulse, 1);
          glowBudget--;
        } else if (type === TileType.ORE_SULFUR || type === TileType.ORE_VOLTITE) {
          punch(gx * TILE_SIZE + 8, gy * TILE_SIZE + 8, 2.4 * TILE_SIZE, 0.6);
          glowBudget--;
        }
      }
    }

    // Bombs & gas clouds illuminate their surroundings
    for (const b of this.bombs) punch(b.x, b.y, 4 * TILE_SIZE, 0.9);
    for (const g of this.gasClouds) punch(g.x, g.y, g.radius * 1.6, 0.7);

    lctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.lightCanvas, worldX0, worldY0, tilesW * TILE_SIZE, tilesH * TILE_SIZE);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
  }

  /** Additive bloom pass: lamp cone, hot rock, drill sparks, thruster glow. */
  private renderGlowPass(
    ctx: CanvasRenderingContext2D,
    startGx: number,
    endGx: number,
    startGy: number,
    endGy: number,
    playerX: number,
    playerY: number
  ) {
    const p = this.player;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Headlamp volumetric cone
    const armorTier = p.upgrades.armor;
    const lampColor = p.godMode ? '253,224,71' : armorTier >= 4 ? '217,190,255' : '255,238,180';
    const coneLen = this.getUpgradeValue('headlamp') * TILE_SIZE * 1.35;
    const ang = p.aimVisual;
    const spread = 0.42;
    const tipX = playerX + Math.cos(ang) * coneLen;
    const tipY = playerY + Math.sin(ang) * coneLen;
    const grad = ctx.createLinearGradient(playerX, playerY, tipX, tipY);
    grad.addColorStop(0, `rgba(${lampColor},0.2)`);
    grad.addColorStop(0.55, `rgba(${lampColor},0.09)`);
    grad.addColorStop(1, `rgba(${lampColor},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(playerX, playerY);
    ctx.lineTo(playerX + Math.cos(ang - spread) * coneLen, playerY + Math.sin(ang - spread) * coneLen);
    ctx.lineTo(playerX + Math.cos(ang + spread) * coneLen, playerY + Math.sin(ang + spread) * coneLen);
    ctx.closePath();
    ctx.fill();

    // Rig body glow
    const bodyGlow = ctx.createRadialGradient(playerX, playerY, 0, playerX, playerY, 26);
    const glowColor = p.damageFlash > 0.05 ? '255,90,110' : p.godMode ? '253,224,71' : '255,190,110';
    bodyGlow.addColorStop(0, `rgba(${glowColor},0.24)`);
    bodyGlow.addColorStop(1, `rgba(${glowColor},0)`);
    ctx.fillStyle = bodyGlow;
    ctx.fillRect(playerX - 26, playerY - 26, 52, 52);

    // Drill contact sparks glow
    if (p.isDrilling && p.drillTarget) {
      const tx = p.drillTarget.gx * TILE_SIZE + TILE_SIZE / 2;
      const ty = p.drillTarget.gy * TILE_SIZE + TILE_SIZE / 2;
      const heat = 0.35 + 0.65 * p.drillProgress;
      const sparkGlow = ctx.createRadialGradient(tx, ty, 0, tx, ty, 20 * heat);
      sparkGlow.addColorStop(0, `rgba(255,214,120,${0.5 * heat})`);
      sparkGlow.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = sparkGlow;
      ctx.fillRect(tx - 22, ty - 22, 44, 44);
    }

    // Thruster exhaust bloom
    if (p.thrustVisual > 0.05) {
      const ex = ctx.createRadialGradient(playerX, playerY + 10, 0, playerX, playerY + 10, 22);
      ex.addColorStop(0, `rgba(255,170,60,${0.35 * p.thrustVisual})`);
      ex.addColorStop(1, 'rgba(255,120,20,0)');
      ctx.fillStyle = ex;
      ctx.fillRect(playerX - 22, playerY - 12, 44, 44);
    }

    // Hot rock & crystal bloom (budgeted)
    let budget = 46;
    for (let gy = startGy; gy <= endGy && budget > 0; gy++) {
      for (let gx = startGx; gx <= endGx && budget > 0; gx++) {
        const type = this.grid[gy][gx];
        let color: string | null = null;
        let radius = 14;
        let intensity = 0.3;
        if (type === TileType.MAGMA_ROCK) {
          color = '255,120,40';
          radius = 20;
          intensity = 0.3 + 0.16 * Math.sin(this.time * 4 + gx * 1.3 + gy);
        } else if (type === TileType.ORE_HEART_OF_SULFUR) {
          color = '255,200,80';
          radius = 26;
          intensity = 0.4 + 0.2 * Math.sin(this.time * 3 + gx);
        } else if (type === TileType.ORE_SULFUR) {
          color = '226,240,60';
          radius = 13;
          intensity = 0.2;
        } else if (type === TileType.ORE_VOLTITE) {
          color = '90,170,255';
          radius = 14;
          intensity = 0.24 * (Math.sin(this.time * 7 + gx * 2) > 0.4 ? 1 : 0.35);
        } else if (type === TileType.ORE_MYTHRIL) {
          color = '190,110,255';
          radius = 13;
          intensity = 0.2;
        }
        if (!color) continue;
        budget--;
        const cx = gx * TILE_SIZE + 8;
        const cy = gy * TILE_SIZE + 8;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `rgba(${color},${intensity})`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }
    }

    // Flare bloom
    for (const tr of this.torches) {
      if (tr.gx < startGx - 6 || tr.gx > endGx + 6 || tr.gy < startGy - 6 || tr.gy > endGy + 6)
        continue;
      const cx = tr.gx * TILE_SIZE + 8;
      const cy = tr.gy * TILE_SIZE + 8;
      const flick = 0.75 + 0.25 * Math.sin(this.time * 10 + tr.flickerOffset);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24 * flick);
      g.addColorStop(0, `rgba(255,190,90,${0.4 * flick})`);
      g.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 26, cy - 26, 52, 52);
    }

    ctx.restore();
  }

  /** Sonar pings that reveal nearby hidden ore veins (Optic & Radar upgrade). */
  private renderRadarGlints(
    ctx: CanvasRenderingContext2D,
    startGx: number,
    endGx: number,
    startGy: number,
    endGy: number,
    playerX: number,
    playerY: number
  ) {
    const radarTier = this.player.upgrades.headlamp;
    if (radarTier < 2) return;
    const radarRange = (4 + radarTier * 2.4) * TILE_SIZE;
    const lightRadius = this.getUpgradeValue('headlamp') * TILE_SIZE * 0.62;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let gy = startGy; gy <= endGy; gy++) {
      for (let gx = startGx; gx <= endGx; gx++) {
        const type = this.grid[gy][gx];
        const oreId = TILES[type].oreId;
        if (!oreId) continue;
        const cx = gx * TILE_SIZE + 8;
        const cy = gy * TILE_SIZE + 8;
        const dist = Math.hypot(cx - playerX, cy - playerY);
        if (dist > radarRange || dist < lightRadius) continue;

        const ping = (Math.sin(this.time * 4.2 - dist * 0.045 + gx * 0.7) + 1) * 0.5;
        if (ping < 0.72) continue;
        const a = (ping - 0.72) / 0.28;
        const ore = ORES[oreId];
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = ore.accentColor;
        ctx.fillRect(cx - 2, cy - 1, 4, 2);
        ctx.fillRect(cx - 1, cy - 2, 2, 4);
        ctx.globalAlpha = a * 0.3;
        ctx.fillRect(cx - 5, cy - 5, 10, 10);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D) {
    ctx.font = 'bold 6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (const ft of this.floatingTexts) {
      const lifeRatio = ft.life / ft.maxLife;
      const a = Math.min(1, lifeRatio * 2.2);
      const rise = (1 - lifeRatio) * 2;
      const x = Math.round(ft.x);
      const y = Math.round(ft.y - rise);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8,6,14,0.9)';
      ctx.fillText(ft.text, x + 1, y + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /** Screen-space atmosphere: stratum tint, vignette, danger pulse, depth haze. */
  private renderScreenFX(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    stratumAccent: string
  ) {
    const p = this.player;
    const depth = Math.max(0, Math.floor(p.y / TILE_SIZE) - SURFACE_Y);

    // Depth tint
    if (depth > 4) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = Math.min(0.24, depth / 900);
      ctx.fillStyle = stratumAccent;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.restore();
    }

    // Vignette
    const vg = ctx.createRadialGradient(
      viewW / 2,
      viewH / 2,
      Math.min(viewW, viewH) * 0.32,
      viewW / 2,
      viewH / 2,
      Math.max(viewW, viewH) * 0.78
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(4,2,8,0.62)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, viewW, viewH);

    // Low-hull danger pulse
    const hullRatio = p.hull / Math.max(1, p.maxHull);
    if (hullRatio < 0.34 && !p.godMode) {
      const pulse = 0.18 + 0.16 * Math.sin(this.time * 7);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const dg = ctx.createRadialGradient(
        viewW / 2,
        viewH / 2,
        Math.min(viewW, viewH) * 0.25,
        viewW / 2,
        viewH / 2,
        Math.max(viewW, viewH) * 0.7
      );
      dg.addColorStop(0, 'rgba(255,40,60,0)');
      dg.addColorStop(1, `rgba(255,40,60,${pulse * (1 - hullRatio / 0.34)})`);
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.restore();
    }

    // Damage flash
    if (p.damageFlash > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,70,90,${p.damageFlash * 0.22})`;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.restore();
    }
  }

  /* --------------------------- HUD / SAVE --------------------------- */
  public getHudSnapshot(): HudSnapshot {
    const gy = Math.floor(this.player.y / TILE_SIZE);
    return {
      credits: this.player.credits,
      depthMeters: Math.max(0, gy - SURFACE_Y),
      maxDepthMeters: this.player.maxDepthReached,
      hull: Math.ceil(this.player.hull),
      maxHull: this.player.maxHull,
      fuel: Math.ceil(this.player.fuel),
      maxFuel: this.player.maxFuel,
      cargoCount: this.getCargoCount(),
      cargoCapacity: this.getCargoCapacity(),
      cargo: { ...this.player.cargo },
      upgrades: { ...this.player.upgrades },
      consumables: { ...this.player.consumables },
      nearbyBuilding: this.getNearbyBuilding(),
      onSurface: gy <= SURFACE_Y,
      marketSurge: { ...this.marketSurge },
      totalBlocksMined: this.player.totalBlocksMined,
      totalCreditsEarned: this.player.totalCreditsEarned,
      statusBanner: this.statusBanner,
      godMode: this.player.godMode,
      infiniteFuel: this.player.infiniteFuel,
      dialogue: this.dialogue,

      // Combo, achievements & radar
      miningCombo: this.player.miningCombo,
      comboMultiplier: Number((1 + this.player.miningCombo * 0.05).toFixed(2)),
      achievements: [...this.player.achievements],
      recentAchievement: this.recentAchievement,
      radarReady: this.radarCooldown <= 0,
      radarCooldownPct: Math.max(0, Math.min(1, this.radarCooldown / 7.5)),
      npcBubble: this.getNpcBubbleAnchor(),
    };
  }

  public emitHud(force: boolean) {
    if (force) this.hudEmitCooldown = 0.1;
    this.onHudUpdate(this.getHudSnapshot());
  }

  public saveGame() {
    try {
      const flat: number[] = [];
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let x = 0; x < WORLD_WIDTH; x++) flat.push(this.grid[y][x]);
      }
      const rle: number[] = [];
      let prev = flat[0];
      let count = 1;
      for (let i = 1; i < flat.length; i++) {
        if (flat[i] === prev) count++;
        else {
          rle.push(prev, count);
          prev = flat[i];
          count = 1;
        }
      }
      rle.push(prev, count);

      const payload = { v: 2, player: this.player, torches: this.torches, rle };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota errors */
    }
  }

  public hasSavedProgress(): boolean {
    try {
      return Boolean(localStorage.getItem(SAVE_KEY) || localStorage.getItem('sulfured_caves_save_v1'));
    } catch {
      return false;
    }
  }

  private loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem('sulfured_caves_save_v1');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !data.player || !Array.isArray(data.rle)) return;

      const flat: number[] = [];
      for (let i = 0; i < data.rle.length; i += 2) {
        const val = data.rle[i];
        const cnt = data.rle[i + 1];
        for (let c = 0; c < cnt; c++) flat.push(val);
      }
      if (flat.length === WORLD_WIDTH * WORLD_HEIGHT) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          for (let x = 0; x < WORLD_WIDTH; x++) {
            this.grid[y][x] = flat[y * WORLD_WIDTH + x] as TileType;
          }
        }
      }

      const savedP = data.player;
      const base = this.createInitialPlayer();
      this.player = {
        ...base,
        ...savedP,
        prevX: savedP.x ?? base.x,
        prevY: savedP.y ?? base.y,
        aimVisual: savedP.aimAngle ?? base.aimAngle,
        thrustVisual: 0,
        drillExtend: 0,
        drillSpin: 0,
        damageFlash: 0,
        cargo: { ...createEmptyCargo(), ...(savedP.cargo || {}) },
        upgrades: { ...base.upgrades, ...(savedP.upgrades || {}) },
        consumables: { ...base.consumables, ...(savedP.consumables || {}) },
        achievements: Array.isArray(savedP.achievements) ? savedP.achievements : [],
      };

      try {
        const rawSet = localStorage.getItem('sulfured_settings');
        if (rawSet) {
          this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(rawSet) };
          sound.setVolumes(this.settings.sfxVolume, this.settings.musicVolume);
        }
      } catch {
        /* ignore */
      }
      this.player.maxHull = this.getUpgradeValue('armor');
      this.player.maxFuel = this.getUpgradeValue('fuel');
      this.player.hull = Math.min(this.player.hull, this.player.maxHull);
      this.player.fuel = Math.min(this.player.fuel, this.player.maxFuel);

      if (Array.isArray(data.torches)) this.torches = data.torches;
    } catch {
      /* fall back to fresh world */
    }
  }

  /* --------------------------- ADMIN --------------------------- */
  public adminGiveCredits(amount: number) {
    this.player.credits = Math.max(0, this.player.credits + amount);
    this.addFloatingText(this.player.x, this.player.y - 18, `+$${amount}`, '#fde047');
    this.spawnParticles(this.player.x, this.player.y, '#fde047', 20, 70, true);
    this.saveGame();
    this.emitHud(true);
  }

  public adminGiveOre(oreId: OreId | 'all', amount: number) {
    if (oreId === 'all') {
      for (const o of ORE_LIST) this.player.cargo[o.id] = amount;
    } else {
      this.player.cargo[oreId] = amount;
    }
    this.spawnParticles(this.player.x, this.player.y, '#a78bfa', 18, 65, true);
    this.saveGame();
    this.emitHud(true);
  }

  public adminSetUpgrade(key: UpgradeKey | 'all', level: number) {
    const apply = (k: UpgradeKey) => {
      const max = UPGRADE_TRACKS[k].tiers.length;
      this.player.upgrades[k] = Math.max(1, Math.min(max, level));
      if (k === 'fuel') {
        this.player.maxFuel = this.getUpgradeValue('fuel');
        this.player.fuel = this.player.maxFuel;
      }
      if (k === 'armor') {
        this.player.maxHull = this.getUpgradeValue('armor');
        this.player.hull = this.player.maxHull;
      }
    };
    if (key === 'all') {
      (Object.keys(UPGRADE_TRACKS) as UpgradeKey[]).forEach(apply);
    } else {
      apply(key);
    }
    sound.playUpgrade();
    this.spawnParticles(this.player.x, this.player.y, '#fde047', 26, 85, true);
    this.saveGame();
    this.emitHud(true);
  }

  public adminGiveConsumables(key: ConsumableKey | 'all', amount: number) {
    const apply = (k: ConsumableKey) => {
      this.player.consumables[k] = Math.min(CONSUMABLES[k].maxCarry, amount);
    };
    if (key === 'all') (Object.keys(CONSUMABLES) as ConsumableKey[]).forEach(apply);
    else apply(key);
    this.saveGame();
    this.emitHud(true);
  }

  public adminTeleport(gx?: number, gy?: number) {
    const tx = (gx ?? Math.floor(this.player.x / TILE_SIZE)) * TILE_SIZE + TILE_SIZE / 2;
    const ty = (gy ?? SURFACE_Y - 1) * TILE_SIZE;
    this.spawnParticles(this.player.x, this.player.y, '#38bdf8', 26, 95, true);
    this.player.x = Math.max(TILE_SIZE * 2, Math.min((WORLD_WIDTH - 2) * TILE_SIZE, tx));
    this.player.y = Math.max(TILE_SIZE, Math.min((WORLD_HEIGHT - 5) * TILE_SIZE, ty));
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    this.player.vx = 0;
    this.player.vy = 0;
    sound.playWarp();
    this.spawnParticles(this.player.x, this.player.y, '#38bdf8', 26, 95, true);
    this.snapCameraToPlayer();
    this.emitHud(true);
  }

  public adminTeleportDepth(depthMeters: number) {
    const gy = SURFACE_Y + Math.max(1, Math.min(WORLD_HEIGHT - 6, depthMeters));
    // Find the nearest open cell around the target depth
    let bestX = Math.floor(this.player.x / TILE_SIZE);
    for (let r = 0; r < 12; r++) {
      for (const dx of [0, r, -r]) {
        const gx = bestX + dx;
        if (gx > 1 && gx < WORLD_WIDTH - 2 && !this.isSolid(gx, gy)) {
          bestX = gx;
          r = 99;
          break;
        }
      }
    }
    this.adminTeleport(bestX, gy);
  }

  public adminHeal() {
    this.player.hull = this.player.maxHull;
    this.player.fuel = this.player.maxFuel;
    this.spawnParticles(this.player.x, this.player.y, '#4ade80', 20, 70, true);
    this.emitHud(true);
  }

  public adminToggleGod(): boolean {
    this.player.godMode = !this.player.godMode;
    if (this.player.godMode) {
      this.player.hull = this.player.maxHull;
      this.player.invulnTimer = 0;
    }
    this.spawnParticles(this.player.x, this.player.y, '#fde047', 24, 80, true);
    this.emitHud(true);
    return this.player.godMode;
  }

  public adminToggleInfiniteFuel(): boolean {
    this.player.infiniteFuel = !this.player.infiniteFuel;
    this.emitHud(true);
    return this.player.infiniteFuel;
  }

  public adminRevealMap() {
    this.explored.fill(1);
    this.emitHud(true);
  }

  public adminNuke(radius = 4) {
    const cx = Math.floor(this.player.x / TILE_SIZE);
    const cy = Math.floor(this.player.y / TILE_SIZE);
    sound.playExplosion();
    this.addShake(8, 0.45);
    this.spawnParticles(this.player.x, this.player.y, '#f97316', 46, 150, true);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.hypot(dx, dy) > radius) continue;
        const t = this.getTile(cx + dx, cy + dy);
        if (TILES[t].solid && TILES[t].destructible) this.breakTile(cx + dx, cy + dy);
      }
    }
  }

  public adminSetSurge(oreId: OreId | 'random') {
    if (oreId === 'random') {
      this.marketSurge = this.rollMarketSurge();
    } else {
      this.marketSurge = { oreId, multiplier: 1.35, timeRemaining: 300 };
    }
    this.setBanner(`SURGE SET: ${ORES[this.marketSurge.oreId].name.toUpperCase()}`, 2.4);
    this.emitHud(true);
  }

  public adminMaxOut() {
    this.adminGiveCredits(500000);
    (Object.keys(UPGRADE_TRACKS) as UpgradeKey[]).forEach((k) =>
      this.adminSetUpgrade(k, UPGRADE_TRACKS[k].tiers.length)
    );
    this.adminGiveConsumables('all', 99);
    this.adminGiveOre('all', 10);
    this.player.godMode = true;
    this.player.infiniteFuel = true;
    this.emitHud(true);
  }
}

export { STRATA };
