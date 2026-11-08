const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.TEST_URL || 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto(base);
  const result = await page.evaluate(async () => {
    const { CUTSCENE, prepareScene } = await import('/src/game/cutscene.ts');
    const { setQuality } = await import('/src/game/quality.ts');
    const { pumpWarm, warmComplete } = await import('/src/game/cineKit.ts');
    // Time finished artwork, not the lightweight placeholders used during streaming.
    prepareScene(0);
    while (!warmComplete()) pumpWarm(30);
    const all = {};
    for (const mode of ['hd', 'lite']) {
      setQuality(mode, false);
      const scale = mode === 'lite' ? 0.4 : 1;
      const canvas = document.createElement('canvas');
      canvas.width = 640 * scale;
      canvas.height = 360 * scale;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const samples = [];
      for (let i = 0; i < CUTSCENE.length; i++) {
        prepareScene(i);
        const scene = CUTSCENE[i];
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        for (let warm = 0; warm < 3; warm++) scene.draw(ctx, scene.duration * 0.5, scene.duration);
        const frames = 45;
        const start = performance.now();
        for (let f = 0; f < frames; f++) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          scene.draw(ctx, scene.duration * (f / frames), scene.duration);
        }
        samples.push((performance.now() - start) / frames);
      }
      all[mode] = samples;
    }
    return all;
  });
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const hd = mean(result.hd), lite = mean(result.lite);
  const hdMsPerSecond = hd * 60;
  const liteMsPerSecond = lite * 18;
  const rasterRatio = (640 * 360 * 60) / (256 * 144 * 18);
  console.log(`Mean scene draw: HD ${hd.toFixed(2)} ms/frame; Lite ${lite.toFixed(2)} ms/frame.`);
  console.log(`Estimated main-thread draw budget: ${hdMsPerSecond.toFixed(1)} ms/s HD; ${liteMsPerSecond.toFixed(1)} ms/s Lite.`);
  console.log(`Estimated draw-time improvement: ${(hdMsPerSecond / liteMsPerSecond).toFixed(1)}x; raster-pixel budget: ${rasterRatio.toFixed(1)}x lower in Lite.`);
} finally {
  await browser.close();
}