import React, { useEffect, useRef, useState } from 'react';
import { CHARACTERS, SpeakerId, drawCubeMiner } from '../game/characters';
import { heroHuman } from '../game/cutsceneArt';
import { DialogueLine } from '../game/types';

/** Live animated pixel portrait for any speaker. */
export const Portrait: React.FC<{ speaker: SpeakerId; talking?: boolean; size?: number }> = ({
  speaker,
  talking = false,
  size = 56,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const talkingRef = useRef(talking);
  talkingRef.current = talking;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = 40;
    c.height = 40;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const info = CHARACTERS[speaker];
    let raf = 0;
    const start = performance.now();
    let lastPaint = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - lastPaint < 1000 / 30) return;
      lastPaint = now;
      const t = (now - start) / 1000;
      ctx.fillStyle = '#2b2635';
      ctx.fillRect(0, 0, 40, 40);
      ctx.fillStyle = '#1a1726';
      ctx.fillRect(0, 26, 40, 14);
      ctx.fillStyle = `${info.accent}55`;
      ctx.fillRect(0, 38, 40, 2);

      if (speaker === 'cube') {
        drawCubeMiner(ctx, {
          x: 20,
          y: 22,
          facing: 'right',
          aimAngle: 0.9,
          drillSpin: (t * 0.5) % 1,
          drillExtend: 0,
          thrustPower: 0,
          isDrilling: false,
          drillTier: 1,
          armorTier: 1,
          cargoFill: 0,
          treadPhase: 0,
          bob: Math.sin(t * 2.4),
          squashX: 1,
          squashY: 1,
          time: t,
          invuln: false,
          scale: 1.42,
          idleTime: 2 + t,
          eyeOverride: talkingRef.current ? { dx: 0, dy: Math.sin(t * 12) > 0 ? 0 : -1 } : null,
        });
      } else if (info.look) {
        heroHuman(ctx, {
          x: 19, y: 45, s: info.look.small ? 1.2 : 1.34,
          t, look: info.look, pose: 'idle', facing: 1, talking: talkingRef.current,
          flipProp: talkingRef.current && speaker === 'gus' ? 'wrench' : null,
        });
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [speaker]);

  return (
    <canvas
      ref={ref}
      className="pixelated shrink-0 border-3 border-[#09070d]"
      style={{ width: size, height: size, boxShadow: `inset 0 0 0 2px ${CHARACTERS[speaker].accent}55` }}
    />
  );
};

interface DialogueBoxProps {
  line: DialogueLine;
  bottomOffset: number;
  maxWidth?: string;
  onDismiss: () => void;
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({ line, bottomOffset, maxWidth, onDismiss }) => {
  const [chars, setChars] = useState(0);
  const info = CHARACTERS[line.speaker];

  useEffect(() => {
    setChars(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const n = Math.min(line.text.length, Math.floor(((now - start) / 1000) * 48));
      setChars(n);
      if (n < line.text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [line.id, line.text]);

  const done = chars >= line.text.length;

  return (
    <div
      key={line.id}
      data-dialogue-box="root"
      className="animate-dialogue pointer-events-auto fixed inset-x-2 z-20 mx-auto w-auto max-w-[540px]"
      style={{ bottom: bottomOffset, ...(maxWidth ? { maxWidth } : {}) }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (done) onDismiss();
        else setChars(line.text.length);
      }}
    >
      <div className="pixel-panel flex min-w-0 items-start gap-2 p-2 sm:p-2.5">
        <div className="shrink-0"><Portrait speaker={line.speaker} talking={!done} size={44} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-pixel text-[9px] sm:text-[10px]" style={{ color: info.accent }}>
              {info.name}
            </span>
            <span className="font-retro hidden text-sm leading-none text-[#6f6880] sm:inline">{info.role}</span>
          </div>
          <p className="pixel-scroll font-retro mt-0.5 max-h-[5.2em] overflow-y-auto text-base leading-snug text-[#f5eedc] sm:text-lg">
            {line.text.slice(0, chars)}
            {!done && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-[#fde047]" />}
          </p>
        </div>
        <span className={`font-pixel self-end text-[8px] text-[#6f6880] transition-opacity ${done ? 'opacity-100' : 'opacity-0'}`}>
          ✕
        </span>
      </div>
    </div>
  );
};
