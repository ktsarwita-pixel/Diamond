import React, { useState } from 'react';
import { HudSnapshot } from '../game/types';

interface PauseModalProps {
  hud: HudSnapshot;
  muted: boolean;
  touchEnabled: boolean;
  adminUnlocked: boolean;
  onResume: () => void;
  onToggleMute: () => void;
  onToggleTouch: () => void;
  onOpenAdmin: () => void;
  onOpenGuide: () => void;
  onReplayStory: () => void;
  onNewExpedition: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  hud,
  muted,
  touchEnabled,
  adminUnlocked,
  onResume,
  onToggleMute,
  onToggleTouch,
  onOpenAdmin,
  onOpenGuide,
  onReplayStory,
  onNewExpedition,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div
      className="animate-backdrop fixed inset-0 z-40 flex items-center justify-center p-3"
      onClick={onResume}
    >
      <div
        className="animate-panel pixel-panel pixel-scroll flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-3 border-[#09070d] pb-2.5">
          <h2 className="font-pixel text-sm text-[#fde047]">EXPEDITION PAUSED</h2>
          <button
            type="button"
            onClick={onResume}
            className="pixel-btn bg-[#991b1b] px-2.5 py-1 font-pixel text-xs text-white"
          >
            X
          </button>
        </div>

        {/* Expedition Stats */}
        <div className="grid grid-cols-3 gap-2 border-2 border-[#09070d] bg-[#120f16] p-2.5 text-center">
          <div>
            <div className="font-retro text-sm text-[#94a3b8]">MAX DEPTH</div>
            <div className="font-pixel text-xs text-[#38bdf8]">
              {hud.maxDepthMeters}m
            </div>
          </div>
          <div className="border-x-2 border-[#262033]">
            <div className="font-retro text-sm text-[#94a3b8]">MINED</div>
            <div className="font-pixel text-xs text-[#fde047]">
              {hud.totalBlocksMined}
            </div>
          </div>
          <div>
            <div className="font-retro text-sm text-[#94a3b8]">EARNED</div>
            <div className="font-pixel text-xs text-[#4ade80]">
              ${hud.totalCreditsEarned}
            </div>
          </div>
        </div>

        {/* Settings Toggles */}
        <button
          type="button"
          onClick={onOpenGuide}
          className="pixel-btn flex w-full items-center justify-between bg-[#3b2f14] px-3 py-2.5 font-pixel text-[10px] text-[#fde047]"
        >
          <span>? FIELD MANUAL & CONTROLS</span>
          <span className="text-[#d6cfa8]">OPEN</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onToggleTouch}
            className={`pixel-btn py-2.5 font-pixel text-[10px] ${
              touchEnabled
                ? 'bg-[#4d7c0f] text-[#ecfccb]'
                : 'bg-[#2a2438] text-[#cbd5e1]'
            }`}
          >
            TOUCH PAD: {touchEnabled ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className={`pixel-btn py-2.5 font-pixel text-[10px] ${
              !muted
                ? 'bg-[#0369a1] text-[#e0f2fe]'
                : 'bg-[#2a2438] text-[#cbd5e1]'
            }`}
          >
            AUDIO: {muted ? 'MUTED' : 'ON'}
          </button>
        </div>

        <button
          type="button"
          onClick={onReplayStory}
          className="pixel-btn flex w-full items-center justify-between bg-[#2a1d30] px-3 py-2.5 font-pixel text-[10px] text-[#fbcfe8]"
        >
          <span>▶ REPLAY STORY: THE FALL OF CUBE-07</span>
          <span className="text-[#a78bfa]">10 SCENES</span>
        </button>

        {/* Admin Override Terminal */}
        <button
          type="button"
          onClick={onOpenAdmin}
          className={`pixel-btn flex w-full items-center justify-between px-3 py-2.5 font-pixel text-[10px] ${
            adminUnlocked
              ? 'bg-[#14301c] text-[#7dff9b]'
              : 'bg-[#1c1a24] text-[#8b8496] hover:text-[#4ade80]'
          }`}
        >
          <span>⌘ ADMIN OVERRIDE TERMINAL</span>
          <span className={adminUnlocked ? 'text-[#fde047]' : 'text-[#5c5566]'}>
            {adminUnlocked ? 'UNLOCKED' : 'LOCKED'}
          </span>
        </button>

        {/* Controls Guide */}
        <div className="font-retro border-2 border-[#09070d] bg-[#14111c] p-2.5 text-base leading-snug text-[#cbd5e1]">
          <div className="font-pixel mb-1 text-[9px] text-[#fde047]">CONTROLS</div>
          <div>• Move & Auto-Drill: WASD / Arrows / Touch Stick</div>
          <div>• Jetpack Thrusters: W / Up / Space / FLY Button</div>
          <div>• Aim & Drill Block: Mouse Hold or Tap Adjacent Rock</div>
          <div>• Gear: [1] Sulfur Charge • [2] Flare • [3] Warp</div>
          <div>• Outpost: [E] Open Refinery / Forge / Service Bay</div>
          <div>
            • Admin Terminal: <span className="text-[#fde047]">`</span> or{' '}
            <span className="text-[#fde047]">/</span> or [F2]
          </div>
        </div>

        {/* Resume & Reset */}
        <div className="mt-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="pixel-btn w-full bg-[#eab308] py-3 font-pixel text-xs text-[#09070d]"
          >
            ▶ RESUME MINING
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="pixel-btn w-full bg-[#2a2438] py-2 font-pixel text-[9px] text-[#fca5a5]"
            >
              NEW WORLD & RESET PROGRESS
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onNewExpedition();
                }}
                className="pixel-btn flex-1 bg-[#dc2626] py-2 font-pixel text-[9px] text-white"
              >
                CONFIRM RESET!
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="pixel-btn flex-1 bg-[#2a2438] py-2 font-pixel text-[9px] text-[#cbd5e1]"
              >
                CANCEL
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
