import React, { useEffect, useState } from 'react';
import { PixelCubeDrillEmblem } from './PixelIcons';
import { MenuWorld } from './MenuWorld';
import { getQuality, onQualityChange, setQuality, type StoryQuality } from '../game/quality';

interface TitleScreenProps {
  hasSave: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onStartOrContinue: () => void;
  onNewExpedition: () => void;
  onOpenAdmin: () => void;
  onOpenGuide: () => void;
  onWatchStory: () => void;
}

const ORES = ['#d97236', '#e6d825', '#a89f99', '#f2b718', '#25c96e', '#e0284f', '#3085ff', '#b45cff'];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSave, muted, onToggleMute, onStartOrContinue, onNewExpedition, onOpenAdmin, onOpenGuide, onWatchStory,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [quality, setQ] = useState<StoryQuality>(() => getQuality());
  useEffect(() => {
    const off = onQualityChange((q) => setQ(q === 'lite' ? 'lite' : 'hd'));
    return () => { off(); };
  }, []);

  return (
    <div className="menu-shell pixel-scroll fixed inset-0 z-40 overflow-y-auto overscroll-contain">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="menu-frame animate-panel w-full max-w-6xl">
          {/* top bar */}
          <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#0b0f16] bg-[#131c24] px-3 py-2 sm:px-4">
            <div className="flex items-center gap-3">
              <div className="border-2 border-[#0b0f16] bg-[#0d141b] p-1.5 shadow-[inset_2px_2px_0_#2c3943]">
                <PixelCubeDrillEmblem className="h-8 w-8 sm:h-9 sm:w-9" />
              </div>
              <div className="leading-tight">
                <div className="font-pixel text-[9px] text-[#f2c46a] sm:text-[10px]">AETHER RECLAMATION DIVISION</div>
                <div className="font-retro text-sm text-[#8fa8b0]">Outpost 07 · Surface terminal</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuality(quality === 'lite' ? 'hd' : 'lite')}
                className="pixel-btn min-h-[40px] bg-[#1c2a33] px-3 font-pixel text-[8px] text-[#9fd3d4]"
                aria-pressed={quality === 'lite'}
                title="Story playback quality"
              >
                STORY: {quality === 'lite' ? 'LITE' : 'HD'}
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                className={`pixel-btn min-h-[40px] px-3 font-pixel text-[8px] ${muted ? 'bg-[#3a2422] text-[#f0a08a]' : 'bg-[#1f3a2c] text-[#a6dcb2]'}`}
                aria-pressed={muted}
              >
                {muted ? 'SOUND OFF' : 'SOUND ON'}
              </button>
            </div>
          </header>

          <div className="grid gap-0 lg:grid-cols-[1.35fr_1fr]">
            {/* live world */}
            <section className="relative border-b-2 border-[#0b0f16] lg:border-b-0 lg:border-r-2">
              <div className="relative aspect-video w-full overflow-hidden bg-[#0a0c12]">
                <MenuWorld />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#080a10] via-[#080a10]/70 to-transparent px-4 pb-3 pt-10 sm:px-6">
                  <h1 className="font-pixel text-[22px] leading-[1.15] text-[#fde047] sm:text-[30px] lg:text-[34px]" style={{ textShadow: '3px 3px 0 #9a3412, -2px -2px 0 #09070d' }}>
                    SULFURED<br />CAVES
                  </h1>
                  <p className="font-retro mt-1 text-base text-[#d8cbb0] sm:text-lg">Dig deep. Trade ore. Rebuild a forgotten machine.</p>
                </div>
                <div className="absolute left-3 top-3 flex items-center gap-1.5 border border-[#0b0f16] bg-[#0d141b]/85 px-2 py-1">
                  <span className="h-2 w-2 animate-pulse bg-[#7fe39a]" />
                  <span className="font-pixel text-[7px] text-[#a6dcb2]">LIVE FEED</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-px bg-[#0b0f16]">
                {[
                  ['11', 'ORE TYPES'],
                  ['186m', 'TO THE CORE'],
                  ['12', 'STORY CHAPTERS'],
                ].map(([v, l]) => (
                  <div key={l} className="bg-[#111a22] px-3 py-2 text-center">
                    <div className="font-pixel text-[11px] text-[#f2c46a]">{v}</div>
                    <div className="font-retro text-xs text-[#8fa8b0]">{l}</div>
                  </div>
                ))}
              </div>
              <div className="hidden gap-3 border-t-2 border-[#0b0f16] bg-[#0f171e] px-4 py-3 lg:flex">
                {ORES.map((c, i) => (
                  <span key={c} className="h-3 w-3 border border-[#0b0f16]" style={{ backgroundColor: c, animation: `pulseGlow 2s steps(3) ${i * 0.15}s infinite` }} />
                ))}
                <span className="font-retro ml-auto text-sm text-[#8fa8b0]">Copper · Sulfur · Gold · Ruby · Voltite · Mythril</span>
              </div>
            </section>

            {/* command console */}
            <section className="flex flex-col gap-3 bg-[#121a21] p-4 sm:p-5">
              <div className="border-2 border-[#0b0f16] bg-[#0d141b] p-3 shadow-[inset_2px_2px_0_#1f2b35]">
                <div className="font-pixel text-[8px] text-[#7dd3fc]">{hasSave ? 'EXPEDITION LOG RESTORED' : 'NEW EXPEDITION'}</div>
                <p className="font-retro mt-1 text-base leading-snug text-[#c5cfd2]">
                  {hasSave
                    ? 'Your rig is waiting at the outpost. Resume drilling, sell ore, and push deeper toward the Sulfured Core.'
                    : 'CUBE-07 was cast out of the sky city. Mine for the survivors, earn credits, and upgrade your way into the deep.'}
                </p>
              </div>

              <button type="button" onClick={onStartOrContinue} className="pixel-btn w-full bg-[#eab308] py-4 font-pixel text-[11px] text-[#09070d] sm:text-xs">
                {hasSave ? '▶ RESUME EXPEDITION' : '▶ LAUNCH DRILL RIG'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={onWatchStory} className="pixel-btn bg-[#1f3a44] py-3 font-pixel text-[9px] text-[#bfe8f0]">▶ STORY</button>
                <button type="button" onClick={onOpenGuide} className="pixel-btn bg-[#3b2f14] py-3 font-pixel text-[9px] text-[#fde047]">? FIELD MANUAL</button>
              </div>

              <div className="border-2 border-[#0b0f16] bg-[#0d141b] p-3">
                <div className="font-pixel text-[7px] text-[#8fa8b0]">CONTROLS</div>
                <div className="font-retro mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm text-[#c5cfd2]">
                  <span><b className="text-[#f2c46a]">WASD</b> move</span>
                  <span><b className="text-[#f2c46a]">Space</b> thrust</span>
                  <span><b className="text-[#f2c46a]">Click / J</b> drill</span>
                  <span><b className="text-[#f2c46a]">E</b> interact</span>
                  <span><b className="text-[#f2c46a]">1-3</b> consumables</span>
                  <span><b className="text-[#f2c46a]">Esc</b> pause</span>
                </div>
              </div>

              {hasSave && !confirmReset && (
                <button type="button" onClick={() => setConfirmReset(true)} className="pixel-btn w-full bg-[#241f2e] py-2 font-pixel text-[8px] text-[#fca5a5]">
                  NEW WORLD & RESET SAVE
                </button>
              )}
              {confirmReset && (
                <div className="border-2 border-[#7a2e2e] bg-[#2a1616] p-3">
                  <div className="font-pixel text-[8px] text-[#fca5a5]">ERASE CURRENT EXPEDITION?</div>
                  <p className="font-retro mt-1 text-sm text-[#e0b8b8]">This deletes your save and starts a fresh world.</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { setConfirmReset(false); onNewExpedition(); }} className="pixel-btn bg-[#a33a2a] py-2 font-pixel text-[8px] text-[#fff]">RESET</button>
                    <button type="button" onClick={() => setConfirmReset(false)} className="pixel-btn bg-[#1c2a33] py-2 font-pixel text-[8px] text-[#c5cfd2]">CANCEL</button>
                  </div>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <button type="button" onClick={onOpenAdmin} className="pixel-btn bg-[#1c1a24] px-3 py-2 font-pixel text-[8px] text-[#8b8496]">⌘ ADMIN</button>
                <span className="font-retro text-xs text-[#5f7078]">Press ` for terminal</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
