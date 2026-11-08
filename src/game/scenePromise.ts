import { CHARACTERS } from './characters';
import { CH, CW, INK, R, clamp, ease, easeInOut, glowAt, heroRobot, sparksAt } from './cutsceneArt';
import { cinematicHuman, cinematicReachPoint, crowdLook } from './cineHumans';
import { filmLighting, motes } from './cinematicSets';
import { drawStorySet } from './storyWorlds';

export const PROMISE_DURATION = 9.6;
const DECK = 268;
const MARA_S = 2.15;
const CUBE_S = 3.5;
const PAN = 36;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const human = (id: 'mara' | 'gus' | 'ilse' | 'pip') => CHARACTERS[id].look!;

// The exchange is solved from the actual articulated palm/core geometry, not a
// hard-coded glow between sprites. CUBE's wrist meets the cell to the pixel.
const OFFER = cinematicReachPoint({
  x: 423, y: DECK, s: MARA_S, t: 0, look: human('mara'), pose: 'reach', reachProgress: 1, facing: 1,
});
const CUBE_TARGET = OFFER.core[0] + 19 * CUBE_S;
const SERVICE_Y = (OFFER.core[1] - (DECK - 15 * CUBE_S)) / CUBE_S - 1.5;
export const promiseContact = { core: OFFER.core, cubeX: CUBE_TARGET, serviceArmY: SERVICE_Y };

export type PromisePhase = 'approach' | 'offer' | 'transfer' | 'accept' | 'home';
export function promiseBeatAt(t: number) {
  const clear = easeInOut(clamp(t / 1.9));
  const approach = easeInOut(clamp((t - 0.35) / 1.45));
  const reach = t < 3.8 ? ease(clamp((t - 1.9) / 1.0)) : 1 - ease(clamp((t - 3.8) / 0.8));
  const service = t < 4.0 ? ease(clamp((t - 2.15) / 1.0)) : 1 - ease(clamp((t - 4.0) / 0.9));
  const accepted = t >= 3.6;
  const seat = ease(clamp((t - 4.25) / 0.95));
  const charge = lerp(0.18, 1, ease(clamp((t - 4.8) / 1.15)));
  const ready = ease(clamp((t - 7.5) / 1.3));
  // Physical intake hatch + hull charge lamps replace the floating service UI.
  const portOpen = ease(clamp((t - 3.65) / 0.55)) * (1 - ease(clamp((t - 5.15) / 0.55)));
  const cellCharge = ease(clamp((t - 5.25) / 1.0));
  const push = easeInOut(clamp((t - 1.1) / 6.8));
  const phase: PromisePhase = t < 1.9 ? 'approach' : t < 3.45 ? 'offer' : t < 4.8 ? 'transfer' : t < 6.2 ? 'accept' : 'home';
  return {
    phase, clear, approach, reach, service, accepted, seat, charge, ready, portOpen, cellCharge, push,
    maraX: lerp(396, 423, approach),
    cubeX: lerp(548, CUBE_TARGET, approach),
    gusX: lerp(344, 318, clear),
    ilseX: lerp(452, 285, clear),
  };
}

function camera(ctx: CanvasRenderingContext2D, zoom: number, draw: () => void) {
  // Keep the offered cell fixed while the world slowly pushes in around it.
  const ox = (OFFER.core[0] - CW / 2) * (1 - zoom);
  const oy = (OFFER.core[1] - CH / 2) * (1 - zoom);
  ctx.save();
  ctx.translate(CW / 2 + ox, CH / 2 + oy);
  ctx.scale(zoom, zoom);
  ctx.translate(-CW / 2, -CH / 2);
  draw();
  ctx.restore();
}

function powerCell(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, glow = 1) {
  R(ctx, x - 4, y - 5, 8, 10, INK);
  R(ctx, x - 3, y - 4, 6, 8, '#4a5567');
  R(ctx, x - 2, y - 3, 4, 6, '#fde047');
  R(ctx, x - 2, y - 3, 2, 2, '#fff7cc');
  R(ctx, x - 1, y - 6, 2, 1, '#8a94a2');
  if (glow > 0) glowAt(ctx, x, y, 14 + Math.sin(t * 6) * 2, '#fde047', 0.32 * glow);
}

