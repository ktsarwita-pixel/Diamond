import React, { useEffect, useRef, useState } from 'react';
import { ORE_LIST, ORES, STRATA, getStratumAtDepth } from '../game/constants';
import { HudSnapshot, OutpostBuilding } from '../game/types';
import {
  PixelBoltIcon,
  PixelCoinIcon,
  PixelCrateIcon,
  PixelFlameIcon,
  PixelHeartIcon,
} from './PixelIcons';

interface HudOverlayProps {
  hud: HudSnapshot;
  touchEnabled: boolean;
  adminUnlocked: boolean;
  onOpenGuide: () => void;
  onOpenAdmin: () => void;
  onToggleTouch: () => void;
  onOpenPause: () => void;
  onOpenOutpost: (building: OutpostBuilding) => void;
  onQuickSellAll: () => void;
  onServiceRefill: () => void;
  onTriggerRadar?: () => void;
}

function useTweenedNumber(value: number, speed = 9): number {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);
  const fromRef = useRef(value);
  const startRef = useRef(0);
  useEffect(() => {
    const from = display;
    if (Math.abs(value - from) < 1) {
      setDisplay(value);
      return;
    }
    fromRef.current = from;
    startRef.current = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, ((now - startRef.current) / 1000) * speed);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(fromRef.current + (value - fromRef.current) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
}

const StatBar: React.FC<{
  ratio: number;
  color: string;
  lowColor: string;
  low?: boolean;
  label: string;
  shine?: boolean;
}> = ({ ratio, color, lowColor, low = false, label, shine = true }) => {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  const [ghost, setGhost] = useState(pct);
  const [flash, setFlash] = useState(false);
  const prev = useRef(pct);
  useEffect(() => {
    if (pct < prev.current - 0.5) {
      setFlash(true);
      const a = window.setTimeout(() => setFlash(false), 160);
      const b = window.setTimeout(() => setGhost(pct), 380);
      prev.current = pct;
      return () => {
        window.clearTimeout(a);
        window.clearTimeout(b);
      };
    }
    setGhost(pct);
    prev.current = pct;
  }, [pct]);

  return (
    <div
      className={`relative h-3.5 w-full min-w-[64px] border-2 bg-[#120f16] transition-colors duration-150 ${
        flash ? 'border-[#fca5a5]' : 'border-[#09070d]'
      }`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-[#fff1f2]"
        style={{
          width: `${Math.max(ghost, pct)}%`,
          opacity: ghost > pct ? 0.7 : 0,
          transition: 'width 520ms cubic-bezier(0.22,1,0.36,1), opacity 300ms ease',
        }}
      />
      <div
        className={`bar-fill relative h-full ${shine ? 'bar-fill-shine' : ''} ${low ? 'animate-pulse-fast' : ''}`}
        style={{ width: `${pct}%`, backgroundColor: low ? lowColor : color }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 7px, rgba(9,7,13,0.85) 7px, rgba(9,7,13,0.85) 9px)',
        }}
      />
      <span className="font-retro pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] leading-none text-white drop-shadow-[0_1px_0_#000]">
        {label}
      </span>
    </div>
  );
};

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  touchEnabled,
  adminUnlocked,
  onOpenGuide,
  onOpenAdmin,
  onToggleTouch,
  onOpenPause,
  onOpenOutpost,
  onServiceRefill,
}) => {
  const stratum = getStratumAtDepth(hud.depthMeters);
  const credits = useTweenedNumber(hud.credits);
  const [popKey, setPopKey] = useState(0);
  const lastCredits = useRef(hud.credits);
  useEffect(() => {
    if (hud.credits > lastCredits.current) setPopKey((k) => k + 1);
    lastCredits.current = hud.credits;
  }, [hud.credits]);

  const hullPct = hud.hull / Math.max(1, hud.maxHull);
  const fuelPct = hud.fuel / Math.max(1, hud.maxFuel);
  const cargoPct = hud.cargoCount / Math.max(1, hud.cargoCapacity);
  const surgeOre = ORES[hud.marketSurge.oreId];
  const cargoFull = hud.cargoCount >= hud.cargoCapacity;

  let cargoValue = 0;
  for (const ore of ORE_LIST) {
    const qty = hud.cargo[ore.id] || 0;
    if (qty > 0) {
      cargoValue +=
        qty * (hud.marketSurge.oreId === ore.id ? Math.round(ore.baseValue * hud.marketSurge.multiplier) : ore.baseValue);
    }
  }
  const carried = ORE_LIST.filter((o) => (hud.cargo[o.id] || 0) > 0)
    .sort((a, b) => (hud.cargo[b.id] || 0) - (hud.cargo[a.id] || 0))
    .slice(0, 4);
  const depthPct = Math.min(100, (hud.depthMeters / STRATA[STRATA.length - 1].maxDepth) * 100);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex max-w-full flex-col gap-1 overflow-hidden px-1.5 pt-[max(0.35rem,env(safe-area-inset-top))] sm:gap-1.5 sm:px-3">
      {/* Top row */}
      <div className="flex w-full flex-wrap items-start justify-between gap-1">
        {/* Telemetry */}
        <div className="hud-card pixel-panel pointer-events-auto min-w-0 max-w-full flex-1 basis-[186px] px-2 py-1.5 sm:max-w-[430px] sm:px-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex shrink-0 items-center gap-1">
              <PixelCoinIcon className="h-3.5 w-3.5" />
              <span
                key={popKey}
                className={`font-pixel text-[10px] tabular-nums text-[#fde047] sm:text-[11px] ${popKey ? 'animate-pop' : ''}`}
              >
                ${credits.toLocaleString()}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1 border-l-2 border-[#362e47] pl-2">
              <div className="relative h-5 w-1.5 border-2 border-[#09070d] bg-[#120f16]">
                <div
                  className="absolute inset-x-0 top-0 transition-all duration-300"
                  style={{ height: `${depthPct}%`, backgroundColor: stratum.accent }}
                />
              </div>
              <span className="font-pixel text-[10px] tabular-nums text-[#e2e8f0]">{hud.depthMeters}m</span>
            </div>

            <div className="flex shrink-0 items-center gap-1 border-l-2 border-[#362e47] pl-2">
              <PixelCrateIcon className="h-3.5 w-3.5" />
              <span
                className={`font-pixel text-[10px] tabular-nums ${
                  cargoFull ? 'animate-pulse-fast text-[#fde047]' : 'text-[#f5eedc]'
                }`}
              >
                {hud.cargoCount}/{hud.cargoCapacity}
              </span>
            </div>

            {carried.length > 0 && (
              <div className="hidden min-w-0 items-center gap-1 border-l-2 border-[#362e47] pl-2 sm:flex">
                {carried.map((o) => (
                  <span
                    key={o.id}
                    title={`${o.name} x${hud.cargo[o.id]}`}
                    className="flex items-center gap-0.5 border border-[#09070d] bg-[#120f16] px-0.5 py-0.5"
                  >
                    <span
                      className="inline-block h-2 w-2"
                      style={{ backgroundColor: o.color, boxShadow: `inset 1px 1px 0 ${o.accentColor}` }}
                    />
                    <span className="font-retro text-[12px] leading-none text-[#cbd5e1]">{hud.cargo[o.id]}</span>
                  </span>
                ))}
              </div>
            )}

            <div
              className={`ml-auto hidden shrink-0 items-center gap-1 border-2 border-[#09070d] bg-[#120f16] px-1 py-0.5 md:flex ${
                cargoFull ? 'opacity-40' : 'animate-surge'
              }`}
              title={`Market surge: ${surgeOre.name} +35%`}
            >
              <span className="inline-block h-2 w-2 border border-black" style={{ backgroundColor: surgeOre.color }} />
              <span className="font-retro text-[12px] leading-none text-[#d6cfa8]">
                {surgeOre.name.split(' ')[0].toUpperCase()} +35%
              </span>
              <span className="font-retro text-[12px] leading-none tabular-nums text-[#fde047]">
                {Math.ceil(hud.marketSurge.timeRemaining)}s
              </span>
            </div>
            <div className="ml-auto flex min-w-0 shrink items-center gap-1 md:hidden">
              <span className="h-2 w-2 shrink-0 border border-black" style={{ backgroundColor: stratum.accent }} />
              <span className="font-retro max-w-[92px] truncate text-[12px] leading-none text-[#a9a3b8]">
                {stratum.name}
              </span>
              {cargoFull && (
                <span className="font-pixel animate-pulse-fast text-[7px] text-[#fde047]">FULL</span>
              )}
            </div>

            {/* Mining Momentum Combo Streak Chip */}
            {hud.miningCombo >= 2 && (
              <div className="animate-pop flex shrink-0 items-center gap-1 border-2 border-[#ea580c] bg-[#2a1309] px-1.5 py-0.5 shadow-[0_0_8px_rgba(249,115,22,0.4)]">
                <PixelFlameIcon className="h-3 w-3" />
                <span className="font-pixel text-[8px] text-[#fde047]">
                  x{hud.miningCombo}
                </span>
                <span className="font-retro hidden text-xs leading-none text-[#ffedd5] sm:inline">
                  +{Math.round((hud.comboMultiplier - 1) * 100)}% SPD
                </span>
              </div>
            )}
          </div>

          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <div className="flex min-w-0 items-center gap-1">
              <PixelHeartIcon className="h-3 w-3 shrink-0" />
              <StatBar
                ratio={hullPct}
                color="#fb7185"
                lowColor="#ef4444"
                low={hullPct < 0.3}
                label={`${hud.hull}/${hud.maxHull}`}
              />
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <PixelBoltIcon className="h-3 w-3 shrink-0" />
              <StatBar
                ratio={fuelPct}
                color={hud.infiniteFuel ? '#fde047' : '#4ade80'}
                lowColor="#f97316"
                low={fuelPct < 0.25 && !hud.infiniteFuel}
                label={hud.infiniteFuel ? '∞' : `${hud.fuel}/${hud.maxFuel}`}
              />
            </div>
          </div>

          <div className="mt-1 h-1.5 w-full border-2 border-[#09070d] bg-[#120f16]">
            <div
              className="bar-fill h-full"
              style={{
                width: `${Math.max(0, Math.min(100, cargoPct * 100))}%`,
                backgroundColor: cargoFull ? '#fde047' : '#d97706',
              }}
            />
          </div>
        </div>

        {/* Actions (no remote building shortcuts — walk to each building to use it) */}
        <div className="pointer-events-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1">
          <button
            onClick={onOpenGuide}
            className="pixel-btn h-9 w-9 bg-[#3b2f14] font-pixel text-[12px] text-[#fde047]"
            title="Field Manual (Guide)"
            aria-label="Open guide"
          >
            ?
          </button>

          <button
            onClick={onToggleTouch}
            className={`pixel-btn hidden h-9 px-1.5 font-pixel text-[8px] sm:flex ${
              touchEnabled ? 'bg-[#4d7c0f] text-[#ecfccb]' : 'bg-[#2a2438] text-[#cbd5e1]'
            }`}
            title="Toggle touch controls"
          >
            PAD
          </button>

          <button
            onClick={onOpenAdmin}
            className={`pixel-btn h-9 px-1.5 font-pixel text-[9px] ${
              adminUnlocked
                ? 'animate-pulse-fast bg-[#166534] text-[#dcfce7]'
                : 'hidden bg-[#241f2e] text-[#7f8a99] sm:flex'
            }`}
            title="Admin override terminal (`)"
          >
            {adminUnlocked ? 'ROOT' : '⌘'}
          </button>

          <button
            onClick={onOpenPause}
            className="pixel-btn h-9 w-9 bg-[#2a2438] font-pixel text-[9px] text-[#f5eedc]"
            title="Pause menu"
            aria-label="Pause"
          >
            II
          </button>
        </div>
      </div>

      {/* Status strip */}
      <div className="flex w-full flex-col items-center gap-1">
        {adminUnlocked && (
          <div className="flex max-w-full items-center gap-2 border-2 border-[#09070d] bg-[#0b1a10] px-2 py-0.5">
            <span className="font-pixel text-[7px] text-[#4ade80] sm:text-[8px]">ADMIN OVERRIDE</span>
            {hud.godMode && <span className="font-pixel animate-pulse-fast text-[7px] text-[#fde047] sm:text-[8px]">GOD</span>}
            {hud.infiniteFuel && <span className="font-pixel text-[7px] text-[#7dd3fc] sm:text-[8px]">∞ FUEL</span>}
          </div>
        )}

        {hud.nearbyBuilding === 'refinery' && (
          <button
            onClick={() => onOpenOutpost('refinery')}
            className="animate-float-in pointer-events-auto pixel-btn max-w-full bg-[#d97706] px-2.5 py-1.5 text-center font-pixel text-[8px] leading-tight text-[#fef9c3] sm:text-[10px]"
          >
            [E] ENTER REFINERY {cargoValue > 0 ? `(+$${cargoValue.toLocaleString()})` : ''}
          </button>
        )}

        {hud.nearbyBuilding === 'forge' && (
          <button
            onClick={() => onOpenOutpost('forge')}
            className="animate-float-in pointer-events-auto pixel-btn max-w-full bg-[#0284c7] px-2.5 py-1.5 text-center font-pixel text-[8px] leading-tight text-[#e0f2fe] sm:text-[10px]"
          >
            [E] DRILL FORGE
          </button>
        )}

        {hud.nearbyBuilding === 'repair' && (
          <button
            onClick={onServiceRefill}
            className="animate-float-in pointer-events-auto pixel-btn max-w-full bg-[#15803d] px-2.5 py-1.5 text-center font-pixel text-[8px] leading-tight text-[#dcfce7] sm:text-[10px]"
          >
            [E] RECHARGE
          </button>
        )}

        {hud.statusBanner && (
          <div
            key={hud.statusBanner}
            className="animate-banner pixel-panel-sulfur max-w-full break-words px-2.5 py-1 text-center font-pixel text-[8px] leading-tight text-[#fde047] sm:text-[9px]"
          >
            {hud.statusBanner}
          </div>
        )}
      </div>
    </div>
  );
};
