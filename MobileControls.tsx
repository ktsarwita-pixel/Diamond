import React, { useCallback, useRef, useState } from 'react';
import { ConsumableKey } from '../game/types';
import { PixelBombIcon, PixelTorchIcon, PixelWarpIcon } from './PixelIcons';

interface MobileControlsProps {
  consumables: Record<ConsumableKey, number>;
  onMoveVector: (mx: number, my: number) => void;
  onThrustChange: (held: boolean) => void;
  onDrillChange: (held: boolean) => void;
  onUseConsumable: (key: ConsumableKey) => void;
}

const buzz = (ms = 8) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
};

export const MobileControls: React.FC<MobileControlsProps> = ({
  consumables,
  onMoveVector,
  onThrustChange,
  onDrillChange,
  onUseConsumable,
}) => {
  const stickRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [thrustActive, setThrustActive] = useState(false);
  const [drillActive, setDrillActive] = useState(false);

  const updateStick = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const radius = Math.min(rect.width, rect.height) * 0.34;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    setKnobOffset({ x: dx, y: dy });
    const nx = dx / radius;
    const ny = dy / radius;
    const dead = 0.16;
    onMoveVector(Math.abs(nx) < dead ? 0 : nx, Math.abs(ny) < dead ? 0 : ny);
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onMoveVector(0, 0);
  };

  const releaseThrust = useCallback(() => {
    setThrustActive(false);
    onThrustChange(false);
  }, [onThrustChange]);

  const releaseDrill = useCallback(() => {
    setDrillActive(false);
    onDrillChange(false);
  }, [onDrillChange]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex max-w-full items-end justify-between gap-2 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] sm:px-4">
      {/* Thumbstick */}
      <div
        ref={stickRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          activePointerId.current = e.pointerId;
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activePointerId.current !== e.pointerId) return;
          e.stopPropagation();
          updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          resetStick();
        }}
        onPointerCancel={() => resetStick()}
        onLostPointerCapture={() => resetStick()}
        onContextMenu={(e) => e.preventDefault()}
        className="pointer-events-auto relative flex h-24 w-24 shrink-0 touch-none items-center justify-center border-4 border-[#09070d] bg-[#1b1724]/85 shadow-[inset_3px_3px_0_#362e47,0_4px_0_#09070d] sm:h-28 sm:w-28"
        style={{ touchAction: 'none' }}
        role="application"
        aria-label="Movement thumbstick"
      >
        <span className="font-pixel pointer-events-none absolute top-1 text-[8px] text-[#94a3b8]">▲</span>
        <span className="font-pixel pointer-events-none absolute bottom-1 text-[8px] text-[#94a3b8]">▼</span>
        <span className="font-pixel pointer-events-none absolute left-1.5 text-[8px] text-[#94a3b8]">◀</span>
        <span className="font-pixel pointer-events-none absolute right-1.5 text-[8px] text-[#94a3b8]">▶</span>
        <div className="pointer-events-none absolute inset-2 border border-[#fde047]/25" />
        <div
          className="pointer-events-none h-10 w-10 border-3 border-[#09070d] bg-[#eab308] shadow-[inset_2px_2px_0_#fef08a,inset_-2px_-2px_0_#a16207] sm:h-11 sm:w-11"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            transition: activePointerId.current === null ? 'transform 120ms ease-out' : 'none',
          }}
        />
      </div>

      {/* Actions */}
      <div className="pointer-events-auto flex min-w-0 flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          {(
            [
              { key: 'bomb', icon: <PixelBombIcon className="h-4 w-4 sm:h-5 sm:w-5" />, bg: 'bg-[#2b1d24]', fg: 'text-[#fca5a5]' },
              { key: 'torch', icon: <PixelTorchIcon className="h-4 w-4 sm:h-5 sm:w-5" />, bg: 'bg-[#292418]', fg: 'text-[#fef08a]' },
              { key: 'recall', icon: <PixelWarpIcon className="h-4 w-4 sm:h-5 sm:w-5" />, bg: 'bg-[#182636]', fg: 'text-[#bae6fd]' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                buzz(6);
                onUseConsumable(item.key);
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`pixel-btn relative flex h-10 w-10 touch-none flex-col items-center justify-center ${item.bg} sm:h-11 sm:w-11`}
              aria-label={item.key}
            >
              {item.icon}
              <span className={`font-pixel absolute -bottom-0.5 text-[7px] ${item.fg}`}>{consumables[item.key]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-end gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              buzz(8);
              setThrustActive(true);
              onThrustChange(true);
            }}
            onPointerUp={releaseThrust}
            onPointerCancel={releaseThrust}
            onLostPointerCapture={releaseThrust}
            onPointerLeave={releaseThrust}
            onContextMenu={(e) => e.preventDefault()}
            className={`pixel-btn flex h-14 w-14 touch-none flex-col items-center justify-center sm:h-16 sm:w-16 ${
              thrustActive ? 'translate-y-0.5 bg-[#0284c7]' : 'bg-[#0369a1]/95'
            }`}
            aria-label="Jetpack thrust"
          >
            <span className="font-pixel text-sm text-[#e0f2fe]">▲</span>
            <span className="font-pixel mt-0.5 text-[7px] text-[#bae6fd]">FLY</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              buzz(10);
              setDrillActive(true);
              onDrillChange(true);
            }}
            onPointerUp={releaseDrill}
            onPointerCancel={releaseDrill}
            onLostPointerCapture={releaseDrill}
            onPointerLeave={releaseDrill}
            onContextMenu={(e) => e.preventDefault()}
            className={`pixel-btn flex h-16 w-16 touch-none flex-col items-center justify-center sm:h-[72px] sm:w-[72px] ${
              drillActive ? 'translate-y-0.5 bg-[#eab308]' : 'bg-[#d97706]/95'
            }`}
            aria-label="Drill"
          >
            <span className="font-pixel text-base text-[#09070d]">⛏</span>
            <span className="font-pixel mt-0.5 text-[7px] text-[#09070d]">DRILL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
