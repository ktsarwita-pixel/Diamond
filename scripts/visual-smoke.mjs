import assert from 'node:assert/strict';

// Install Playwright separately, or point PLAYWRIGHT_MODULE at an existing installation.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errors = [];
const base = process.env.TEST_URL || 'http://localhost:5173';

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('button', { name: '▶ STORY', exact: true }).click();
  await page.locator('.cinematic-stage canvas').waitFor();
  await page.getByRole('button', { name: /Go to chapter 12:/ }).click();
  await page.getByRole('button', { name: 'Pause story', exact: true }).click();
  await page.getByText('STORY PAUSED', { exact: true }).waitFor();
  const before = await page.locator('.cinematic-stage canvas').evaluate(c => c.toDataURL());
  await page.waitForTimeout(250);
  const after = await page.locator('.cinematic-stage canvas').evaluate(c => c.toDataURL());
  assert.equal(before, after, 'Pause must freeze the rendered scene');
  await page.setViewportSize({ width: 1100, height: 780 });
  await page.waitForTimeout(150);
  const brightness = await page.locator('.cinematic-stage canvas').evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let total = 0;
    for (let i = 0; i < d.length; i += 64) total += d[i] + d[i + 1] + d[i + 2];
    return total;
  });
  assert.ok(brightness > 20000, 'Resizing a paused story must retain its art');
  // HD / LITE toggle: button and keyboard shortcut, persisted choice
  const qBtn = page.getByRole('button', { name: /Switch to (HD quality|Lite mode)/ });
  const before1 = await qBtn.innerText();
  await qBtn.click();
  const after1 = await qBtn.innerText();
  assert.notEqual(before1, after1, 'Quality toggle must switch HD <-> LITE');
  assert.equal(await page.locator('.cinematic-stage canvas').getAttribute('data-story-scale'), after1 === 'LITE' ? '256x144' : '640x360');
  await page.keyboard.press('KeyL');
  assert.equal(await qBtn.innerText(), before1, 'L key must toggle quality back');
  assert.equal(await page.locator('.cinematic-stage canvas').getAttribute('data-story-scale'), before1 === 'LITE' ? '256x144' : '640x360');
  await page.getByRole('button', { name: 'Restart story', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.cinematic-top')?.textContent?.includes('01 /'));

  const report = await page.evaluate(async () => {
    const { CUTSCENE, prepareScene } = await import('/src/game/cutscene.ts');
    const { scientistDepartureAt, disposalPoseAt } = await import('/src/game/cutscene.ts');
    const { DISPOSAL_DURATION, disposalJob } = await import('/src/game/sceneDisposal.ts');
    const { calderaWalkerAt, calderaJob, riftGeometry, riftCameraAt } = await import('/src/game/sceneCaldera.ts');
    const { polygon, resolvePixelFrame, rockTextureGen } = await import('/src/game/pixelCraft.ts');
    const { drawBuilding } = await import('/src/game/outpostArt.ts');
    const { drawWorldHuman } = await import('/src/game/cineHumans.ts');
    const { CHARACTERS } = await import('/src/game/characters.ts');
    const { GameEngine } = await import('/src/game/engine.ts');
    const { heroRobot } = await import('/src/game/cutsceneArt.ts');
    const { pumpWarm, warmComplete } = await import('/src/game/cineKit.ts');
    // Do not accidentally test loading stand-ins as though they were final art.
    while (!warmComplete()) pumpWarm(30);
    const c = document.createElement('canvas');
    c.width = 640; c.height = 360;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = false;
    const digest = () => {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let h = 2166136261;
      for (let i = 0; i < d.length; i += 4) h = Math.imul(h ^ (d[i] + d[i + 1] * 257 + d[i + 2] * 65537), 16777619);
      return h >>> 0;
    };
    const quality = await import('/src/game/quality.ts');
    const art = await import('/src/game/outpostArt.ts');
    const islands = (cv, thr) => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const w = cv.width, h = cv.height, seen = new Uint8Array(w * h);
      let count = 0;
      for (let i = 0; i < w * h; i++) {
        if (seen[i] || d[i * 4 + 3] < thr) continue;
        count++;
        const st = [i]; seen[i] = 1;
        while (st.length) {
          const j = st.pop(); const x = j % w, y = (j / w) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const k = yy * w + xx;
            if (!seen[k] && d[k * 4 + 3] >= thr) { seen[k] = 1; st.push(k); }
          }
        }
      }
      return count;
    };
    const connectivity = [];
    const A = art.BUILDING_ANCHOR;
    for (const kind of ['refinery', 'forge', 'repair', 'shaft', 'habitat']) {
      for (const tier of [0, 1, 2, 3]) connectivity.push({ kind, tier, pieces: islands(art.buildingSprite(kind, tier), 1) });
      for (const t of [0.3, 1.9, 3.7, 5.2]) for (const active of [false, true]) {
        const cv = document.createElement('canvas'); cv.width = A.w; cv.height = A.h;
        art.drawBuilding(cv.getContext('2d'), kind, A.x, A.y, t, { tier: 3, active, door: active ? 1 : 0.4 });
        connectivity.push({ kind, t, active, pieces: islands(cv, 200) });
      }
    }
    const liteScenes = [];
    quality.setQuality('lite', false);
    for (let i = 0; i < CUTSCENE.length; i++) {
      prepareScene(i);
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 640, 360);
      CUTSCENE[i].draw(g, CUTSCENE[i].duration * 0.5, CUTSCENE[i].duration);
      const d = g.getImageData(0, 0, 640, 360).data;
      let lit = 0; for (let k = 0; k < d.length; k += 97 * 4) lit += d[k] + d[k + 1] + d[k + 2];
      liteScenes.push({ id: CUTSCENE[i].id, lit });
    }
    quality.setQuality('hd', false);
    const sceneResults = [];
    for (let i = 0; i < CUTSCENE.length; i++) {
      prepareScene(i);
      const scene = CUTSCENE[i];
      const hashes = [];
      for (const ratio of [0.08, 0.48, 0.94]) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, 640, 360);
        scene.draw(g, scene.duration * ratio, scene.duration);
        resolvePixelFrame(g);
        hashes.push(digest());
      }
      sceneResults.push({ id: scene.id, distinct: new Set(hashes).size });
    }
    const buildings = [];
    for (const kind of ['refinery', 'forge', 'repair', 'habitat', 'shaft']) {
      const hashes = [];
      for (const t of [0.2, 1.7]) {
        g.clearRect(0, 0, 640, 360);
        drawBuilding(g, kind, 120, 270, t, { active: true, tier: 3 });
        hashes.push(digest());
      }
      buildings.push({ kind, animated: hashes[0] !== hashes[1] });
    }
    const humans = [];
    for (const id of ['mara', 'gus', 'ilse', 'pip']) {
      const hashes = [];
      for (const phase of [0.1, 0.4]) {
        g.clearRect(0, 0, 640, 360);
        drawWorldHuman(g, id, 120, 270, CHARACTERS[id].look, 'walk', phase, 1, id === 'gus' ? 'wrench' : null);
        hashes.push(digest());
      }
      humans.push({ id, animated: hashes[0] !== hashes[1] });
    }
    const idleRobotFrames = [];
    for (const t of [1.1, 2.4]) {
      g.clearRect(0, 0, 640, 360);
      heroRobot(g, { x: 120, y: 200, s: 4, t, state: 'idle', drill: true, paintMix: 1 });
      idleRobotFrames.push(digest());
    }
    // Gameplay rig: a low-hull idle must differ from the healthy idle and must animate.
    const { drawCubeMiner } = await import('/src/game/characters.ts');
    const rigFrame = (time, lowHull) => {
      g.clearRect(0, 0, 640, 360);
      drawCubeMiner(g, { x: 120, y: 200, facing: 'right', aimAngle: 0.9, drillSpin: 0, drillExtend: 0, thrustPower: 0, isDrilling: false,
        drillTier: 1, armorTier: 1, thrusterTier: 1, cargoFill: 0, treadPhase: 0, bob: 0, squashX: 1, squashY: 1, time, invuln: false,
        tint: null, godMode: false, idleTime: 3, combo: 0, lowHull, lowFuel: false, cargoFull: false, scale: 3 });
      return digest();
    };
    // Low-hull idle must run a sleep -> wake -> danger-icon cycle: sample one
    // full 8.4 s cycle and require three visually distinct states, plus a
    // distinct frame specifically inside the wake window (the icon).
    const rigAt = (idleTime, lowHull) => {
      g.clearRect(0, 0, 640, 360);
      drawCubeMiner(g, { x: 120, y: 200, facing: 'right', aimAngle: 0.9, drillSpin: 0, drillExtend: 0, thrustPower: 0, isDrilling: false,
        drillTier: 1, armorTier: 1, thrusterTier: 1, cargoFill: 0, treadPhase: 0, bob: 0, squashX: 1, squashY: 1, time: idleTime, invuln: false,
        tint: null, godMode: false, idleTime, combo: 0, lowHull, lowFuel: false, cargoFull: false, scale: 3 });
      return digest();
    };
    const awake = rigAt(1.5, true);      // struggling awake
    const asleep = rigAt(5.0, true);     // powered down
    const waking = rigAt(7.6, true);     // jolted awake + DANGER icon
    const lowHullIdle = {
      healthyVsHurt: rigAt(1.5, false) !== awake,
      hurtAnimates: rigAt(0.2, true) !== rigAt(0.5, true),
      cycleHasThreeStates: new Set([awake, asleep, waking]).size === 3,
      wakeShowsIcon: waking !== asleep && waking !== awake,
    };
    const opened = [];
    const game = new GameEngine(() => {}, kind => opened.push(kind));
    for (const [x, expected] of [[264, 'refinery'], [704, 'forge'], [864, 'repair']]) {
      game.player.x = x; game.player.y = 176;
      if (game.getNearbyBuilding() !== expected) throw new Error(`Broken ${expected} interaction zone`);
      if (!game.interactWithNearbyBuilding()) throw new Error(`Broken ${expected} interaction`);
    }
    game.player.x = 405; game.player.prevX = 405;
    game.player.y = 176; game.player.prevY = 176;
    game.input.moveX = 1;
    for (let i = 0; i < 45; i++) game.update(1 / 60, 1280, 900);
    const moved = game.player.x > 410;
    c.width = 1280; c.height = 720;
    game.camX = 556; game.camY = 165; game.zoom = 1.55;
    game.render(g, 1280, 720);
    const scene3Grounding = Array.from({ length: 197 }, (_, i) => ({ t: i * 0.05, ...scientistDepartureAt(i * 0.05) }));
    const disposalMotion = Array.from({ length: Math.ceil(DISPOSAL_DURATION * 60) }, (_, i) => ({ t: i / 60, ...disposalPoseAt(i / 60) }));
    const beforeRelease = disposalPoseAt(7.95 - 0.00001), afterRelease = disposalPoseAt(7.95 + 0.00001);
    const disposalContinuity = Math.hypot(beforeRelease.x - afterRelease.x, beforeRelease.y - afterRelease.y);
    const disposalBuilt = disposalJob.ready;
    const calderaSupport = [0, 1, 4, 7, 12, 17].map((t) => ({ t, ...calderaWalkerAt(t) }));

    // Record the ACTUAL track housing transform used by the renderer. Test every
    // sleep/wake phase plus landing stretch at 1x and 3x, not just helper math.
    const treadContacts = [];
    const treadAngles = [];
    const originalFill = g.fillRect.bind(g);
    const floor = 225;
    g.fillRect = (x, y, w, h) => {
      if (x === -8 && y === 3 && w === 16 && h === 6) {
        const m = g.getTransform();
        treadContacts.push(Math.max(...[[-8, 3], [8, 3], [-8, 9], [8, 9]].map(([tx, ty]) => m.b * tx + m.d * ty + m.f)));
        treadAngles.push(Math.abs(m.b));
      }
      originalFill(x, y, w, h);
    };
    for (const scale of [1, 3]) for (const squash of [0.8, 1, 1.2]) {
      for (let t = 0; t < 17; t += 0.13) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        drawCubeMiner(g, {
          x: 120, y: floor - 7, groundY: floor, facing: 'right',
          aimAngle: 0.9, drillSpin: 0, drillExtend: 0, thrustPower: 0, isDrilling: false,
          drillTier: 1, armorTier: 1, thrusterTier: 1, cargoFill: 0, treadPhase: 0,
          bob: Math.sin(t) * 0.9, squashX: 2 - squash, squashY: squash,
          time: t, idleTime: t, lowHull: true, invuln: false, godMode: false, scale,
        });
      }
    }
    g.fillRect = originalFill;
    // Detached boulders have complete 13-vertex silhouettes, none touches a
    // canvas boundary. Their bottom edge is faceted/rounded, not a square crop.
    const stones = riftGeometry.boulders.map((points) => ({
      count: points.length,
      fullyInside: points.every(([x, y]) => x > 1 && y > 1 && x < 1919 && y < 959),
      uniqueX: new Set(points.map(p => Math.round(p[0]))).size,
      uniqueY: new Set(points.map(p => Math.round(p[1]))).size,
    }));
    let missingStonePixels = 0;
    for (const points of riftGeometry.boulders) {
      const minX = Math.min(...points.map(p => p[0]));
      const minY = Math.min(...points.map(p => p[1]));
      const normalized = points.map(([x, y]) => [x - minX + 8, y - minY + 8]);
      const mask = document.createElement('canvas'); mask.width = 96; mask.height = 96;
      const rock = document.createElement('canvas'); rock.width = 96; rock.height = 96;
      polygon(mask.getContext('2d'), normalized, '#fff');
      const painter = rockTextureGen(rock.getContext('2d'), normalized, '#334144', '#9fac91', 91);
      while (!painter.next().done) { /* Finish this small isolated test sprite. */ }
      const ma = mask.getContext('2d').getImageData(0, 0, 96, 96).data;
      const ra = rock.getContext('2d').getImageData(0, 0, 96, 96).data;
      for (let i = 3; i < ma.length; i += 4) {
        if (ma[i] > 0 && ra[i] === 0) missingStonePixels++;
      }
    }
    const cameraSteps = Array.from({ length: 539 }, (_, i) => {
      const a = riftCameraAt(i / 30), b = riftCameraAt((i + 1) / 30);
      return Math.abs(a.zoom - b.zoom);
    });
    const pointInPolygon = ([x, y], points) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      return inside;
    };
    const boulderSupport = riftGeometry.boulderSupports.map(s => ({
      seated: pointInPolygon(s.contact, riftGeometry.benches[s.bench]),
      embed: s.contact[1] - s.supportY,
    }));
    // Verify the FINAL rendered cliff layer has one connected silhouette.
    // A disconnected rock island is a stronger failure than complete contours alone.
    const renderedRockComponents = islands(calderaJob.get().geology, 1);
    const renderedLedgeComponents = islands(calderaJob.get().ledge, 1);
    return {
      sceneResults, buildings, humans, opened, moved, connectivity, liteScenes, scene3Grounding,
      calderaSupport, idleRobotFrames, lowHullIdle,
      groundContact: {
        samples: treadContacts.length, deepest: Math.max(...treadContacts) - floor,
        largestGap: floor - Math.min(...treadContacts), largestTrackTilt: Math.max(...treadAngles),
      },
      stones, missingStonePixels, maxCameraZoomStep: Math.max(...cameraSteps),
      boulderSupport, renderedRockComponents, renderedLedgeComponents,
      disposalMotion, disposalContinuity, disposalBuilt,
    };
  });
  assert.equal(report.sceneResults.length, 12);
  for (const c of report.connectivity) assert.equal(c.pieces, 1, `Disconnected building part: ${JSON.stringify(c)}`);
  for (const sample of report.scene3Grounding) {
    for (const person of sample.scientists) assert.ok(person.supported && person.y === sample.floor, `Unsupported scientist at ${sample.t}s`);
    if (sample.rail > 0) assert.ok(sample.scientists.every(p => p.boarded), `Safety rail closes during boarding at ${sample.t}s`);
    if (sample.departing) assert.ok(sample.rail > 0.99 && sample.scientists.every(p => p.boarded), `Tram departs before boarding finishes at ${sample.t}s`);
  }
  for (const pose of report.calderaSupport) assert.ok(pose.supported && pose.deck >= 625 && pose.deck <= 665, `CUBE-07 leaves the scene 12 rock ledge at ${pose.t}s`);
  assert.ok(report.groundContact.samples > 700 && report.groundContact.deepest <= 0, `Tread clips the collision floor: ${JSON.stringify(report.groundContact)}`);
  assert.ok(report.groundContact.largestGap < 0.001 && report.groundContact.largestTrackTilt < 0.001, `Low-health treads float or tilt above the floor: ${JSON.stringify(report.groundContact)}`);
  for (const rock of report.boulderSupport) assert.ok(rock.seated && rock.embed >= 0 && rock.embed <= 1.1, 'A boulder floats above its bench');
  assert.equal(report.renderedRockComponents, 1, 'Detached rock or mineral pixels in the final cliff layer');
  assert.equal(report.renderedLedgeComponents, 1, 'Detached rock fragments beside the walking ledge');
  assert.ok(report.disposalBuilt && report.disposalContinuity < 0.01, 'Disposal shot fails to load or jumps at release');
  for (const pose of report.disposalMotion) {
    assert.ok(pose.trackFront < pose.edge, `Sweeper drives off the platform at ${pose.t}s`);
    if (pose.contactGap !== undefined) assert.ok(Math.abs(pose.contactGap) < 0.01, `Plow loses contact while pushing at ${pose.t}s`);
    if (pose.phase === 'approach' && pose.trackFront > 172) assert.ok(pose.door > 0.99, 'Machine intersects the closed hangar shutter');
    if (pose.phase === 'tip') {
      const pivotY = pose.y + Math.sin(pose.rotation) * 4 * 3.4 + Math.cos(pose.rotation) * 15 * 3.4;
      assert.ok(Math.abs(pivotY - pose.floor) < 0.001, 'Tipping tread loses its edge pivot');
    }
  }
  for (const stone of report.stones) assert.ok(stone.count === 13 && stone.fullyInside && stone.uniqueX > 6 && stone.uniqueY > 5, 'A boulder has a truncated/square contour');
  assert.equal(report.missingStonePixels, 0, 'Stone shader crops pixels from the silhouette');
  assert.ok(report.maxCameraZoomStep < 0.02, 'The rift camera must not jump between beats');
  assert.notEqual(report.idleRobotFrames[0], report.idleRobotFrames[1], 'CUBE-07 idle breathing/beacon must animate');
  assert.ok(report.lowHullIdle.healthyVsHurt && report.lowHullIdle.hurtAnimates, `Low-hull idle must be distinct and animated: ${JSON.stringify(report.lowHullIdle)}`);
  assert.ok(report.lowHullIdle.cycleHasThreeStates, `Low-hull idle must cycle sleep/wake: ${JSON.stringify(report.lowHullIdle)}`);
  assert.ok(report.lowHullIdle.wakeShowsIcon, `Low-hull wake must show the danger icon: ${JSON.stringify(report.lowHullIdle)}`);
  for (const l of report.liteScenes) assert.ok(l.lit > 2000, `${l.id} must render in Lite mode`);
  for (const scene of report.sceneResults) assert.equal(scene.distinct, 3, `${scene.id} must animate and render at every phase`);
  for (const b of report.buildings) assert.ok(b.animated, `${b.kind} animation is frozen`);
  for (const h of report.humans) assert.ok(h.animated, `${h.id} walk cycle is frozen`);
  assert.deepEqual(report.opened, ['refinery', 'forge']);
  assert.ok(report.moved, 'Player movement must still work');
  await page.getByRole('button', { name: 'Skip story', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.cinematic-shell'));

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const mobile = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(base);
    await mobile.getByRole('button', { name: '▶ STORY', exact: true }).click();
    await mobile.getByRole('button', { name: /Go to chapter 12:/ }).click();
    await mobile.getByRole('button', { name: 'Pause story', exact: true }).click();
    const bounds = await mobile.locator('.cinematic-stage').boundingBox();
    assert.ok(bounds.width > 200 && bounds.height > 100, 'Mobile art must remain visible');
    assert.ok(bounds.x >= -1 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1);
    assert.ok(bounds.y + bounds.height <= viewport.height, 'Cinematic art must fit inside the viewport');
    assert.equal(await mobile.getByRole('button', { name: /Go to chapter/ }).count(), 12);
    await mobile.close();
  }
  assert.deepEqual(errors, [], 'No browser runtime errors are allowed');
  console.log(`PASS: disposal contact/pivot/release, tram boarding, supported connected rocks, ${report.groundContact.samples} planted low-health poses, all 12 HD/Lite scenes, buildings, interactions, controls, and mobile layouts.`);
} finally {
  await browser.close();
}