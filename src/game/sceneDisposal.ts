import { clamp, hash, heroRobot, mix } from './cutsceneArt';
import { Job, makeCanvas } from './cineKit';
import { modernCityJob } from './storyWorlds';
import { qn } from './quality';
import { cable, ellipse, metal, pipe, pixelGlow, pixelLine, polygon, px } from './pixelCraft';

export const DISPOSAL_DURATION = 9.8;
const FLOOR = 330;
const EDGE = 646;
const SCALE = 3.4;
const START = 366;
const CONTACT = 3.3, PUSH = 3.9, TIP = 7.2, RELEASE = 7.95;
const INK = '#0b1722';
const glide = (x: number) => { const t = clamp(x); return t * t * t * (10 + t * (-15 + t * 6)); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const DOOR = { left: -37, right: 172, top: 158 };

/** All contact positions are derived from a single continuous motion curve. */
export function disposalPoseAt(t: number) {
  const door = glide((t - 0.4) / 1.25);
  const approach = glide((t - 1.5) / (CONTACT - 1.5));
  const pressure = glide((t - CONTACT) / (PUSH - CONTACT));
  const progress = glide((t - PUSH) / (TIP - PUSH));
  const pivotLocalX = 4;
  const groundedEnd = EDGE - pivotLocalX * SCALE;
  let x = lerp(START, groundedEnd, progress), y = FLOOR - 15 * SCALE, rotation = 0;
  const tip = clamp((t - TIP) / (RELEASE - TIP));
  const theta = 0.75 * tip * tip;
  const orbit = (a: number) => ({
    x: EDGE - pivotLocalX * SCALE * Math.cos(a) + 15 * SCALE * Math.sin(a),
    y: FLOOR - pivotLocalX * SCALE * Math.sin(a) - 15 * SCALE * Math.cos(a),
  });
  let phase: 'waiting' | 'approach' | 'contact' | 'push' | 'tip' | 'fall' =
    t < 1.5 ? 'waiting' : t < CONTACT ? 'approach' : t < PUSH ? 'contact' : t < TIP ? 'push' : t < RELEASE ? 'tip' : 'fall';
  if (t >= TIP) {
    const p = orbit(theta);
    x = p.x; y = p.y; rotation = theta;
  }
  if (t >= RELEASE) {
    const a = 0.75, omega = 1.5 / (RELEASE - TIP), ft = t - RELEASE;
    const release = orbit(a);
    // Tangential velocity matches the tipping orbit at the exact release frame.
    const vx = (pivotLocalX * SCALE * Math.sin(a) + 15 * SCALE * Math.cos(a)) * omega;
    const vy = (-pivotLocalX * SCALE * Math.cos(a) + 15 * SCALE * Math.sin(a)) * omega;
    x = release.x + vx * ft;
    y = release.y + vy * ft + 0.5 * 220 * ft * ft;
    rotation = a + omega * ft;
    phase = 'fall';
  }
  const plow = t < CONTACT
    ? lerp(168, START - 12 * SCALE, approach)
    : lerp(START, groundedEnd, progress) - 12 * SCALE;
  const ram = pressure * 12;
  const trackFront = plow - ram - 43;
  const trackRear = plow - ram - 207;
  return {
    phase, door, pressure, progress, x, y, rotation, plow, ram,
    trackFront, trackRear, floor: FLOOR, edge: EDGE,
    trackDistance: plow - ram - 168,
    contactGap: phase === 'contact' || phase === 'push' ? x - 12 * SCALE - plow : undefined,
    supported: t < TIP,
  };
}

interface DisposalSet { sky: HTMLCanvasElement; bay: HTMLCanvasElement; foreground: HTMLCanvasElement; }

export const disposalJob = new Job(function* (): Generator<unknown, DisposalSet, unknown> {
  const [sky, s] = makeCanvas(1280, 960);
  for (let y = 0; y < 960; y++) {
    const k = clamp(y / 440);
    px(s, 0, y, sky.width, 1, mix('#102838', '#d1b790', k * k * 0.68 + k * 0.32));
    if (y % 20 === 0) yield;
  }
  pixelGlow(s, 813, 240, 210, '#f2d39e', 0.22);
  ellipse(s, 813, 241, 23, 22, '#e9d8ae');
  // A dependency must outrank its consumer, otherwise the priority scheduler
  // would keep stepping this job while the city stayed permanently unbuilt.
  modernCityJob.priority = Math.max(modernCityJob.priority, 11);
  while (!modernCityJob.ready) {
    // Also make progress if this job is ever finished synchronously via get().
    modernCityJob.step(performance.now() + 0.75);
    yield;
  }
  const city = modernCityJob.peek()!;
  s.save(); s.globalAlpha = 0.65;
  s.drawImage(city, 336, -19, 510, 287);
  s.restore();
  s.save(); s.globalAlpha = 0.2;
  s.drawImage(city, 839, 112, 230, 129);
  s.drawImage(city, -110, 105, 240, 135);
  s.restore();
  // Stratified cloud sea, far below the edge of the disposal deck.
  for (let i = 0; i < 23; i++) {
    const x = -100 + hash(i * 5.1) * 1220;
    const y = 275 + hash(i * 7.3) * 610;
    const r = 52 + hash(i * 1.9) * 92;
    s.globalAlpha = 0.17 + (i % 3) * 0.035;
    ellipse(s, x, y, r, r * 0.15, i % 3 ? '#ced6ca' : '#8fa9ae');
  }
  s.globalAlpha = 1;
  yield;

  const [bay, g] = makeCanvas(1024, 640);
  // The deck is a thick load-bearing cantilever, with no back rail across its open end.
  px(g, 0, FLOOR, EDGE, 9, '#253b47');
  px(g, 0, FLOOR, EDGE, 2, '#d6d8bf');
  px(g, 0, FLOOR + 2, EDGE, 3, '#849a9d');
  metal(g, 0, FLOOR + 10, EDGE - 2, 66, '#344e5d', 11, 45);
  px(g, 0, FLOOR + 12, EDGE - 1, 3, '#a2b4ae');
  for (let x = 12; x < EDGE - 24; x += 48) {
    metal(g, x, FLOOR + 22, 31, 38, '#203641', x, 31);
    for (let y = FLOOR + 26; y < FLOOR + 55; y += 5) px(g, x + 4, y, 23, 2, '#101f2b');
  }
  polygon(g, [[0, FLOOR + 77], [EDGE, FLOOR + 77], [EDGE - 81, FLOOR + 119],
    [EDGE - 160, FLOOR + 119], [EDGE - 167, FLOOR + 138], [42, FLOOR + 138], [0, FLOOR + 108]], '#142d3c');
  pixelLine(g, [0, FLOOR + 79], [EDGE - 80, FLOOR + 119], '#506976', 3);
  for (const x of [74, 228, 382, 526]) {
    polygon(g, [[x, FLOOR + 77], [x + 55, FLOOR + 77], [x + 16, FLOOR + 127]], '#294551');
    pixelLine(g, [x, FLOOR + 78], [x + 16, FLOOR + 125], '#718389', 2);
  }
  pipe(g, [[0, FLOOR + 88], [490, FLOOR + 88], [490, FLOOR + 112], [560, FLOOR + 112]], 4, '#526a74');
  px(g, EDGE - 3, FLOOR, 3, 79, '#c0c9b7');
  for (let x = 208; x < EDGE - 10; x += 26) {
    metal(g, x, FLOOR - 43, 3, 43, '#516f7d', 5, 3);
    px(g, x, FLOOR - 43, 3, 1, '#cbd7cf');
  }
  px(g, 210, FLOOR - 43, EDGE - 216, 2, '#b6c8c2');
  px(g, 210, FLOOR - 23, EDGE - 216, 1, '#587989');
  // Parallel steel wear strips keep the sliding contact and ground plane obvious.
  for (const y of [FLOOR - 1, FLOOR - 5]) {
    px(g, 184, y, EDGE - 184, 1, '#b4b1a0');
    for (let x = 185; x < EDGE; x += 19) px(g, x, y, 2, 1, '#39464b');
  }
  for (let x = 187; x < EDGE; x += 28) px(g, x, FLOOR + 5, 13, 3, '#c29d4e');
  yield;

  // Reclamation hangar, with its opening in the SAME plane as the machine floor.
  metal(g, -44, 91, 236, FLOOR - 91, '#3b535d', 31, 16);
  polygon(g, [[-46, 92], [-27, 72], [168, 72], [197, 91]], '#7a8e91');
  px(g, -25, 74, 192, 2, '#c9cebb');
  for (let x = -15; x < 175; x += 27) pixelLine(g, [x, 76], [x + 13, 89], '#4e6770');
  metal(g, -30, 108, 181, 22, '#182c38', 5, 181);
  g.font = '6px "Press Start 2P", monospace'; g.fillStyle = '#c4d0bc';
  g.fillText('RECLAMATION / 04', 8, 122);
  px(g, DOOR.left, DOOR.top, DOOR.right - DOOR.left, FLOOR - DOOR.top, '#07131f');
  // Receding interior, fixed racks, and a ceiling worklight.
  polygon(g, [[DOOR.left, FLOOR], [DOOR.right, FLOOR], [145, FLOOR - 34], [0, FLOOR - 34]], '#25383e');
  for (let x = -16; x < 144; x += 34) {
    metal(g, x, 193, 25, 75, '#1c303d', 3, 25);
    for (let y = 202; y < 264; y += 12) px(g, x + 3, y, 19, 2, '#3d5357');
  }
  px(g, -4, 176, 138, 5, '#bcd7ce');
  px(g, 1, 177, 128, 2, '#e3e9d5');
  metal(g, DOOR.right, DOOR.top - 5, 13, FLOOR - DOOR.top + 5, '#708890', 23, 13);
  for (let y = DOOR.top; y < FLOOR - 5; y += 13) {
    px(g, DOOR.right + 3, y, 7, 6, '#d0a54b');
    px(g, DOOR.right + 3, y + 6, 7, 6, '#1a2b35');
  }
  metal(g, DOOR.left - 2, DOOR.top - 9, DOOR.right - DOOR.left + 17, 9, '#7c9192', 8, 22);
  // Door motor, guide track and wall-connected warning lamps.
  metal(g, 162, 134, 22, 14, '#283f4c', 2, 22);
  pipe(g, [[172, 149], [172, DOOR.top - 7]], 3, '#829891');
  for (const x of [-12, 154]) {
    px(g, x, 136, 7, 7, '#142837');
    px(g, x + 2, 135, 3, 2, '#d4af60');
  }
  pipe(g, [[191, 118], [204, 118], [204, 306]], 3, '#6e8586');
  for (let y = 137; y < 302; y += 42) px(g, 201, y, 10, 2, '#2c404b');
  metal(g, 168, 260, 17, 29, '#1e3440', 2, 17);
  px(g, 172, 265, 9, 8, '#11232e');
  px(g, 172, 266, 9, 1, '#88aeb4');
  g.font = '5px "Press Start 2P", monospace';
  g.fillStyle = '#c9b77d'; g.fillText('NO PERSONNEL', 228, FLOOR + 31);
  yield;

  const [foreground, f] = makeCanvas(1024, 640);
  // Frame the disposal edge with connected suspension hardware, not floating overlays.
  metal(f, -12, 62, 10, 276, '#1b3341', 4, 10);
  metal(f, -13, 57, 229, 7, '#213e4d', 7, 29);
  cable(f, [211, 62], [211, 135], 0, '#0b1e2c', 2);
  px(f, 207, 132, 8, 8, '#172d3a');
  return { sky, bay, foreground };
});

let shutter: HTMLCanvasElement | null = null;
function rollerShutter() {
  if (shutter) return shutter;
  const [c, g] = makeCanvas(DOOR.right - DOOR.left, FLOOR - DOOR.top);
  for (let y = 0; y < c.height; y++) px(g, 0, y, c.width, 1,
    y % 7 === 0 ? '#829b9f' : y % 7 === 6 ? '#1d3543' : '#455f6c');
  shutter = c;
  return c;
}
let sweeperBody: HTMLCanvasElement | null = null;
function getSweeper() {
  if (sweeperBody) return sweeperBody;
  const [c, g] = makeCanvas(240, 168);
  g.translate(222, 151);
  // Track frame and lower hull; every cab/hood component sits on this chassis.
  polygon(g, [[-210, -39], [-193, -47], [-58, -47], [-42, -37], [-42, -6], [-56, 0], [-196, 0], [-211, -11]], INK);
  polygon(g, [[-207, -37], [-191, -43], [-59, -43], [-46, -34], [-46, -8], [-58, -3], [-194, -3], [-207, -12]], '#344a55');
  px(g, -190, -42, 128, 2, '#9ba9a4');
  metal(g, -199, -66, 146, 23, '#75674b', 7, 24);
  px(g, -197, -65, 140, 3, '#c4aa70');
  // Rear motor housing and integrated cooling pack.
  polygon(g, [[-199, -68], [-192, -104], [-140, -104], [-127, -68]], INK);
  polygon(g, [[-196, -70], [-189, -101], [-143, -101], [-131, -70]], '#4a6066');
  pixelLine(g, [-188, -101], [-144, -101], '#9cb1ad', 2);
  for (let x = -187; x < -143; x += 5) {
    px(g, x, -94, 3, 17, '#172c38'); px(g, x, -94, 1, 17, '#738789');
  }
  // Cab with a sloped sensor windscreen and external protective roll frame.
  polygon(g, [[-137, -68], [-137, -124], [-123, -135], [-75, -135], [-57, -116], [-57, -68]], INK);
  polygon(g, [[-133, -71], [-133, -122], [-120, -131], [-77, -131], [-61, -114], [-61, -71]], '#6d827f');
  polygon(g, [[-124, -122], [-119, -127], [-80, -127], [-67, -112], [-67, -94], [-124, -94]], '#142f42');
  polygon(g, [[-121, -120], [-116, -124], [-82, -124], [-71, -112], [-71, -110], [-121, -110]], '#4e7b8b');
  pixelLine(g, [-117, -121], [-98, -121], '#a9cbcc');
  px(g, -96, -126, 3, 32, '#263f4d');
  px(g, -79, -107, 9, 3, '#d78e72');
  px(g, -123, -86, 39, 10, '#324c56');
  px(g, -118, -82, 23, 1, '#a8b5a1');
  for (const x of [-139, -58]) {
    metal(g, x, -130, 4, 70, '#354e5a', x, 4);
  }
  metal(g, -140, -137, 88, 5, '#8c9c91', 9, 22);
  // Exhaust and warning beacon are rigidly mounted, with a connected brace.
  metal(g, -185, -127, 7, 25, '#364d59', 4, 7);
  px(g, -188, -129, 13, 3, '#1b303b');
  px(g, -187, -129, 11, 1, '#95a49c');
  metal(g, -113, -147, 17, 10, '#354e58', 2, 17);
  px(g, -110, -146, 11, 7, '#775128');
  // Hydraulic mounting block, tools and rear tow eye.
  metal(g, -62, -83, 13, 34, '#5b6d70', 4, 13);
  px(g, -197, -52, 14, 3, '#152a35');
  px(g, -215, -55, 17, 8, '#142c3b');
  px(g, -214, -54, 10, 2, '#82948e');
  sweeperBody = c;
  return c;
}

function sweeper(ctx: CanvasRenderingContext2D, pose: ReturnType<typeof disposalPoseAt>, t: number) {
  const x = pose.plow - pose.ram;
  ctx.drawImage(getSweeper(), x - 222, FLOOR - 151);
  // Five road wheels plus the track lugs use travelled distance, not wall-clock time.
  for (let i = 0; i < 5; i++) {
    const wx = x - 187 + i * 30;
    ellipse(ctx, wx, FLOOR - 22, 14, 14, '#11232f');
    ellipse(ctx, wx, FLOOR - 22, 10, 10, '#71858b');
    ellipse(ctx, wx, FLOOR - 22, 7, 7, '#2a424d');
    const a = pose.trackDistance / 13 + i * 0.4;
    for (let k = 0; k < 4; k++) {
      const ang = a + k * Math.PI / 2;
      pixelLine(ctx, [wx, FLOOR - 22], [wx + Math.cos(ang) * 8, FLOOR - 22 + Math.sin(ang) * 8], '#b6bfb3', 2);
    }
    px(ctx, wx - 2, FLOOR - 24, 4, 4, '#d2d3ba');
  }
  const cleat = ((pose.trackDistance % 9) + 9) % 9;
  for (let cx = -204 + cleat; cx < -46; cx += 9) {
    px(ctx, x + cx, FLOOR - 5, 6, 3, '#a2aea6');
    px(ctx, x + cx, FLOOR - 39, 6, 3, '#879a97');
  }
  px(ctx, x - 199, FLOOR - 43, 147, 3, '#203541');
  // Articulated hydraulic plow, connected by both a lower linkage and two rams.
  for (const y of [FLOOR - 64, FLOOR - 36]) {
    pixelLine(ctx, [x - 58, y], [pose.plow - 6, y + 3], INK, 9);
    pixelLine(ctx, [x - 57, y], [pose.plow - 9, y + 3], '#8eaaa9', 5);
    pixelLine(ctx, [x - 57, y], [x - 22, y + 1], '#38535e', 7);
    px(ctx, pose.plow - 12, y - 2, 8, 10, '#263e4b');
  }
  polygon(ctx, [[pose.plow - 14, FLOOR - 88], [pose.plow - 5, FLOOR - 91], [pose.plow + 1, FLOOR - 76],
    [pose.plow + 1, FLOOR - 9], [pose.plow - 9, FLOOR - 5], [pose.plow - 15, FLOOR - 14]], INK);
  polygon(ctx, [[pose.plow - 12, FLOOR - 87], [pose.plow - 6, FLOOR - 89], [pose.plow - 2, FLOOR - 75],
    [pose.plow - 2, FLOOR - 11], [pose.plow - 8, FLOOR - 8], [pose.plow - 12, FLOOR - 15]], '#809897');
  px(ctx, pose.plow - 4, FLOOR - 72, 5, 56, '#ac7354');
  px(ctx, pose.plow - 3, FLOOR - 69, 4, 51, '#715443');
  for (let y = FLOOR - 83; y < FLOOR - 16; y += 13) {
    px(ctx, pose.plow - 12, y, 6, 7, '#cead5d');
    px(ctx, pose.plow - 11, y + 1, 2, 2, '#e4d29b');
  }
  const strobe = (Math.sin(t * 6) + 1) / 2;
  px(ctx, x - 110, FLOOR - 146, 11, 6, strobe > 0.6 ? '#f7c56e' : '#9b6b35');
  pixelGlow(ctx, x - 104, FLOOR - 143, 18, '#e7b763', strobe * 0.23);
  if (pose.phase !== 'waiting') {
    for (let i = 0; i < qn(7, 0.5); i++) {
      const age = (t * 0.27 + i / 7) % 1;
      ctx.save(); ctx.globalAlpha = (1 - age) * 0.22;
      ellipse(ctx, x - 182 + age * 21, FLOOR - 129 - age * 43, 3 + age * 10, 3 + age * 7, '#a8b1a7');
      ctx.restore();
    }
  }
}

export function disposalCameraAt(t: number) {
  const push = glide((t - PUSH) / (TIP - PUSH));
  const follow = glide((t - RELEASE) / 1.5);
  const falling = disposalPoseAt(t);
  // Track the actual ballistic pose, not a fixed offset that left CUBE-07 below
  // the frame throughout the final beat. Quintic follow starts at zero velocity.
  return {
    x: lerp(340 + push * 70, falling.x - 70, follow),
    y: lerp(253, falling.y + 30, follow),
    zoom: 0.92 + push * 0.04 - follow * 0.09,
  };
}

export function drawDisposalScene(ctx: CanvasRenderingContext2D, t: number) {
  const p = disposalPoseAt(t), camera = disposalCameraAt(t);
  const set = disposalJob.peek();
  px(ctx, 0, 0, 640, 360, '#283f4c');
  ctx.save();
  ctx.translate(320, 180); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
  if (set) ctx.drawImage(set.sky, 0, 0);
  else { px(ctx, 0, 0, 1024, 640, '#6d929a'); }
  // Thin low clouds drift slowly; foreground vapour sweeps up as the camera follows the fall.
  for (let i = 0; i < qn(8, 0.5); i++) {
    const x = -100 + ((i * 167 + t * 9) % 1300);
    ctx.save(); ctx.globalAlpha = 0.10;
    ellipse(ctx, x, 375 + i % 3 * 65, 105 + i * 3, 12, '#d9e0d0'); ctx.restore();
  }
  if (set) ctx.drawImage(set.bay, 0, 0);
  else px(ctx, 0, FLOOR, EDGE, 75, '#344e5d');

  // Contact shadows stay on the deck, fading as CUBE-07 leaves it.
  ellipse(ctx, p.plow - p.ram - 125, FLOOR - 1, 93, 3, 'rgba(7,21,30,0.45)');
  if (t < RELEASE) ellipse(ctx, Math.min(EDGE - 5, p.x), FLOOR - 1, 39 * (1 - p.rotation * 0.5), 3, 'rgba(7,21,30,0.4)');
  // Bay clipping is only the open portal. A raised door clears the full machine silhouette.
  ctx.save(); ctx.beginPath();
  ctx.rect(DOOR.left, DOOR.top, DOOR.right - DOOR.left, FLOOR - DOOR.top + 1);
  ctx.rect(DOOR.right, 0, 1024 - DOOR.right, 641);
  ctx.clip();
  sweeper(ctx, p, t);
  ctx.restore();

  // The roller door draws in front of the machine but cannot move through it.
  const doorHeight = Math.round((1 - p.door) * (FLOOR - DOOR.top));
  if (doorHeight > 0) {
    ctx.drawImage(rollerShutter(), 0, 0, DOOR.right - DOOR.left, doorHeight,
      DOOR.left, DOOR.top, DOOR.right - DOOR.left, doorHeight);
    px(ctx, DOOR.left, DOOR.top + doorHeight - 4, DOOR.right - DOOR.left, 4, '#243a47');
    for (let x = DOOR.left; x < DOOR.right; x += 13) px(ctx, x, DOOR.top + doorHeight - 3, 7, 2, '#d1ae58');
  }
  for (const x of [-10, 156]) {
    const warn = Math.sin(t * 5) > 0;
    px(ctx, x, 137, 4, 4, warn ? '#f7bf68' : '#6c5336');
    if (warn) pixelGlow(ctx, x + 2, 139, 20, '#dbae5c', 0.2);
  }

  // Wear and sparks exist only where the tread skids on the steel deck.
  if (p.phase === 'push' || p.phase === 'contact') {
    const contactX = p.x - SCALE * 7;
    for (let i = 0; i < qn(12, 0.4); i++) {
      const age = (t * 2.4 + hash(i)) % 1;
      px(ctx, contactX - age * (25 + hash(i * 2) * 28), FLOOR - 2 - Math.sin(age * Math.PI) * (5 + hash(i) * 9),
        1, i % 4 ? 1 : 2, i % 3 ? '#e9be72' : '#fff1c4');
    }
    pixelGlow(ctx, contactX, FLOOR - 2, 24, '#e1a55a', 0.17);
    for (let x = START - 18; x < Math.min(EDGE, p.x - 22); x += 7) px(ctx, x, FLOOR - 2, 5, 1, '#4b5a5a');
  }

  heroRobot(ctx, { x: p.x, y: p.y, s: SCALE, t, state: p.phase === 'fall' ? 'falling' : 'sad',
    chassisMotion: false, rot: p.rotation, eye: t >= CONTACT ? 'surprised' : 'normal',
    drill: false, drillSpin: 0, wheelPhase: p.progress * 11, paintMix: 0.08,
    look: -1, thruster: p.phase === 'fall' && t > RELEASE + 0.3 && t < RELEASE + 1.1 ? 0.12 : 0 });

  if (set) ctx.drawImage(set.foreground, 0, 0);
  if (p.phase === 'fall') {
    const f = glide((t - RELEASE) / 2.2);
    ctx.save(); ctx.globalAlpha = f * 0.34;
    ellipse(ctx, 765, 575, 360, 75, '#c5d1cc');
    ellipse(ctx, 530, 650, 310, 65, '#9eafb2');
    ctx.restore();
  }
  ctx.restore();
  px(ctx, 0, 0, 640, 8, INK); px(ctx, 0, 352, 640, 8, INK);
}