import { useCallback, useEffect, useRef, useState } from 'react';
import { CS_H, CS_W, CUTSCENE, prepareScene } from '../game/cutscene';
import { sound } from '../game/sound';
import {
  PixelPauseIcon,
  PixelPlayIcon,
  PixelReplayIcon,
  PixelSkipIcon,
} from './PixelIcons';
import { Portrait } from './DialogueBox';

interface CutsceneProps {
  onFinish: () => void;
}

const LETTER_RATE = 46;
const DISSOLVE = 0.55;
const STORY_LENGTH = CUTSCENE.reduce((sum, scene) => sum + scene.duration, 0);
const SCENE_STARTS = CUTSCENE.map((_, index) =>
  CUTSCENE.slice(0, index).reduce((sum, scene) => sum + scene.duration, 0)
);

const CUES: Record<string, Array<{ at: number; play: () => void }>> = {
  'sky-city': [{ at: 0.1, play: () => sound.playWhoosh(1.2) }],
  birth: [{ at: 1.8, play: () => sound.playUpgrade() }],
  'cast-out': [{ at: 3.8, play: () => sound.playWhoosh(0.7) }],
  'free-fall': [{ at: 0.3, play: () => sound.playWhoosh(1.3) }],
  impact: [{ at: 0.87, play: () => sound.playExplosion() }],
  'old-mine': [{ at: 0.3, play: () => sound.playWhoosh(1.0) }],
  'self-repair': [
    { at: 1.2, play: () => sound.playTorch() },
    { at: 5.2, play: () => sound.playUpgrade() },
  ],
  survivors: [{ at: 4.7, play: () => sound.playOreCollect(120) }],
  'the-deal': [{ at: 3, play: () => sound.playUpgrade() }],
  'first-shift': [{ at: 0.7, play: () => sound.playWhoosh(1.0) }],
};

