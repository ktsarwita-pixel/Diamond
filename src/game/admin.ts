import { CONSUMABLES, ORE_LIST, UPGRADE_ORDER, UPGRADE_TRACKS } from './constants';
import type { GameEngine } from './engine';
import type { ConsumableKey, OreId, UpgradeKey } from './types';

export const ADMIN_PASSWORD = '123456';

export interface AdminResult {
  ok: boolean;
  message: string;
}

export interface AdminCommandInfo {
  name: string;
  usage: string;
  description: string;
  args?: string[];
}

export const ADMIN_COMMANDS: AdminCommandInfo[] = [
  { name: 'credits', usage: 'credits <amount>', description: 'Add credits to the rig account' },
  {
    name: 'give',
    usage: 'give <ore|all> <amount>',
    description: 'Fill cargo with a specific ore or every ore',
    args: ['all', ...ORE_LIST.map((o) => o.id)],
  },
  {
    name: 'upgrade',
    usage: 'upgrade <system|all> <level|max>',
    description: 'Force a rig system to a tier level',
    args: ['all', ...UPGRADE_ORDER],
  },
  {
    name: 'gear',
    usage: 'gear <bomb|torch|recall|all> <amount>',
    description: 'Stock mining consumables',
    args: ['all', ...Object.keys(CONSUMABLES)],
  },
  { name: 'tp', usage: 'tp <gridX> <gridY>', description: 'Teleport to raw world grid coords' },
  { name: 'depth', usage: 'depth <meters>', description: 'Warp straight to a cave depth' },
  { name: 'heal', usage: 'heal', description: 'Restore hull and energy to 100%' },
  { name: 'god', usage: 'god [on|off]', description: 'Toggle invulnerability' },
  { name: 'fuel', usage: 'fuel [on|off]', description: 'Toggle infinite energy cell' },
  { name: 'reveal', usage: 'reveal', description: 'Reveal the entire cave map' },
  { name: 'nuke', usage: 'nuke [radius]', description: 'Vaporize rock around the rig' },
  {
    name: 'surge',
    usage: 'surge <ore|random>',
    description: 'Force the market surge bonus ore',
    args: ['random', ...ORE_LIST.map((o) => o.id)],
  },
  { name: 'max', usage: 'max', description: 'Max credits, upgrades, gear and cheats' },
  { name: 'status', usage: 'status', description: 'Print current rig diagnostics' },
  { name: 'reset', usage: 'reset', description: 'Wipe save and generate a new world' },
  { name: 'lock', usage: 'lock', description: 'Lock the admin terminal' },
  { name: 'help', usage: 'help', description: 'List all admin commands' },
];

export class AdminSystem {
  public unlocked = false;
  public attempts = 0;
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public attemptUnlock(password: string): AdminResult {
    if (password === ADMIN_PASSWORD) {
      this.unlocked = true;
      this.engine.adminUnlocked = true;
      this.attempts = 0;
      return { ok: true, message: 'ACCESS GRANTED — OVERRIDE CONSOLE ONLINE' };
    }
    this.attempts++;
    return {
      ok: false,
      message: `ACCESS DENIED [attempt ${this.attempts}] — INVALID OVERRIDE KEY`,
    };
  }

  public lock(): AdminResult {
    this.unlocked = false;
    this.engine.adminUnlocked = false;
    return { ok: true, message: 'CONSOLE LOCKED' };
  }