export function drawPromiseScene(ctx: CanvasRenderingContext2D, t: number) {
  const b = promiseBeatAt(t);
  camera(ctx, 1 + b.push * 0.32, () => {
    // Chapter 9 ended with the vault open and the crew on the deck. Do not reset
    // the door or teleport the cast back inside for the pact.
    drawStorySet(ctx, 'outpost', PAN, t, 1);

    // Background survivors step aside to give Mara and CUBE a clear lane.
    for (let i = 0; i < 6; i++) {
      const left = i < 3;
      const from = left ? 150 + i * 26 : [462, 486, 509][i - 3];
      const to = left ? 150 + i * 26 : 584 + (i - 3) * 26;
      const x = lerp(from, to, b.clear);
      cinematicHuman(ctx, {
        x, y: DECK, s: 1.45, t: t + i * 0.7, look: crowdLook(i),
        pose: !left && b.clear < 1 ? 'walk' : b.phase === 'home' && i % 2 ? 'wave' : 'idle',
        walkPhase: t * 4.2 + i, facing: 1, dim: 0.38, rim: '#ffce85', lampOn: i % 2 === 0,
      });
    }

    // Pip stays curious; Ilse crosses behind the principals with the lantern.
    cinematicHuman(ctx, { x: 236, y: DECK, s: 1.8, t, look: human('pip'), pose: b.phase === 'home' ? 'wave' : 'idle', facing: 1, rim: '#ffd9a0', lampOn: true });
    cinematicHuman(ctx, {
      x: b.ilseX, y: DECK, s: 2.1, t: t + 0.9, look: human('ilse'),
      pose: b.clear < 1 ? 'walk' : 'idle', walkPhase: t * 4.4, facing: b.clear < 1 ? -1 : 1,
      flipProp: 'lantern', rim: '#ffd9a0', dim: b.clear < 1 ? 0.12 : 0, lampOn: true,
    });
    if (b.clear >= 1) glowAt(ctx, b.ilseX + 10, DECK - 28, 20, '#ffd9a0', 0.1 + 0.03 * Math.sin(t * 3));
    cinematicHuman(ctx, {
      x: b.gusX, y: DECK, s: 2.15, t: t + 0.4, look: human('gus'),
      pose: b.clear < 1 ? 'walk' : b.phase === 'home' ? 'cheer' : 'idle', walkPhase: t * 4.1,
      flipProp: 'wrench', facing: 1, rim: '#ffd9a0', lampOn: true,
    });

    // Mara offers the outpost's last power cell, then withdraws an empty hand.
    cinematicHuman(ctx, {
      x: b.maraX, y: DECK, s: MARA_S, t, look: human('mara'), rim: '#ffe2a8',
      pose: b.approach < 1 ? 'walk' : b.reach > 0.02 ? 'reach' : 'idle',
      reachProgress: b.reach, offerCore: !b.accepted, walkPhase: t * 4,
      talking: (t > 1.5 && t < 4.1) || (t > 5.9 && t < 7.4), facing: 1,
    });

    // CUBE rolls in on his treads, scans the cell, closes the wrist, seats the
    // cell in his front intake, and only then shows restored power / acceptance.
    const cubeY = DECK - 15 * CUBE_S;
    heroRobot(ctx, {
      x: b.cubeX, y: cubeY, s: CUBE_S, t, flip: true, chassisMotion: false,
      state: t > 6.2 ? 'happy' : 'idle',
      eye: t < 5.2 ? 'scan' : t > 6.2 ? 'happy' : 'normal',
      look: 1, drill: true, drillAngle: lerp(2.35, 0.42, b.ready), drillExtend: 0.1,
      drillSpin: b.ready > 0.9 ? t * 0.4 : 0,
      serviceArm: b.service, serviceArmY: SERVICE_Y,
      cellPort: b.portOpen, cellCharge: b.cellCharge,
      wheelPhase: (548 - b.cubeX) / (3 * CUBE_S), paintMix: 1,
      // Stable hull power: acceptance is shown by the cell hatch, lamps and eyes,
      // not a flickering full-body overlay or a fake clickable readout.
      power: 1,
    });

    // One cell, one owner: palm -> gripper -> front intake. Never duplicated.
    if (b.accepted) {
      const portX = b.cubeX - 7 * CUBE_S;
      const portY = cubeY + 2 * CUBE_S;
      const x = lerp(OFFER.core[0], portX, b.seat);
      const y = lerp(OFFER.core[1], portY, b.seat);
      if (b.seat < 0.96) powerCell(ctx, x, y, t, 1 - b.seat * 0.5);
      if (b.seat > 0.7) glowAt(ctx, portX, portY, 18, '#fde047', (b.seat - 0.7) * 0.5 * (1 - ease(clamp((t - 5.6) / 1.2))));
    }
    if (b.service > 0.95 && b.reach > 0.95) {
      glowAt(ctx, OFFER.core[0], OFFER.core[1], 22, '#fde047', 0.22 + 0.08 * Math.sin(t * 6));
      if (t > 3.45 && t < 3.95) sparksAt(ctx, OFFER.core[0], OFFER.core[1], t, 55, 7, 12);
    }

    motes(ctx, t, 14, '#f7cb9a', 80, 230);
  });
  filmLighting(ctx, '#191322', 0.32);
}