const grainFrames: HTMLCanvasElement[] = [];
function grain(index: number): HTMLCanvasElement {
  const frame = Math.floor(index) % 3;
  if (grainFrames[frame]) return grainFrames[frame];
  const canvas = document.createElement('canvas');
  canvas.width = CS_W;
  canvas.height = CS_H;
  const g = canvas.getContext('2d')!;
  // Built only once per frame variant, never allocated on the render path.
  let seed = frame * 12421 + 32517;
  for (let i = 0; i < 240; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const x = (seed >>> 0) % CS_W;
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const y = (seed >>> 0) % CS_H;
    g.fillStyle = i % 5 === 0 ? '#fff4cd' : '#b0acb2';
    g.fillRect(x, y, 1, 1);
  }
  grainFrames[frame] = canvas;
  return canvas;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export function Cutscene({ onFinish }: CutsceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef(0);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const revealedRef = useRef(false);
  const paintedCharsRef = useRef(0);
  const firedCues = useRef(new Set<number>());
  const finishedRef = useRef(false);
  const pausedRef = useRef(false);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const lastUiUpdateRef = useRef(0);
  const preloadedRef = useRef(-1);

  const [sceneIndex, setSceneIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  pausedRef.current = paused;

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  }, [onFinish]);

  const seek = useCallback((next: number, interactive = true) => {
    if (next >= CUTSCENE.length) {
      finish();
      return;
    }
    const target = Math.max(0, next);
    sceneRef.current = target;
    timeRef.current = 0;
    revealedRef.current = false;
    paintedCharsRef.current = 0;
    firedCues.current.clear();
    setSceneIndex(target);
    setCharCount(0);
    setSeconds(SCENE_STARTS[target]);
    setPaused(false);
    if (interactive) sound.playUiTick();
    prepareScene(target);
  }, [finish]);

  const advance = useCallback(() => {
    if (pausedRef.current) {
      setPaused(false);
      return;
    }
    const scene = CUTSCENE[sceneRef.current];
    const typed = Math.max(0, Math.floor((timeRef.current - 0.28) * LETTER_RATE));
    if (!revealedRef.current && typed < scene.text.length) {
      revealedRef.current = true;
      paintedCharsRef.current = scene.text.length;
      setCharCount(scene.text.length);
      sound.playUiTick();
    } else {
      seek(sceneRef.current + 1);
    }
  }, [seek]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CS_W;
    canvas.height = CS_H;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    const screen: CanvasRenderingContext2D = context;
    screen.imageSmoothingEnabled = false;

    const currentLayer = document.createElement('canvas');
    currentLayer.width = CS_W;
    currentLayer.height = CS_H;
    const sceneCtx = currentLayer.getContext('2d')!;
    sceneCtx.imageSmoothingEnabled = false;

    const previousLayer = document.createElement('canvas');
    previousLayer.width = CS_W;
    previousLayer.height = CS_H;
    const previousCtx = previousLayer.getContext('2d')!;
    previousCtx.imageSmoothingEnabled = false;

    let raf = 0;
    finishedRef.current = false;
    prepareScene(0);

    function render(now: number) {
      const elapsed = lastFrameRef.current ? Math.min(0.07, (now - lastFrameRef.current) / 1000) : 0;
      lastFrameRef.current = now;
      if (!pausedRef.current && !finishedRef.current) timeRef.current += elapsed;

      const index = sceneRef.current;
      const scene = CUTSCENE[index];
      const time = timeRef.current;

      if (!pausedRef.current) {
        sceneCtx.clearRect(0, 0, CS_W, CS_H);
        sceneCtx.save();
        scene.draw(sceneCtx, Math.min(time, scene.duration), scene.duration);
        sceneCtx.restore();

        // Dissolve between complete rendered frames. The two scenes cannot change
        // the alpha of the final composite accidentally.
        if (index > 0 && time < DISSOLVE) {
          previousCtx.clearRect(0, 0, CS_W, CS_H);
          const previous = CUTSCENE[index - 1];
          previousCtx.save();
          previous.draw(previousCtx, previous.duration - DISSOLVE + time, previous.duration);
          previousCtx.restore();
          screen.drawImage(previousLayer, 0, 0);
          screen.globalAlpha = easeCubic(time / DISSOLVE);
          screen.drawImage(currentLayer, 0, 0);
          screen.globalAlpha = 1;
        } else {
          screen.drawImage(currentLayer, 0, 0);
        }

        screen.globalAlpha = 0.12;
        screen.drawImage(grain(Math.floor(now / 85)), 0, 0);
        screen.globalAlpha = 1;

        const chars = revealedRef.current
          ? scene.text.length
          : Math.min(scene.text.length, Math.max(0, Math.floor((time - 0.28) * LETTER_RATE)));
        if (chars !== paintedCharsRef.current) {
          paintedCharsRef.current = chars;
          setCharCount(chars);
        }
        const globalTime = SCENE_STARTS[index] + time;
        // Text clock updates five times a second; the art and bar stay at RAF speed.
        if (now - lastUiUpdateRef.current > 200) {
          lastUiUpdateRef.current = now;
          setSeconds(Math.min(STORY_LENGTH, globalTime));
        }
        if (progressRef.current) {
          progressRef.current.style.width = `${Math.min(100, (globalTime / STORY_LENGTH) * 100)}%`;
        }

        for (const [cueIndex, cue] of (CUES[scene.id] || []).entries()) {
          if (time >= cue.at && !firedCues.current.has(cueIndex)) {
            cue.play();
            firedCues.current.add(cueIndex);
          }
        }
        if (time >= scene.duration + (index === CUTSCENE.length - 1 ? 1.2 : 0)) {
          seek(index + 1, false);
        }
        if (index + 1 < CUTSCENE.length && preloadedRef.current !== index) {
          preloadedRef.current = index;
          // Warm only the next static set, not every large canvas at startup.
          window.setTimeout(() => {
            if (!finishedRef.current) prepareScene(index + 1);
          }, 100);
        }
      }
      if (!finishedRef.current) raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      finishedRef.current = true;
    };
  }, [seek]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        finish();
      } else if (event.code === 'Space' || event.code === 'Enter' || event.code === 'ArrowRight') {
        event.preventDefault();
        advance();
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        seek(sceneRef.current - 1);
      } else if (event.code === 'KeyP') {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [advance, finish, seek]);

  const scene = CUTSCENE[sceneIndex];
  const complete = charCount >= scene.text.length;
  const speaker = scene.speaker ?? 'cube';

  return (
    <div className="cinematic-shell fixed inset-0 z-[60] grid select-none overflow-hidden bg-[#090a11] text-[#f5eedc]">
      <header className="cinematic-top flex min-w-0 items-center justify-between gap-2 px-3 pt-[max(0.4rem,env(safe-area-inset-top))] pb-1 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-pixel shrink-0 text-[9px] text-[#d8a96a] sm:text-[10px]">SC / 07</span>
          <span className="h-3 w-px shrink-0 bg-[#615164]" />
          <div key={scene.id} className="animate-chapter min-w-0 truncate font-pixel text-[9px] tracking-[0.11em] text-[#f6d7a0] sm:text-[11px]">
            {scene.chapter}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <span className="font-retro hidden pr-2 text-base tabular-nums text-[#a9a2ac] sm:inline">
            {formatTime(seconds)} / {formatTime(STORY_LENGTH)}
          </span>
          <button
            type="button"
            className="cinematic-control"
            aria-label={paused ? 'Play story' : 'Pause story'}
            title={paused ? 'Play (P)' : 'Pause (P)'}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <PixelPlayIcon /> : <PixelPauseIcon />}
          </button>
          <button type="button" className="cinematic-control" aria-label="Restart story" title="Restart story" onClick={() => seek(0)}>
            <PixelReplayIcon />
          </button>
          <button type="button" className="cinematic-control cinematic-skip" aria-label="Skip story" title="Skip story" onClick={finish}>
            <PixelSkipIcon />
            <span className="hidden font-pixel text-[8px] sm:inline">SKIP</span>
          </button>
        </div>
      </header>

      <main className="relative flex min-h-0 items-center justify-center px-1 sm:px-4">
        <div className="cinematic-stage relative w-full overflow-hidden bg-[#15121c]">
          <canvas
            ref={canvasRef}
            className="pixelated block h-full w-full cursor-pointer touch-manipulation"
            onPointerDown={(event) => {
              event.preventDefault();
              advance();
            }}
            aria-label="Story scene. Tap to advance narration."
          />
          {paused && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#08070c]/55">
              <span className="font-pixel text-xs tracking-[0.16em] text-[#ffe1a8]">STORY PAUSED</span>
            </div>
          )}
        </div>
      </main>

      <footer className="cinematic-bottom shrink-0 px-2.5 pt-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] sm:px-5">
        <div className="mx-auto w-full max-w-[920px]">
          <div className="relative h-1 bg-[#27232d]">
            <div ref={progressRef} className="absolute inset-y-0 left-0 bg-[#f1be76]" />
          </div>
          <div className="mt-1 flex gap-1">
            {CUTSCENE.map((chapter, index) => (
              <button
                key={chapter.id}
                type="button"
                title={chapter.chapter}
                aria-label={`Go to chapter ${index + 1}: ${chapter.chapter}`}
                aria-current={index === sceneIndex ? 'step' : undefined}
                onClick={() => seek(index)}
                className={`cinematic-chapter h-6 flex-1 border-t-2 ${index === sceneIndex ? 'border-[#ffdc9a]' : index < sceneIndex ? 'border-[#7e5c43]' : 'border-[#34303a]'}`}
              />
            ))}
          </div>
          <div className="mt-1 flex min-h-[78px] items-center gap-2.5 sm:gap-4">
            {scene.speaker && (
              <div className="shrink-0 border-2 border-[#514151]">
                <Portrait speaker={speaker} talking={!complete} size={40} />
              </div>
            )}
            <div className="min-w-0 flex-1 self-center">
              <div className="font-pixel text-[8px] tracking-wider text-[#e4aa72] sm:text-[9px]">
                {scene.speaker ? scene.speaker.toUpperCase() : 'ARCHIVE TRANSMISSION'}
              </div>
              <p className="font-retro mt-1 text-[17px] leading-[1.08] text-[#eee3d2] sm:text-[22px]">
                {scene.text.slice(0, charCount)}
                {!complete && <span className="cinematic-cursor ml-0.5 inline-block h-3 w-1.5 bg-[#eac27f]" />}
              </p>
            </div>
            <button type="button" onClick={advance} className="cinematic-next shrink-0" aria-label={complete ? 'Next scene' : 'Show complete caption'}>
              <PixelPlayIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{sceneIndex === CUTSCENE.length - 1 && complete ? 'BEGIN' : 'NEXT'}</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function easeCubic(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