  public execute(raw: string): AdminResult {
    if (!this.unlocked) return { ok: false, message: 'TERMINAL LOCKED — ENTER OVERRIDE KEY' };

    const input = raw.trim().replace(/^\//, '');
    if (!input) return { ok: false, message: 'EMPTY COMMAND — TYPE "help"' };

    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const num = (i: number, fallback: number) => {
      const v = Number(args[i]);
      return Number.isFinite(v) ? v : fallback;
    };

    switch (cmd) {
      case 'help': {
        return {
          ok: true,
          message: ADMIN_COMMANDS.map((c) => c.usage).join('\n'),
        };
      }

      case 'credits':
      case 'money': {
        const amount = Math.round(num(0, 10000));
        this.engine.adminGiveCredits(amount);
        return { ok: true, message: `+${amount.toLocaleString()} CREDITS DEPOSITED` };
      }

      case 'give': {
        const target = (args[0] || 'all').toLowerCase();
        const amount = Math.max(0, Math.round(num(1, 10)));
        if (target === 'all') {
          this.engine.adminGiveOre('all', amount);
          return { ok: true, message: `CARGO FILLED: ALL ORES x${amount}` };
        }
        const ore = ORE_LIST.find((o) => o.id === target);
        if (!ore) {
          return {
            ok: false,
            message: `UNKNOWN ORE "${target}" — TRY: ${ORE_LIST.map((o) => o.id).join(', ')}`,
          };
        }
        this.engine.adminGiveOre(ore.id as OreId, amount);
        return { ok: true, message: `CARGO SET: ${ore.name.toUpperCase()} x${amount}` };
      }

      case 'upgrade': {
        const target = (args[0] || 'all').toLowerCase();
        const lvlArg = (args[1] || 'max').toLowerCase();
        const level = lvlArg === 'max' ? 5 : Math.max(1, Math.round(Number(lvlArg) || 1));
        if (target === 'all' || target === 'max') {
          this.engine.adminSetUpgrade('all', level);
          return { ok: true, message: `ALL SYSTEMS FORCED TO TIER ${level}` };
        }
        const key = UPGRADE_ORDER.find((k) => k === target) as UpgradeKey | undefined;
        if (!key) {
          return { ok: false, message: `UNKNOWN SYSTEM "${target}" — TRY: ${UPGRADE_ORDER.join(', ')}` };
        }
        const maxLvl = UPGRADE_TRACKS[key].tiers.length;
        this.engine.adminSetUpgrade(key, Math.min(level, maxLvl));
        return {
          ok: true,
          message: `${UPGRADE_TRACKS[key].name} → MK.${Math.min(level, maxLvl)}`,
        };
      }

      case 'gear':
      case 'item': {
        const target = (args[0] || 'all').toLowerCase();
        const amount = Math.max(0, Math.round(num(1, 10)));
        if (target === 'all') {
          this.engine.adminGiveConsumables('all', amount);
          return { ok: true, message: `ALL GEAR STOCKED x${amount}` };
        }
        const key = (Object.keys(CONSUMABLES) as ConsumableKey[]).find((k) => k === target);
        if (!key) {
          return {
            ok: false,
            message: `UNKNOWN GEAR "${target}" — TRY: ${Object.keys(CONSUMABLES).join(', ')}`,
          };
        }
        this.engine.adminGiveConsumables(key, amount);
        return { ok: true, message: `${CONSUMABLES[key].name.toUpperCase()} x${amount}` };
      }

      case 'tp':
      case 'teleport': {
        const gx = Math.round(num(0, NaN));
        const gy = Math.round(num(1, NaN));
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
          return { ok: false, message: 'USAGE: tp <gridX> <gridY>' };
        }
        this.engine.adminTeleport(gx, gy);
        return { ok: true, message: `WARPED TO GRID ${gx}, ${gy}` };
      }

      case 'depth': {
        const d = Math.round(num(0, 50));
        this.engine.adminTeleportDepth(d);
        return { ok: true, message: `DESCENDED TO ${d}m` };
      }

      case 'heal':
      case 'repair': {
        this.engine.adminHeal();
        return { ok: true, message: 'HULL & ENERGY RESTORED TO 100%' };
      }

      case 'god': {
        const want = (args[0] || '').toLowerCase();
        const next =
          want === 'on' ? true : want === 'off' ? false : !this.engine.player.godMode;
        const current = this.engine.adminToggleGod();
        const state = want ? next : current;
        if (state !== this.engine.player.godMode) this.engine.adminToggleGod();
        return { ok: true, message: `GOD MODE ${this.engine.player.godMode ? 'ENABLED' : 'DISABLED'}` };
      }

      case 'fuel':
      case 'energy': {
        const want = (args[0] || '').toLowerCase();
        if (want === 'on' && !this.engine.player.infiniteFuel) this.engine.adminToggleInfiniteFuel();
        else if (want === 'off' && this.engine.player.infiniteFuel)
          this.engine.adminToggleInfiniteFuel();
        else if (!want) this.engine.adminToggleInfiniteFuel();
        return {
          ok: true,
          message: `INFINITE ENERGY ${this.engine.player.infiniteFuel ? 'ENABLED' : 'DISABLED'}`,
        };
      }

      case 'reveal':
      case 'map': {
        this.engine.adminRevealMap();
        return { ok: true, message: 'FULL CAVE NETWORK REVEALED' };
      }

      case 'nuke':
      case 'blast': {
        const radius = Math.max(1, Math.min(14, Math.round(num(0, 4))));
        this.engine.adminNuke(radius);
        return { ok: true, message: `DETONATION RADIUS ${radius} EXECUTED` };
      }

      case 'surge':
      case 'market': {
        const target = (args[0] || 'random').toLowerCase();
        if (target === 'random') {
          this.engine.adminSetSurge('random');
          return { ok: true, message: 'RANDOM MARKET SURGE ROLLED' };
        }
        const ore = ORE_LIST.find((o) => o.id === target);
        if (!ore) return { ok: false, message: `UNKNOWN ORE "${target}"` };
        this.engine.adminSetSurge(ore.id as OreId);
        return { ok: true, message: `SURGE LOCKED: ${ore.name.toUpperCase()} +35%` };
      }

      case 'max':
      case 'maxout': {
        this.engine.adminMaxOut();
        return { ok: true, message: 'RIG FULLY MAXED — GOD MODE & INFINITE ENERGY ON' };
      }

      case 'status':
      case 'info': {
        const p = this.engine.player;
        return {
          ok: true,
          message: [
            `CREDITS: $${p.credits.toLocaleString()}`,
            `HULL: ${Math.ceil(p.hull)}/${p.maxHull}  ENERGY: ${Math.ceil(p.fuel)}/${p.maxFuel}`,
            `CARGO: ${this.engine.getCargoCount()}/${this.engine.getCargoCapacity()}`,
            `DEPTH: ${Math.max(0, Math.floor(p.y / 16) - 12)}m  MAX: ${p.maxDepthReached}m`,
            `MINED: ${p.totalBlocksMined}  EARNED: $${p.totalCreditsEarned}`,
            `UPGRADES: ${UPGRADE_ORDER.map((k) => `${k[0].toUpperCase()}${p.upgrades[k]}`).join(' ')}`,
            `GOD: ${p.godMode ? 'ON' : 'OFF'}  INF FUEL: ${p.infiniteFuel ? 'ON' : 'OFF'}`,
          ].join('\n'),
        };
      }

      case 'reset':
      case 'wipe': {
        this.engine.resetNewExpedition();
        return { ok: true, message: 'SAVE WIPED — NEW WORLD GENERATED' };
      }

      case 'lock':
      case 'exit': {
        this.lock();
        return { ok: true, message: 'CONSOLE LOCKED' };
      }

      default:
        return {
          ok: false,
          message: `UNKNOWN COMMAND "${cmd}" — TYPE "help" FOR THE OVERRIDE LIST`,
        };
    }
  }
}
