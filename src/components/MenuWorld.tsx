import { useEffect, useRef } from 'react';
import { hash, heroRobot, mix } from '../game/cutsceneArt';
import { makeCanvas } from '../game/cineKit';
import { drawBuilding } from '../game/outpostArt';
import { isLite } from '../game/quality';
import { pumpWarm, warmComplete } from '../game/cineKit';
import { prepareScene } from '../game/cutscene';
import { ellipse, pixelGlow, pixelLine, polygon, px } from '../game/pixelCraft';

const W = 640, H = 360, SURFACE = 180;
let backdrop: HTMLCanvasElement | null = null;

function getBackdrop() {
  if (backdrop) return backdrop;
  const [c, g] = makeCanvas(W, H);
  // dusk sky
  for (let y = 0; y < SURFACE; y++) {
    const k = y / SURFACE;
    px(g, 0, y, W, 1, mix('#101a2c', '#c46a4c', k * k));
  }
  pixelGlow(g, 520, 120, 120, '#ffb27a', 0.35);
  ellipse(g, 520, 128, 16, 16, '#ffe0b0');
  // distant floating city silhouette
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 66, h = 20 + hash(i) * 40;
    px(g, x, 96 - h, 18 + hash(i * 3) * 14, h, '#2a3446');
    px(g, x + 4, 96 - h - 8, 2, 8, '#3f4c60');
  }
  px(g, 20, 96, 600, 4, '#1d2738');
  // surface crust
  px(g, 0, SURFACE, W, 8, '#6a4a34');
  px(g, 0, SURFACE, W, 2, '#a3744e');
  // underground strata
  const bands: Array<[number, number, string, string]> = [
    [188, 50, '#4a3324', '#5c4030'], [238, 50, '#5a5344', '#6b6352'], [288, 72, '#3a3242', '#4a4054'],
  ];
  for (const [y, h, a, b] of bands) {
    for (let yy = 0; yy < h; yy += 2) for (let x = 0; x < W; x += 2) {
      const n = hash(x * 1.7 + yy * 3.1 + y);
      px(g, x, y + yy, 2, 2, n > 0.6 ? b : a);
    }
  }
  // shaft hole
  px(g, 312, SURFACE, 80, H - SURFACE, '#0a0c12');
  for (const x of [316, 388]) { px(g, x, SURFACE, 2, H - SURFACE, '#3a4a54'); }
  for (let y = SURFACE + 20; y < H; y += 40) px(g, 312, y, 80, 3, '#2a1f17');
  // ore veins
  const ores = ['#d97236', '#e6d825', '#a89f99', '#25c96e', '#e0284f', '#3085ff'];
  for (let i = 0; i < 40; i++) {
    const x = hash(i * 7.3) * W, y = 200 + hash(i * 2.9) * 150;
    if (x > 300 && x < 400) continue;
    const c = ores[i % ores.length];
    px(g, x, y, 3, 3, c); px(g, x + 3, y + 2, 2, 2, c); px(g, x - 2, y + 3, 2, 2, c);
  }
  // rich vein beside the rig
  for (let i = 0; i < 12; i++) { px(g, 396 + (i % 3) * 5, 252 + i * 4, 4, 4, i % 2 ? '#e6d825' : '#f2b718'); }
  backdrop = c;
  return c;
}

export function MenuWorld({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const bg = getBackdrop();
    let raf = 0, last = 0, running = true;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Pre-build the story's environments while the player reads the menu.
    prepareScene(0);
    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (document.visibilityState === 'hidden') return;
      if (!warmComplete()) pumpWarm(6);
      const interval = reduced ? 120 : isLite() ? 50 : 33;
      if (now - last < interval) return;
      last = now;
      const t = now / 1000;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.drawImage(bg, 0, 0);
      drawBuilding(g, 'refinery', 70, SURFACE, t, { id: 'menu-refinery', lite: true });
      drawBuilding(g, 'shaft', 280, SURFACE, t, { id: 'menu-shaft', lite: true });
      drawBuilding(g, 'habitat', 450, SURFACE, t, { id: 'menu-habitat', door: 0.85, lite: true });
      // rig mining in the shaft
      const rigX = 350, rigY = 272;
      heroRobot(g, { x: rigX, y: rigY, s: 2.2, t, state: 'working', drill: true, drillAngle: 0.15, drillExtend: 0.7, drillSpin: t * 3, look: 1, eye: 'scan', paintMix: 1, wheelPhase: t * 0.2 });
      pixelGlow(g, rigX + 24, rigY - 4, 26, '#ffe6a8', 0.35);
      for (let i = 0; i < (isLite() ? 4 : 8); i++) {
        const life = (t * 1.8 + i / 8) % 1;
        px(g, 392 - life * 26, 268 - Math.sin(life * Math.PI) * 14 + life * life * 20, 2, 2, i % 2 ? '#e6d825' : '#fff1b0');
      }
      // drifting dust
      for (let i = 0; i < (isLite() ? 8 : 16); i++) {
        const x = (hash(i) * W + t * 6) % W, y = 190 + hash(i * 3) * 160;
        g.globalAlpha = 0.25 + 0.25 * Math.sin(t + i);
        px(g, x, y, 1, 1, '#fff0bb');
      }
      g.globalAlpha = 1;
      // headframe cable down to the rig level
      pixelLine(g, [352, SURFACE - 120], [352, rigY - 30], '#2a2e33');
      polygon(g, [[0, H - 24], [W, H - 24], [W, H], [0, H]], 'rgba(8,10,16,0.55)');
    };
    raf = requestAnimationFrame(frame);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} className={`pixelated block h-full w-full ${className}`} aria-label="Live pixel-art preview of the outpost and mine shaft" />;
}
