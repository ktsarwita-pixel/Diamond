import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CHARACTERS } from '../game/characters';
import { SpeakerId } from '../game/types';
import { Portrait } from './DialogueBox';

interface NpcBubbleProps {
  speaker: SpeakerId;
  text: string;
  /** Screen-space anchor in CSS pixels for the speaker's head. */
  x: number;
  y: number;
  onNextLine?: () => void;
  onDismiss?: () => void;
}

const EDGE = 8;

/**
 * NPC chatter rendered as a responsive DOM overlay.
 * Uses explicit left-edge positioning (`leftEdge` in [EDGE, vw - boxW - EDGE])
 * so it can never clip off the left or right screen edges on any mobile viewport.
 */
export const NpcBubble: React.FC<NpcBubbleProps> = ({
  speaker,
  text,
  x,
  y,
  onNextLine,
  onDismiss,
}) => {
  const info = CHARACTERS[speaker];
  const [chars, setChars] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef(performance.now());

  const computePos = (anchorX: number, anchorY: number) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
    const boxW = Math.min(296, Math.max(196, vw - EDGE * 2));
    const leftEdge = Math.max(EDGE, Math.min(vw - boxW - EDGE, Math.round(anchorX - boxW / 2)));
    const top = Math.max(154, Math.min(vh - 96, Math.round(anchorY - 10)));
    const tailX = Math.max(18, Math.min(boxW - 18, Math.round(anchorX - leftEdge)));
    return { leftEdge, top, tailX, boxW };
  };

  const [pos, setPos] = useState(() => computePos(x, y));

  useEffect(() => {
    startRef.current = performance.now();
    setChars(0);
    setDismissed(false);
    let raf = 0;
    const tick = (now: number) => {
      const n = Math.min(text.length, Math.floor(((now - startRef.current) / 1000) * 54));
      setChars(n);
      if (n < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, speaker]);

  useLayoutEffect(() => {
    const update = () => {
      const next = computePos(x, y);
      setPos((prev) =>
        Math.abs(prev.leftEdge - next.leftEdge) < 1 &&
        Math.abs(prev.top - next.top) < 1 &&
        Math.abs(prev.tailX - next.tailX) < 1 &&
        prev.boxW === next.boxW
          ? prev
          : next
      );
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [x, y]);

  if (dismissed) return null;
  const done = chars >= text.length;

  const handleClose = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setDismissed(true);
    onDismiss?.();
  };

  const handleTapBubble = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (!done) {
      setChars(text.length);
    } else if (onNextLine) {
      onNextLine();
    } else {
      handleClose(e);
    }
  };

  return (
    <div
      data-npc-bubble="root"
      className="pointer-events-auto fixed z-30"
      style={{
        left: `${pos.leftEdge}px`,
        top: `${pos.top}px`,
        width: `${pos.boxW}px`,
        transform: 'translateY(-100%)',
      }}
    >
      <div
        ref={boxRef}
        className="animate-npc-bubble pixel-panel relative flex cursor-pointer items-start gap-2 p-2"
        onClick={handleTapBubble}
      >
        <div className="shrink-0">
          <Portrait speaker={speaker} talking={!done} size={36} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-pixel text-[8px] leading-none" style={{ color: info.accent }}>
              {info.name}
            </span>
            <span className="font-retro text-xs leading-none text-[#8b8496]">
              {info.role}
            </span>
          </div>
          <p className="font-retro mt-1 break-words text-[15px] leading-[1.15] text-[#f5eedc] sm:text-base">
            {text.slice(0, chars)}
            {!done && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-[#fde047]" />}
          </p>
          {done && onNextLine && (
            <div className="font-pixel mt-1 text-[7px] text-[#7dd3fc]">TAP FOR MORE ▸</div>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss NPC chat"
          onClick={handleClose}
          className="pixel-btn flex h-7 w-7 shrink-0 items-center justify-center bg-[#2a2438] font-pixel text-[9px] text-[#e2dcb8]"
        >
          ✕
        </button>
      </div>
      {/* Speech tail pointing toward the speaker's head */}
      <div
        className="pointer-events-none absolute h-0 w-0"
        style={{
          left: `${pos.tailX - 6}px`,
          top: '100%',
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '8px solid #f5eedc',
          filter: 'drop-shadow(0 2px 0 #09070d)',
        }}
      />
    </div>
  );
};
