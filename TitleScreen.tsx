import React from 'react';
import { PixelCubeDrillEmblem } from './PixelIcons';

interface TitleScreenProps {
  hasSave: boolean;
  onStartOrContinue: () => void;
  onNewExpedition: () => void;
  onOpenAdmin: () => void;
  onOpenGuide: () => void;
  onWatchStory: () => void;
}

const ORE_STRIP = ['#343842', '#d97236', '#e6d825', '#a89f99', '#f2b718', '#25c96e', '#e0284f', '#3085ff', '#b45cff', '#ff9d00'];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSave,
  onStartOrContinue,
  onNewExpedition,
  onOpenAdmin,
  onOpenGuide,
  onWatchStory,
}) => {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-black/70 p-2 backdrop-blur-[2px] sm:p-4">
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-panel pixel-panel-sulfur relative my-auto w-full max-w-2xl overflow-hidden">
          <div className="hazard-stripe absolute inset-x-0 top-0 z-10 h-2" />

          <div className="flex flex-col gap-3 p-3 pt-5 sm:p-5 md:flex-row md:items-center md:gap-5">
            {/* Brand column */}
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <div className="animate-emblem flex items-center justify-center border-3 border-[#09070d] bg-[#120f16] p-2.5 shadow-[inset_2px_2px_0_#362e47]">
                <PixelCubeDrillEmblem className="h-11 w-11 sm:h-14 sm:w-14" />
              </div>

              <h1
                className="animate-title-flicker font-pixel mt-2.5 text-[18px] leading-tight text-[#fde047] sm:text-2xl"
                style={{ textShadow: '3px 3px 0px #9a3412, -2px -2px 0px #09070d' }}
              >
                SULFURED
                <br />
                CAVES
              </h1>

              <p className="font-retro mt-1 text-base leading-tight text-[#b9b2c4] sm:text-lg">
                A subterranean cube-rig mining story
              </p>

              <div className="mt-2 flex items-center justify-center gap-1">
                {ORE_STRIP.map((c, i) => (
                  <span
                    key={c}
                    className="h-2 w-2 border border-[#09070d] sm:h-2.5 sm:w-2.5"
                    style={{ backgroundColor: c, animation: `pulseGlow 1.8s steps(3) ${i * 0.12}s infinite` }}
                  />
                ))}
              </div>

              <div className="mt-3 flex w-full flex-col gap-2">
                <button
                  type="button"
                  onClick={onStartOrContinue}
                  className="pixel-btn w-full bg-[#eab308] py-3 font-pixel text-[11px] text-[#09070d] sm:text-xs"
                >
                  {hasSave ? '▶ RESUME EXPEDITION' : '▶ LAUNCH DRILL RIG'}
                </button>
                <div className="grid grid-cols-3 gap-1.5">
                  <button type="button" onClick={onWatchStory} className="pixel-btn bg-[#2a1d30] py-2 font-pixel text-[8px] text-[#fbcfe8]">
                    ▶ STORY
                  </button>
                  <button type="button" onClick={onOpenGuide} className="pixel-btn bg-[#3b2f14] py-2 font-pixel text-[8px] text-[#fde047]">
                    ? GUIDE
                  </button>
                  <button type="button" onClick={onOpenAdmin} className="pixel-btn bg-[#1c1a24] py-2 font-pixel text-[8px] text-[#8b8496]">
                    ⌘ ADMIN
                  </button>
                </div>
                {hasSave && (
                  <button
                    type="button"
                    onClick={onNewExpedition}
                    className="pixel-btn w-full bg-[#241f2e] py-1.5 font-pixel text-[8px] text-[#fca5a5]"
                  >
                    NEW WORLD & RESET SAVE
                  </button>
                )}
              </div>
            </div>

            {/* Story / controls column */}
            <div className="w-full min-w-0 md:max-w-[248px]">
              <div className="border-2 border-[#09070d] bg-[#14111c] p-2.5">
                <div className="font-pixel text-[8px] text-[#7dd3fc]">THE FALL OF CUBE-07</div>
                <p className="font-retro mt-1 text-base leading-snug text-[#c5bfd0]">
                  Built in the sky city of <span className="text-[#a5f3fc]">Aether</span> in 2200. Cast down as
                  obsolete in 2245. Rebuilt from scrap by the last humans on Earth.
                </p>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {[
                  ['DESKTOP', 'WASD / Arrows · Space · E · 1-3'],
                  ['MOBILE', 'Stick · FLY · DRILL · tap rock'],
                ].map(([k, v]) => (
                  <div key={k} className="border-2 border-[#09070d] bg-[#17141f] p-1.5">
                    <div className="font-pixel text-[7px] text-[#fde047]">{k}</div>
                    <div className="font-retro mt-0.5 text-sm leading-tight text-[#b9b2c4]">{v}</div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={onOpenGuide}
                className="pixel-btn mt-2 w-full bg-[#17141f] py-1.5 font-retro text-sm text-[#a5f3fc]"
              >
                Open the full Field Manual →
              </button>
            </div>
          </div>

          <div className="border-t-2 border-[#09070d] bg-[#100d16] px-3 py-1.5 text-center">
            <span className="font-retro text-sm text-[#6f6880]">
              Press <span className="text-[#fde047]">`</span> anywhere for the admin terminal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
