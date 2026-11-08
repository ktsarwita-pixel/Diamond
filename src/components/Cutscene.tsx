import { useCallback, useEffect, useRef, useState } from 'react';
import { CS_H, CS_W, CUTSCENE, prepareScene } from '../game/cutscene';
import { sound } from '../game/sound';
import { pumpWarm, warmComplete } from '../game/cineKit';
import { getQuality, hasQualityPreference, isLite, onQualityChange, setQuality, type StoryQuality } from '../game/quality';
import {
  PixelPauseIcon,
  PixelPlayIcon,
  PixelReplayIcon,
  PixelSkipIcon,
} from './PixelIcons';
import { Portrait } from './DialogueBox';
import { storyFontsReady } from '../game/storyFonts';

interface CutsceneProps {
  onFinish: () => void;
}

const LETTER_RATE = 46;
const DISSOLVE = 0.55;
const LITE_FRAME_MS = 1000 / 18;
const STORY_LENGTH = CUTSCENE.reduce((sum, scene) => sum + scene.duration, 0);
const SCENE_STARTS = CUTSCENE.map((_, index) =>
  CUTSCENE.slice(0, index).reduce((sum, scene) => sum + scene.duration, 0)
);

const CUES: Record<string, Array<{ at: number; play: () => void }>> = {
  'sky-city': [{ at: 0.1, play: () => sound.playWhoosh(1.2) }],
  birth: [{ at: 1.8, play: () => sound.playUpgrade() }],
  outdated: [{ at: 6.6, play: () => sound.playWhoosh(0.6) }],
  'cast-out': [
    { at: 1.5, play: () => sound.playWhoosh(0.4) },
    { at: 3.3, play: () => sound.playHurt() },
    { at: 7.95, play: () => sound.playWhoosh(0.9) },
  ],
  'free-fall': [{ at: 0.3, play: () => sound.playWhoosh(1.3) }],
  impact: [{ at: 0.87, play: () => sound.playExplosion() }],
  'old-mine': [{ at: 0.3, play: () => sound.playWhoosh(1.0) }],
  'self-repair': [
    { at: 1.1, play: () => sound.playTorch() },
    { at: 3.3, play: () => sound.playTorch() },
    { at: 5.45, play: () => sound.playTorch() },
    { at: 7.5, play: () => sound.playTorch() },
    { at: 8.8, play: () => sound.playUpgrade() },
  ],
  survivors: [{ at: 4.7, play: () => sound.playOreCollect(120) }],
  'the-deal': [
    { at: 3.6, play: () => sound.playUpgrade() },
    { at: 5.35, play: () => sound.playOreCollect(90) },
  ],
  'first-shift': [{ at: 0.7, play: () => sound.playWhoosh(1.0) }],
  'sulfured-caves': [
    { at: 2.6, play: () => sound.playWhoosh(0.5) },
    { at: 11.4, play: () => sound.playOreCollect(90) },
    { at: 14.6, play: () => sound.playUpgrade() },
  ],
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
  const captionRef = useRef<HTMLSpanElement | null>(null);
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  const clockRef = useRef<HTMLSpanElement | null>(null);
  // Set by seek() so the very next animation frame repaints, even in Lite mode
  // or while the paint gate is closed. Prevents a stale/blank frame after a
  // rapid skip.
  const needsPaintRef = useRef(true);
  const lastUiUpdateRef = useRef(0);
  const switchedRef = useRef(hasQualityPreference());
  const seekRequestedRef = useRef(false);

  const [sceneIndex, setSceneIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [quality, setQualityState] = useState<StoryQuality>(getQuality());
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => onQualityChange((q) => setQualityState(q)), []);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(id);
  }, [notice]);
  const toggleQuality = useCallback(() => {
    switchedRef.current = true;
    setQuality(isLite() ? 'hd' : 'lite');
    sound.playUiTick();
  }, []);
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
    setPaused(false);
    needsPaintRef.current = true;
    seekRequestedRef.current = true;
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
    let needsPaint = true;
    let lastIndex = -1;
    let hasPrevious = false;
    let paintDebt = LITE_FRAME_MS;
    let layerScale = 1;
    let costAvg = 0;
    let paintedFrames = 0;
    const configureLayerScale = () => {
      const next = isLite() ? 0.4 : 1;
      canvas.dataset.storyScale = next === 0.4 ? '256x144' : '640x360';
      canvas.dataset.storyPixelsPerSecond = next === 0.4 ? "663552" : "13824000";
      if (next === layerScale) return;
      layerScale = next;
      const w = CS_W * layerScale;
      const h = CS_H * layerScale;
      // Lite paints at 256x144 and is nearest-neighbour enlarged on screen.
      currentLayer.width = w;
      currentLayer.height = h;
      previousLayer.width = w;
      previousLayer.height = h;
      sceneCtx.imageSmoothingEnabled = false;
      previousCtx.imageSmoothingEnabled = false;
      sceneCtx.setTransform(layerScale, 0, 0, layerScale, 0, 0);
      previousCtx.setTransform(layerScale, 0, 0, layerScale, 0, 0);
      hasPrevious = false;
      lastIndex = -1;
      needsPaint = true;
      paintDebt = LITE_FRAME_MS;
    };
    screen.imageSmoothingEnabled = false;
    finishedRef.current = false;
    configureLayerScale();
    let disposed = false;
    // Start decoding immediately, but do not paint text into a cached sprite until
    // the actual pixel font is available. StrictMode's cancelled setup is harmless.
    void storyFontsReady().then(() => {
      if (!disposed && !finishedRef.current) prepareScene(sceneRef.current);
    });
    const stopQuality = onQualityChange(() => configureLayerScale());
    const resetClock = () => { lastFrameRef.current = 0; };
    document.addEventListener('visibilitychange', resetClock);

    function render(now: number) {
      const frameStart = performance.now();
      const elapsed = lastFrameRef.current && !document.hidden ? Math.min(0.25, Math.max(0, (now - lastFrameRef.current) / 1000)) : 0;
      lastFrameRef.current = now;
      if (!pausedRef.current && !finishedRef.current) timeRef.current += elapsed;

      const index = sceneRef.current;
      const scene = CUTSCENE[index];
      const time = timeRef.current;
      const lite = isLite();
      // Heavy procedural environments are built a few ms per frame, well ahead of
      // time. Budget adapts: build faster while the current frame is cheap, and
      // only use leftover time when the current scene itself is expensive.
      // (pumped AFTER the scene is painted — see below — so it only uses time
      //  genuinely left over in this frame.)

      // Accumulator cadence: 50/66 ms intervals at a 60 Hz display average 18 fps.
      // A >=56 ms gate accidentally painted only every fourth vsync (15 fps).
      paintDebt += elapsed * 1000;
      const due = !lite || paintDebt >= LITE_FRAME_MS;
      const urgent = needsPaintRef.current;
      if ((!pausedRef.current && due) || needsPaint || urgent) {
        needsPaint = false;
        needsPaintRef.current = false;
        if (lite) paintDebt %= LITE_FRAME_MS;
        if (index !== lastIndex || seekRequestedRef.current) {
          seekRequestedRef.current = false;
          // Freeze the outgoing scene's last frame for the dissolve instead of re-rendering it.
          if (lastIndex >= 0) {
            previousCtx.setTransform(1, 0, 0, 1, 0, 0);
            previousCtx.clearRect(0, 0, CS_W, CS_H);
            previousCtx.drawImage(currentLayer, 0, 0);
            previousCtx.setTransform(layerScale, 0, 0, layerScale, 0, 0);
            hasPrevious = true;
          }
          lastIndex = index;
        }
        const t0 = performance.now();
        sceneCtx.setTransform(1, 0, 0, 1, 0, 0);
        sceneCtx.globalAlpha = 1;
        sceneCtx.globalCompositeOperation = 'source-over';
        sceneCtx.clearRect(0, 0, currentLayer.width, currentLayer.height);
        sceneCtx.setTransform(layerScale, 0, 0, layerScale, 0, 0);
        sceneCtx.save();
        scene.draw(sceneCtx, Math.min(time, scene.duration), scene.duration);
        sceneCtx.restore();
        const cost = performance.now() - t0;

        if (hasPrevious && time < DISSOLVE) {
          screen.drawImage(previousLayer, 0, 0, CS_W, CS_H);
          screen.globalAlpha = easeCubic(time / DISSOLVE);
          screen.drawImage(currentLayer, 0, 0, CS_W, CS_H);
          screen.globalAlpha = 1;
        } else {
          screen.drawImage(currentLayer, 0, 0, CS_W, CS_H);
        }
        if (!lite) {
          screen.globalAlpha = 0.12;
          screen.drawImage(grain(Math.floor(time * 12)), 0, 0);
          screen.globalAlpha = 1;
        }

        // Auto-switch to Lite when HD can't hold ~55 fps (only if the player hasn't chosen).
        if (!pausedRef.current && time > 0.6) {
          paintedFrames++;
          costAvg = paintedFrames === 1 ? cost : costAvg * 0.9 + cost * 0.1;
          if (!lite && !switchedRef.current && paintedFrames > 60 && costAvg > 14) {
            switchedRef.current = true;
            setQuality('lite', false);
            setNotice('LITE MODE ON — smoother playback on this device');
          }
        }

      }
      // Narration and the progress strip stay full-rate even when art is gated.
      // Only actual character changes touch the DOM; React renders just once at
      // the end of the caption, not once per typed letter.
      const chars = revealedRef.current
        ? scene.text.length
        : Math.min(scene.text.length, Math.max(0, Math.floor((time - 0.28) * LETTER_RATE)));
      if (chars !== paintedCharsRef.current) {
        paintedCharsRef.current = chars;
        if (captionRef.current) captionRef.current.textContent = scene.text.slice(0, chars);
        if (cursorRef.current) cursorRef.current.style.display = chars >= scene.text.length ? 'none' : '';
        if (chars >= scene.text.length) setCharCount(chars);
      }
      const globalTime = SCENE_STARTS[index] + Math.min(time, scene.duration);
      if (now - lastUiUpdateRef.current > 250) {
        lastUiUpdateRef.current = now;
        if (clockRef.current) clockRef.current.textContent = `${formatTime(globalTime)} / ${formatTime(STORY_LENGTH)}`;
      }
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${Math.min(1, globalTime / STORY_LENGTH)})`;
      // Background environment builds: on EVERY tick (painted or not) spend only
      // what is genuinely left of a 60 fps frame, minus a compositing margin.
      // Small, frequent slices never push a frame over budget; big rare ones do.
      // Background environment builds. ALWAYS make progress — even on a busy HD
      // frame. Without the floor below, a heavy set (the 1920x960 caldera is
      // ~450 ms of work) can never finish when every frame is over budget, and
      // the scene stays on its placeholder forever ("story won't render").
      if (!document.hidden && !warmComplete()) {
        const left = 16.7 - (performance.now() - frameStart) - 2.5;
        pumpWarm(Math.max(2.5, Math.min(6, left)));
      }
      if (!pausedRef.current && !document.hidden && !finishedRef.current) {
        for (const [cueIndex, cue] of (CUES[scene.id] || []).entries()) {
          if (time >= cue.at && !firedCues.current.has(cueIndex)) {
            cue.play();
            firedCues.current.add(cueIndex);
          }
        }
        if (time >= scene.duration + (index === CUTSCENE.length - 1 ? 1.2 : 0)) {
          seek(index + 1, false);
        }
      }
      if (!finishedRef.current) raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      stopQuality();
      document.removeEventListener('visibilitychange', resetClock);
      finishedRef.current = true;
    };
  }, [seek]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      // Let focused buttons keep their native Enter/Space activation instead of
      // advancing narration underneath a Skip/Restart/chapter button.
      if ((event.code === 'Space' || event.code === 'Enter') && target?.closest('button, a, input, select, textarea')) return;
      if (event.code === 'Escape') {
        event.preventDefault();
        finish();
      } else if (event.code === 'Space' || event.code === 'Enter' || event.code === 'ArrowRight') {
        event.preventDefault();
        advance();
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        seek(sceneRef.current - 1);
      } else if (event.code === 'KeyL') {
        event.preventDefault();
        toggleQuality();
      } else if (event.code === 'KeyP') {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [advance, finish, seek, toggleQuality]);

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
          <span ref={clockRef} className="font-retro hidden pr-2 text-base tabular-nums text-[#a9a2ac] sm:inline">
            {formatTime(SCENE_STARTS[sceneIndex])} / {formatTime(STORY_LENGTH)}
          </span>
          <button
            type="button"
            className={`cinematic-control cinematic-quality ${quality === 'lite' ? 'is-lite' : ''}`}
            aria-label={quality === 'lite' ? 'Lite mode on. Switch to HD quality' : 'HD quality on. Switch to Lite mode'}
            aria-pressed={quality === 'lite'}
            title={quality === 'lite' ? 'Lite mode: 18 fps, fewer effects (L)' : 'HD: full effects (L)'}
            onClick={toggleQuality}
          >
            <span className="font-pixel text-[8px]">{quality === 'lite' ? 'LITE' : 'HD'}</span>
          </button>
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
          {notice && (
            <div role="status" className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 border border-[#5a4751] bg-[#120e16]/90 px-2 py-1 font-pixel text-[7px] text-[#f1d6ac] sm:text-[8px]">
              {notice} · PRESS L FOR HD
            </div>
          )}
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
            <div ref={progressRef} className="absolute inset-0 origin-left bg-[#f1be76]" style={{ transform: 'scaleX(0)' }} />
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
                className={`cinematic-chapter h-7 min-w-0 flex-1 border-t-2 font-pixel text-[7px] ${index === sceneIndex ? 'border-[#ffdc9a] text-[#ffdc9a]' : index < sceneIndex ? 'border-[#7e5c43] text-[#b6a08a]' : 'border-[#34303a] text-[#827986]'}`}
              >
                {(index + 1).toString().padStart(2, '0')}
              </button>
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
                <span ref={captionRef} key={scene.id}>{scene.text.slice(0, charCount)}</span>
                <span ref={cursorRef} className="cinematic-cursor ml-0.5 inline-block h-3 w-1.5 bg-[#eac27f]" style={{ display: complete ? 'none' : '' }} />
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
