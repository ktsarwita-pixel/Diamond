import React, { useState } from 'react';
import { CHARACTERS, NPC_LINES } from '../game/characters';
import { Portrait } from './DialogueBox';
import {
  CONSUMABLES,
  ORE_LIST,
  ORES,
  UPGRADE_ORDER,
  UPGRADE_TRACKS,
} from '../game/constants';
import {
  ConsumableKey,
  HudSnapshot,
  OreId,
  OutpostBuilding,
  UpgradeKey,
} from '../game/types';
import {
  PixelBombIcon,
  PixelCoinIcon,
  PixelTorchIcon,
  PixelWarpIcon,
} from './PixelIcons';

interface OutpostModalProps {
  initialTab: OutpostBuilding;
  hud: HudSnapshot;
  onClose: () => void;
  onSellAll: () => void;
  onSellOne: (oreId: OreId) => void;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onBuyConsumable: (key: ConsumableKey) => void;
  onServiceRefill: () => void;
}

/**
 * Single-function Outpost Building Modal:
 * - Refinery Depot (`initialTab === 'refinery'`): ONLY smelts and sells ores.
 * - Drill Forge (`initialTab === 'forge'`): ONLY upgrades rig systems & sells mining supplies.
 * Players must physically walk between the Refinery, Drill Forge, and Service Bay on the surface.
 */
