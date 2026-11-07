export enum TileType {
  AIR = 0,
  SURFACE_PAD = 1,
  DIRT = 2,
  ASH_STONE = 3,
  SULFUR_LIMESTONE = 4,
  BRIMSTONE_BASALT = 5,
  ABYSSAL_OBSIDIAN = 6,
  CORE_BEDROCK = 7,
  MAGMA_ROCK = 8,
  SULFUR_GAS_POCKET = 9,

  // Ores
  ORE_COAL = 10,
  ORE_COPPER = 11,
  ORE_SULFUR = 12,
  ORE_IRON = 13,
  ORE_SILVER = 14,
  ORE_GOLD = 15,
  ORE_EMERALD = 16,
  ORE_RUBY = 17,
  ORE_VOLTITE = 18,
  ORE_MYTHRIL = 19,
  ORE_HEART_OF_SULFUR = 20,
}

export type OreId =
  | 'coal'
  | 'copper'
  | 'sulfur'
  | 'iron'
  | 'silver'
  | 'gold'
  | 'emerald'
  | 'ruby'
  | 'voltite'
  | 'mythril'
  | 'heart_of_sulfur';

export interface OreDefinition {
  id: OreId;
  tileType: TileType;
  name: string;
  baseValue: number;
  color: string;
  accentColor: string;
  minDepth: number;
  maxDepth: number;
  rarity: number;
}

export interface TileDefinition {
  type: TileType;
  name: string;
  solid: boolean;
  destructible: boolean;
  hardness: number;
  minDrillTier: number;
  particleColor: string;
  oreId?: OreId;
  hazardDamage?: number;
}

export type UpgradeKey =
  | 'drill'
  | 'thruster'
  | 'cargo'
  | 'fuel'
  | 'armor'
  | 'headlamp';

export interface UpgradeTierInfo {
  level: number;
  title: string;
  cost: number;
  statLabel: string;
  value: number;
}

export interface UpgradeTrack {
  key: UpgradeKey;
  name: string;
  shortDesc: string;
  accentColor: string;
  tiers: UpgradeTierInfo[];
}

export type ConsumableKey = 'bomb' | 'torch' | 'recall';

export interface ConsumableDefinition {
  key: ConsumableKey;
  name: string;
  description: string;
  cost: number;
  maxCarry: number;
  color: string;
}

export type FacingDir = 'right' | 'left' | 'down' | 'up';

export interface PlayerState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
  facing: FacingDir;
  aimAngle: number;
  aimVisual: number;
  isDrilling: boolean;
  isThrusting: boolean;
  thrustVisual: number;
  drillExtend: number;
  drillSpin: number;
  drillTarget: { gx: number; gy: number } | null;
  drillProgress: number;
  drillHeat: number;
  wheelPhase: number;
  bobPhase: number;
  squashX: number;
  squashY: number;
  invulnTimer: number;
  damageFlash: number;
  godMode: boolean;
  infiniteFuel: boolean;
  idleTime: number;
  storyFlags: string[];

  // Combo & Streak
  miningCombo: number;
  comboTimer: number;

  // Stats & Progression
  credits: number;
  hull: number;
  maxHull: number;
  fuel: number;
  maxFuel: number;
  cargo: Record<OreId, number>;
  upgrades: Record<UpgradeKey, number>;
  consumables: Record<ConsumableKey, number>;
  achievements: string[];

  // Lifetime stats
  maxDepthReached: number;
  totalBlocksMined: number;
  totalCreditsEarned: number;
}

export interface DroppedOre {
  id: number;
  oreId: OreId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  rotation: number;
  spinSpeed: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
  glow?: boolean;
}

export interface CaveDrip {
  id: number;
  x: number;
  y: number;
  vy: number;
  color: string;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale?: number;
}

export interface ActiveBomb {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
  maxFuse: number;
}

export interface PlacedTorch {
  gx: number;
  gy: number;
  flickerOffset: number;
}

export interface GasCloud {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface SonarWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

export interface MarketSurge {
  oreId: OreId;
  multiplier: number;
  timeRemaining: number;
}

export type OutpostBuilding = 'refinery' | 'forge' | 'repair' | null;

export interface InputState {
  moveX: number;
  moveY: number;
  thrustHeld: boolean;
  drillHeld: boolean;
  pointerActive: boolean;
  pointerWorldX: number;
  pointerWorldY: number;
}

export interface DialogueLine {
  id: number;
  speaker: 'mara' | 'gus' | 'ilse' | 'pip' | 'cube';
  text: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardCredits: number;
  badge: string;
}

export interface GameSettings {
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
  shakeIntensity: number; // 0..2
  controlSide: 'left' | 'right';
  floatingStick: boolean;
  haptics: boolean;
  scanlines: boolean;
  showFps: boolean;
}

export interface HudSnapshot {
  credits: number;
  depthMeters: number;
  maxDepthMeters: number;
  hull: number;
  maxHull: number;
  fuel: number;
  maxFuel: number;
  cargoCount: number;
  cargoCapacity: number;
  cargo: Record<OreId, number>;
  upgrades: Record<UpgradeKey, number>;
  consumables: Record<ConsumableKey, number>;
  nearbyBuilding: OutpostBuilding;
  onSurface: boolean;
  marketSurge: MarketSurge;
  totalBlocksMined: number;
  totalCreditsEarned: number;
  statusBanner: string | null;
  godMode: boolean;
  infiniteFuel: boolean;
  dialogue: DialogueLine | null;

  // New features
  miningCombo: number;
  comboMultiplier: number;
  achievements: string[];
  recentAchievement: AchievementDef | null;
  radarReady: boolean;
  radarCooldownPct: number;

  /** NPC speech bubble positioned in screen space (CSS px) for the React overlay. */
  npcBubble: { speaker: SpeakerId; text: string; x: number; y: number } | null;
}

export type SpeakerId = 'mara' | 'gus' | 'ilse' | 'pip' | 'cube';
