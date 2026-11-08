/* ================================================================== *
 *  STORY QUALITY — "HD" (full) vs "LITE" (fast) cinematic rendering.
 *  Scenes read these helpers to trim particle counts and skip costly
 *  full-screen effects (heat refraction, soft-light grading, grain).
 * ================================================================== */
const KEY = 'sulfured_story_quality';

export type StoryQuality = 'hd' | 'lite';

function detectDefault(): StoryQuality {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'hd' || saved === 'lite') return saved;
  } catch {
    /* storage unavailable */
  }
  if (typeof navigator === 'undefined') return 'hd';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  return cores <= 4 || memory <= 4 || (coarse && cores <= 6) ? 'lite' : 'hd';
}

let current: StoryQuality = detectDefault();
let explicitPreference = (() => {
  try { return localStorage.getItem(KEY) === 'hd' || localStorage.getItem(KEY) === 'lite'; }
  catch { return false; }
})();
export const hasQualityPreference = () => explicitPreference;
const listeners = new Set<(q: StoryQuality) => void>();

export const isLite = () => current === 'lite';
export const getQuality = () => current;
export function setQuality(q: StoryQuality, persist = true) {
  if (q !== 'hd' && q !== 'lite') q = 'hd';
  if (q === current) return;
  current = q;
  if (persist) {
    explicitPreference = true;
    try {
      localStorage.setItem(KEY, q);
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((fn) => fn(q));
}
export function onQualityChange(fn: (q: StoryQuality) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
/** Scale a particle/iteration count down in lite mode. */
export const qn = (n: number, liteFactor = 0.25) => (current === 'lite' ? Math.max(1, Math.round(n * liteFactor)) : n);
