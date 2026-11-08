import { CHARACTERS } from './characters';
import { CH, CW, INK, R, clamp, ease, easeInOut, glowAt, heroRobot } from './cutsceneArt';
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
export function promiseGripperAt(t: number) {
  const b = promiseBeatAt(t);
  const armLen = 3 + b.service * 7;
  return [b.cubeX - (9 + armLen) * CUBE_S, DECK - 15 * CUBE_S + (SERVICE_Y + 1.5) * CUBE_S] as const;
}
export function promiseCellAt(t: number) {
  const b = promiseBeatAt(t);
  if (!b.accepted) return cinematicReachPoint({ x: b.maraX, y: DECK, s: MARA_S, t, look: human('mara'), pose: 'reach', reachProgress: b.reach, facing: 1 }).core;
  return promiseGripperAt(t);
}

export type PromisePhase = 'approach' | 'offer' | 'transfer' | 'accept' | 'home';
export function promiseBeatAt(t: number) {
  const clear = easeInOut(clamp(t / 1.9));
  const approach = easeInOut(clamp((t - 0.35) / 1.45));
  const reach = t < 3.7 ? ease(clamp((t - 1.9) / 1.0)) : 1 - ease(clamp((t - 3.7) / 0.8));
  const grip = ease(clamp((t - 3.3) / 0.3));
  const accepted = t >= 3.6;
  const carry = ease(clamp((t - 4.0) / 1.0));
  // The wrist extends to Mara, closes, then retracts ONLY a short way while
  // holding the same cell. No hatch opens elsewhere on the hull.
  const service = t < 4.0 ? ease(clamp((t - 2.15) / 1.0)) : lerp(1, 0.22, carry);
  const ready = ease(clamp((t - 7.5) / 1.3));
  const push = easeInOut(clamp((t - 1.1) / 6.8));
  const phase: PromisePhase = t < 1.9 ? 'approach' : t < 3.3 ? 'offer' : t < 4.0 ? 'transfer' : t < 6.2 ? 'accept' : 'home';
  return {
    phase, clear, approach, reach, grip, service, accepted, carry, ready, push,
    maraX: lerp(396, 423, approach),
    cubeX: lerp(548, CUBE_TARGET, approach),
    gusX: lerp(344, 318, clear),
    ilseX: lerp(452, 285, clear),
  };
}

function camera(ctx: CanvasRenderingContext2D, zoom: number, draw: () => void) {
  // Center the actual hand-to-gripper contact, then push in slowly. The cell
  // stays fixed on screen while the outpost slides gently behind the exchange.
  // Blend from the establishing frame into a centered close-up. The blend keeps
  // the visible world inside the outpost plate (no uncovered black edges).
  const center = clamp((zoom - 1) / 0.7);
  const tx = lerp(CW / 2, CW / 2 - (OFFER.core[0] - CW / 2) * zoom, center);
  const ty = lerp(CH / 2, CH / 2 - (OFFER.core[1] - CH / 2) * zoom, center);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(zoom, zoom);
  ctx.translate(-CW / 2, -CH / 2);
  draw();
  ctx.restore();
}

function powerCell(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, glow = 1) {
  R(ctx, x - 3.5, y - 3.5, 7, 7, INK);
  R(ctx, x - 2.5, y - 2.5, 5, 5, '#fde047');
  R(ctx, x - 2.5, y - 2.5, 2, 2, '#fff7cc');
  R(ctx, x - 1, y - 4.5, 2, 1, '#8a94a2');
  if (glow > 0) glowAt(ctx, x, y, 10 + Math.sin(t * 4) * 1.5, '#fde047', 0.22 * glow);
}

export function drawPromiseScene(ctx: CanvasRenderingContext2D, t: number) {
  const b = promiseBeatAt(t);
  camera(ctx, 1 + b.push * 0.7, () => {
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

    // One visible cell. Before release it is in Mara's palm; after release it
    // is drawn UNDER CUBE's closing jaws and stays attached to that same wrist.
    const cell = promiseCellAt(t);
    if (b.accepted) powerCell(ctx, cell[0], cell[1], t, 0.8);
    const cubeY = DECK - 15 * CUBE_S;
    heroRobot(ctx, {
      x: b.cubeX, y: cubeY, s: CUBE_S, t, flip: true, chassisMotion: false,
      state: t > 5.2 ? 'happy' : 'idle',
      eye: t < 3.6 ? 'scan' : t > 5.2 ? 'happy' : 'normal',
      look: 1, drill: true, drillAngle: lerp(Math.PI / 2, 0.42, b.ready), drillExtend: 0.05,
      drillSpin: b.ready > 0.9 ? t * 0.4 : 0,
      serviceArm: b.service, serviceArmY: SERVICE_Y, serviceGrip: b.grip,
      wheelPhase: (548 - b.cubeX) / (3 * CUBE_S), paintMix: 1, power: 1,
    });
    if (!b.accepted && b.service > 0.95 && b.reach > 0.95) {
      glowAt(ctx, OFFER.core[0], OFFER.core[1], 14, '#fde047', 0.12);
    }

    motes(ctx, t, 14, '#f7cb9a', 80, 230);
  });
  filmLighting(ctx, '#191322', 0.32);
}
