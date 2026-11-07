# Sulfured Caves

A playable React and Canvas mining game, based on
https://github.com/ktsarwita-pixel/Diamond.

## Run

```sh
npm install
npm run dev
```

Use the Story button on the title screen to replay the twelve-chapter intro.
The numbered chapter controls let you jump directly to any scene. P pauses,
Left returns to the previous chapter, and Escape skips to the game.

## Pixel-Art Remaster

All visual artwork is drawn procedurally in Canvas. There are no AI-generated
images, photography, downloaded sprite sheets, or external image assets.
Offscreen canvases cache artwork drawn by the same code.

- `src/game/sceneDeparture.ts`: completely new scene 3 departure. The scientists
  walk onto an open personnel tram on one continuous floor. Its safety rail
  closes only after boarding; the carriage then carries both figures away.
  The old airlock, doorway clipping and disappearing-body logic are removed.
- `src/game/sceneDisposal.ts`: a complete disposal-bay scene 4 rebuild. Includes
  a load-bearing deck, roller shutter, a detailed tracked reclamation vehicle,
  connected hydraulic plow, skid contact, and a camera-followed edge fall.
  Tread rotation follows travel distance; the tipping pivot and release
  trajectory share the same position and velocity at the transition.
- `src/game/sceneRift.ts`: scene 12 is now the Sunken Rift, a new 1920 by 960
  pixel location with an 18-second reveal, a continuous limestone ledge,
  full-height flowstone pillars, a wall-rooted sulfur vein, connected streams,
  two-stage cascades and a submerged basin. `sceneCaldera.ts` re-exports its API.
- `src/game/storyWorlds.ts`: rebuilt floating-city, foundry, reclamation dock,
  workshop and outpost environments, with animated utilities and parallax.
- `src/game/cineHumans.ts`: articulated humans shared by cinematics, portraits
  and the in-game NPC animation atlas. Mara, Gus, Ilse and Pip retain their
  existing movement, dialogue and interaction behavior.
- `src/game/outpostArt.ts`: shared refinery, forge, service bay, habitat and
  headframe sprites. Includes conveyors, pouring metal, fans, welding arms,
  crane motion, charging equipment, opening doors and a working lift.
  Visual equipment tiers reflect existing rig upgrades; the economy is unchanged.
- `src/game/pixelCraft.ts`: pixel-exact geometry, material textures and dithered
  lighting. Rock shaders include every silhouette pixel and padded bounds;
  isolated stones use complete irregular contours rather than rectangular fills.
- `src/game/cineKit.ts`: resumable background asset builders keep large
  procedural environments from being rebuilt on every frame.
- `src/game/sceneWorkshop.ts`: scene 8 rebuild bay with a keyed gantry hoist,
  hydraulic lift, IK welding arm and drill installation.

The re-entry, impact, abandoned mine and shaft scenes retain their story beats,
with improved shading, mechanical detail, grounded movement and effects.

Gameplay animation receives the actual collision-floor coordinate. Ground
contact is solved to the floor, not only clamped against penetration. On low
hull, the tread assembly is drawn level and planted independently of the body's
breathing, listing, sleep and wake movement. A resting drill is limited to a
safe downward angle.

The finale's eroded benches are positioned from the actual cliff boundary.
Each boulder's lowest contour point is seated one pixel into a measured bench
surface, rather than into an estimated slope. Tests check supporting geometry
and require the finished cliff layer to be one connected silhouette.

## Main menu

The title screen is a live pixel-art cross-section of the outpost and shaft, with
an expedition console: resume/launch, story, field manual, sound, story quality,
and a two-step save reset. The preview runs at 30 fps (12 fps with reduced motion)
and pauses when the tab is hidden.

## Building animation continuity

Buildings keep per-instance motion state (`id`), so entering or leaving an
interaction zone eases doors, lifts, heat and sign glow toward their new targets
instead of snapping. Off-screen buildings are culled before animation.

## Story quality: HD and LITE

The story player has an **HD / LITE** button in its header (shortcut: **L**).
The choice is saved. Low-power devices start in LITE, and HD switches itself to
LITE if frames average more than 14 ms.

- Both modes: no per-frame pixel read-back, cached glow and vignette sprites,
  and scene changes crossfade from a frozen snapshot instead of re-rendering
  the old scene. Heavy environments build in the background and never block
  playback.
- LITE: 256 x 144 intermediate rendering enlarged with nearest-neighbour pixels,
  painted at about 18 fps. It skips film grain, heat refraction and soft-light
  grading and reduces particles. Story time and sound remain full-rate.

## Building art rules (`src/game/outpostArt.ts`)

Every building is drawn at integer scale with a bitmap pixel font. Every part
is mounted on something: stacks have roof collars, pipes have brackets, hoists
hang on cables, lamps have arms, and legs reach the slab. The regression test
checks that each building's opaque pixels form a single connected piece at
every upgrade tier and animation frame.

## Checks

```sh
npx tsc --noEmit
npm run build
```

`scripts/visual-smoke.mjs` exercises every scene at three points, story playback
controls, pause/resize, all four human walk cycles, all five animated building
types, gameplay interaction zones, movement and both mobile orientations. It
also checks boarding support and rail timing, disposal-plow contact and release
continuity, every low-health tread transform at 1x/3x scale, full boulder
silhouettes, cliff connectivity and continuous finale-camera movement.

With Playwright and its Chromium browser installed, start the development server
and run:

```sh
node scripts/visual-smoke.mjs
```

For a repeatable HD-versus-Lite scene-render benchmark, run
`scripts/story-benchmark.mjs` against the dev server. Set `TEST_URL` to use a
different address. `PLAYWRIGHT_MODULE` may point to an existing Playwright
installation without adding it to the game's runtime dependencies. Tests create
no image assets in the application.