export const OutpostModal: React.FC<OutpostModalProps> = ({
  initialTab,
  hud,
  onClose,
  onSellAll,
  onSellOne,
  onBuyUpgrade,
  onBuyConsumable,
}) => {
  const mode: 'refinery' | 'forge' = initialTab === 'forge' ? 'forge' : 'refinery';

  const getUnitPrice = (oreId: OreId) => {
    const base = ORES[oreId].baseValue;
    return hud.marketSurge.oreId === oreId
      ? Math.round(base * hud.marketSurge.multiplier)
      : base;
  };

  let totalCargoValue = 0;
  for (const ore of ORE_LIST) {
    const qty = hud.cargo[ore.id] || 0;
    totalCargoValue += qty * getUnitPrice(ore.id);
  }

  const keeper = mode === 'refinery' ? 'mara' : 'gus';
  const [lineSeed] = useState(() => Math.floor(Math.random() * 4));
  const keeperLine =
    mode === 'refinery' && totalCargoValue > 0
      ? `That haul's worth $${totalCargoValue.toLocaleString()}. Not bad for a sky reject!`
      : NPC_LINES[keeper][lineSeed % NPC_LINES[keeper].length];

  return (
    <div
      className="animate-backdrop fixed inset-0 z-30 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-panel pixel-panel relative flex max-h-[calc(100dvh-0.75rem)] w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hazard-stripe absolute inset-x-0 top-0 z-10 h-1.5 opacity-60" />

        {/* Single-Function Building Header */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b-4 border-[#09070d] bg-[#13101a] px-2.5 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`border-2 border-[#09070d] px-2.5 py-1 font-pixel text-[10px] sm:text-xs ${
                mode === 'refinery'
                  ? 'bg-[#d97706] text-[#fef9c3]'
                  : 'bg-[#0284c7] text-[#e0f2fe]'
              }`}
            >
              {mode === 'refinery' ? '$ ORE SMELTER & REFINERY' : '▲ DRILL FORGE & WORKSHOP'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-[#09070d] px-2.5 py-1">
              <PixelCoinIcon className="h-4 w-4" />
              <span className="font-pixel text-xs text-[#fde047]">
                ${hud.credits.toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="pixel-btn bg-[#991b1b] px-2.5 py-1 font-pixel text-xs text-white"
            >
              X
            </button>
          </div>
        </div>

        {/* Building Proprietor */}
        <div
          key={`keeper-${mode}`}
          className="animate-tab flex items-center gap-3 border-b-4 border-[#09070d] bg-[#17131f] px-3 py-2 sm:px-4"
        >
          <Portrait speaker={keeper} talking size={44} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-pixel text-[9px]" style={{ color: CHARACTERS[keeper].accent }}>
                {CHARACTERS[keeper].name}
              </span>
              <span className="font-retro text-sm text-[#6f6880]">{CHARACTERS[keeper].role}</span>
            </div>
            <p className="font-retro truncate text-base leading-snug text-[#e7e0cc] sm:text-lg">
              &ldquo;{keeperLine}&rdquo;
            </p>
          </div>
        </div>

        {/* Dedicated Building Content */}
        <div className="pixel-scroll flex-1 overflow-y-auto p-3 sm:p-4">
          {mode === 'refinery' ? (
            <div key="refinery" className="animate-tab flex flex-col gap-3">
              {/* Top Sell All Banner */}
              <div className="pixel-panel-sulfur flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <div className="font-pixel text-xs text-[#fde047] sm:text-sm">
                    SMELTER HOPPER INTAKE
                  </div>
                  <div className="font-retro mt-0.5 text-base text-[#d6cfa8]">
                    Cargo: {hud.cargoCount}/{hud.cargoCapacity} slots • Market Surge:{' '}
                    <span className="text-[#fde047]">
                      {ORES[hud.marketSurge.oreId].name} (+35%)
                    </span>{' '}
                    <span className="text-[#94a3b8] tabular-nums">
                      [{Math.ceil(hud.marketSurge.timeRemaining)}s]
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={totalCargoValue <= 0}
                  onClick={onSellAll}
                  className={`pixel-btn bg-[#16a34a] px-4 py-2.5 font-pixel text-xs text-white ${
                    totalCargoValue > 0 ? 'animate-pulse-fast' : ''
                  }`}
                >
                  SELL ALL (+${totalCargoValue.toLocaleString()})
                </button>
              </div>

              {/* Ore Inventory Grid */}
              <div className="stagger grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ORE_LIST.map((ore) => {
                  const qty = hud.cargo[ore.id] || 0;
                  const unitPrice = getUnitPrice(ore.id);
                  const isSurging = hud.marketSurge.oreId === ore.id;

                  return (
                    <div
                      key={ore.id}
                      className={`row-hover flex items-center justify-between border-2 p-2.5 ${
                        isSurging ? 'animate-surge border-[#eab308]' : 'border-[#09070d]'
                      } ${qty > 0 ? 'bg-[#241f30]' : 'bg-[#16131f] opacity-70'}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className="h-7 w-7 shrink-0 border-2 border-[#09070d]"
                          style={{
                            backgroundColor: ore.color,
                            boxShadow: `inset 3px 3px 0 ${ore.accentColor}`,
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-pixel min-w-0 break-words text-[9px] text-[#f5eedc] sm:text-[10px]">
                              {ore.name}
                            </span>
                            {isSurging && (
                              <span className="bg-[#eab308] px-1 font-pixel text-[8px] text-[#09070d]">
                                +35%
                              </span>
                            )}
                          </div>
                          <div className="font-retro text-base leading-tight text-[#cbd5e1]">
                            Unit: <span className="text-[#fde047]">${unitPrice}</span> • In Hold:{' '}
                            <span className="font-bold text-white">{qty}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={qty <= 0}
                        onClick={() => onSellOne(ore.id)}
                        className="pixel-btn bg-[#b45309] px-2.5 py-1.5 font-pixel text-[9px] text-[#fef08a]"
                      >
                        SELL 1
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div key="forge" className="animate-tab flex flex-col gap-4">
              {/* 6 Rig Upgrade Tracks */}
              <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {UPGRADE_ORDER.map((key) => {
                  const track = UPGRADE_TRACKS[key];
                  const level = hud.upgrades[key];
                  const maxLevel = track.tiers.length;
                  const currentTier = track.tiers[level - 1];
                  const nextTier = level < maxLevel ? track.tiers[level] : null;
                  const canAfford = nextTier ? hud.credits >= nextTier.cost : false;

                  return (
                    <div
                      key={key}
                      className="upgrade-card flex flex-col justify-between border-3 border-[#09070d] bg-[#221d2e] p-3 shadow-[inset_2px_2px_0_#362e47]"
                      style={{ borderLeftColor: track.accentColor }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="font-pixel text-[10px]"
                            style={{ color: track.accentColor }}
                          >
                            {track.name}
                          </span>
                          <div className="flex items-center gap-1">
                            {track.tiers.map((t) => (
                              <span
                                key={t.level}
                                className="h-2.5 w-2.5 border border-[#09070d]"
                                style={{
                                  backgroundColor:
                                    t.level <= level ? track.accentColor : '#100d16',
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="font-pixel mt-1.5 text-[10px] text-white">
                          {currentTier.title}
                        </div>
                        <div className="font-retro text-base leading-tight text-[#cbd5e1]">
                          {currentTier.statLabel}
                        </div>
                        <div className="font-retro mt-0.5 text-sm leading-tight text-[#94a3b8]">
                          {track.shortDesc}
                        </div>
                      </div>

                      <div className="mt-3">
                        {nextTier ? (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onBuyUpgrade(key)}
                            className={`pixel-btn w-full py-2 font-pixel text-[10px] ${
                              canAfford
                                ? 'bg-[#eab308] text-[#09070d]'
                                : 'bg-[#2d273b] text-[#94a3b8]'
                            }`}
                          >
                            UPGRADE MK.{nextTier.level} • ${nextTier.cost}
                          </button>
                        ) : (
                          <div className="border-2 border-[#09070d] bg-[#13101a] py-1.5 text-center font-pixel text-[9px] text-[#4ade80]">
                            ★ MAXED OUT ★
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Consumables & Mining Gear */}
              <div className="border-t-2 border-[#362e47] pt-3">
                <div className="font-pixel mb-2 text-[9px] text-[#cbd5e1] sm:text-[10px]">
                  MINING SUPPLIES & CONSUMABLES
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(['bomb', 'torch', 'recall'] as ConsumableKey[]).map((ckey) => {
                    const item = CONSUMABLES[ckey];
                    const owned = hud.consumables[ckey] || 0;
                    const full = owned >= item.maxCarry;
                    const canBuy = !full && hud.credits >= item.cost;

                    return (
                      <div
                        key={ckey}
                        className="flex flex-col justify-between border-2 border-[#09070d] bg-[#1a1624] p-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 shrink-0">
                            {ckey === 'bomb' && <PixelBombIcon className="h-5 w-5" />}
                            {ckey === 'torch' && <PixelTorchIcon className="h-5 w-5" />}
                            {ckey === 'recall' && <PixelWarpIcon className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="font-pixel text-[9px] text-white">
                              {item.name}
                            </div>
                            <div className="font-retro text-sm leading-tight text-[#94a3b8]">
                              {item.description}
                            </div>
                            <div className="font-retro mt-0.5 text-sm text-[#fde047]">
                              Owned: {owned}/{item.maxCarry}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!canBuy}
                          onClick={() => onBuyConsumable(ckey)}
                          className={`pixel-btn mt-2 w-full py-1.5 font-pixel text-[9px] ${
                            canBuy
                              ? 'bg-[#0284c7] text-white'
                              : 'bg-[#262033] text-[#94a3b8]'
                          }`}
                        >
                          {full ? 'MAX CARRIED' : `BUY 1 • $${item.cost}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
