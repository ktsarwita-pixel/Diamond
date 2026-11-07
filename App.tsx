import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminConsole } from './components/AdminConsole';
import { Cutscene } from './components/Cutscene';
import { DialogueBox } from './components/DialogueBox';
import { GuideModal } from './components/GuideModal';
import { HudOverlay } from './components/HudOverlay';
import { MobileControls } from './components/MobileControls';
import { NpcBubble } from './components/NpcBubble';
import { OutpostModal } from './components/OutpostModal';
import { PauseModal } from './components/PauseModal';
import {
  PixelBombIcon,
  PixelTorchIcon,
  PixelWarpIcon,
} from './components/PixelIcons';
import { TitleScreen } from './components/TitleScreen';
import { AdminResult, AdminSystem } from './game/admin';
import { OUTPOST_ZONES, SURFACE_Y, TILE_SIZE } from './game/constants';
import { GameEngine } from './game/engine';
import { sound } from './game/sound';
import {
  ConsumableKey,
  HudSnapshot,
  OreId,
  OutpostBuilding,
  UpgradeKey,
} from './game/types';

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const keysHeld = useRef<Set<string>>(new Set());
  const touchVectorRef = useRef<{ mx: number; my: number }>({ mx: 0, my: 0 });
  const touchThrustRef = useRef(false);
  const touchDrillRef = useRef(false);
  const canvasPointerIdRef = useRef<number | null>(null);
  const expeditionStartedRef = useRef(false);

  const [showTitle, setShowTitle] = useState(true);
  const [hasSave, setHasSave] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeOutpost, setActiveOutpost] = useState<OutpostBuilding>(null);
  const [muted, setMuted] = useState(false);
  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => detectTouchDevice());
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const adminRef = useRef<AdminSystem | null>(null);
  const [showCutscene, setShowCutscene] = useState(false);
  const cutsceneActiveRef = useRef(false);
  cutsceneActiveRef.current = showCutscene;
  const [guideOpen, setGuideOpen] = useState(false);
  const [viewportH, setViewportH] = useState<number>(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight
  );
  const storySeen = () => {
    try {
      return localStorage.getItem('sulfured_story_seen') === '1';
    } catch {
      return false;
    }
  };

  const syncCombinedInput = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    const keys = keysHeld.current;
    let kbX = 0;
    let kbY = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) kbX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) kbX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) kbY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) kbY += 1;

    const kbThrust =
      keys.has('KeyW') || keys.has('ArrowUp') || keys.has('Space');
    const kbDrill = keys.has('KeyJ') || keys.has('Enter');

    const tv = touchVectorRef.current;
    eng.input.moveX = Math.abs(tv.mx) > 0.05 ? tv.mx : kbX;
    eng.input.moveY = Math.abs(tv.my) > 0.05 ? tv.my : kbY;
    eng.input.thrustHeld = touchThrustRef.current || kbThrust;
    eng.input.drillHeld = touchDrillRef.current || kbDrill;
  }, []);

  // Initialize Game Engine & Animation Loop
  useEffect(() => {
    const engine = new GameEngine(
      (snapshot) => {
        setHud(snapshot);
      },
      (building) => {
        if (building === 'refinery' || building === 'forge') {
          setActiveOutpost(building);
        }
      }
    );
    engineRef.current = engine;
    adminRef.current = new AdminSystem(engine);
    setHasSave(engine.hasSavedProgress());
    setHud(engine.getHudSnapshot());

    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const canvas = canvasRef.current;
      if (canvas && !cutsceneActiveRef.current) {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.max(1, Math.floor(rect.width * dpr));
        const targetH = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          engine.update(dt, rect.width, rect.height);
          engine.render(ctx, rect.width, rect.height);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      // StrictMode tears down effects once in development before the title is played.
      if (expeditionStartedRef.current) engine.saveGame();
    };
  }, []);

  // Track viewport height for responsive dialogue placement
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Pause engine simulation whenever an overlay (title, outpost, pause, admin) is open
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.paused =
      showTitle || paused || activeOutpost !== null || adminOpen || showCutscene || guideOpen;
  }, [showTitle, paused, activeOutpost, adminOpen, showCutscene, guideOpen]);

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      // Never hijack keys while a text field (admin terminal) has focus
      if (typing) {
        if (e.code === 'Escape' && adminOpen) {
          e.preventDefault();
          setAdminOpen(false);
        }
        return;
      }
      sound.unlock();
      const eng = engineRef.current;
      if (!eng) return;

      if (showCutscene) return;

      if (guideOpen) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setGuideOpen(false);
        }
        return;
      }

      // Admin override terminal hotkeys: ` (backquote), / or F2
      if (e.code === 'Backquote' || e.code === 'Slash' || e.code === 'F2') {
        e.preventDefault();
        setAdminOpen((prev) => !prev);
        return;
      }

      if (adminOpen) {
        // Let the terminal consume all typing except Escape
        if (e.code === 'Escape') {
          e.preventDefault();
          setAdminOpen(false);
        }
        return;
      }

      if (e.code === 'Escape') {
        if (activeOutpost) {
          setActiveOutpost(null);
          return;
        }
        if (!showTitle) {
          setPaused((prev) => !prev);
          return;
        }
      }

      if (showTitle) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (!hasSave && !storySeen()) {
            setShowCutscene(true);
          } else {
            expeditionStartedRef.current = true;
            setShowTitle(false);
          }
        }
        return;
      }

      if (e.code === 'KeyM') {
        const nextMuted = !sound.isMuted();
        sound.setMuted(nextMuted);
        setMuted(nextMuted);
        return;
      }

      if (activeOutpost || paused || adminOpen) return;

      if (e.code === 'KeyE') {
        eng.interactWithNearbyBuilding();
        return;
      }
      if (e.code === 'Digit1') {
        eng.useConsumable('bomb');
        return;
      }
      if (e.code === 'Digit2') {
        eng.useConsumable('torch');
        return;
      }
      if (e.code === 'Digit3') {
        eng.useConsumable('recall');
        return;
      }

      keysHeld.current.add(e.code);
      syncCombinedInput();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.current.delete(e.code);
      syncCombinedInput();
    };

    const onBlur = () => {
      keysHeld.current.clear();
      touchVectorRef.current = { mx: 0, my: 0 };
      touchThrustRef.current = false;
      touchDrillRef.current = false;
      if (engineRef.current) {
        engineRef.current.input.pointerActive = false;
      }
      syncCombinedInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [activeOutpost, adminOpen, guideOpen, hasSave, paused, showCutscene, showTitle, syncCombinedInput]);

  // Canvas Pointer (Mouse & Direct Tap-to-Drill / Click Outpost Buildings)
  const updateCanvasPointer = (clientX: number, clientY: number, isInitialClick: boolean) => {
    const canvas = canvasRef.current;
    const eng = engineRef.current;
    if (!canvas || !eng) return;

    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const worldX = (sx - rect.width / 2) / eng.zoom + eng.camX;
    const worldY = (sy - rect.height / 2) / eng.zoom + eng.camY;

    if (isInitialClick) {
      if (eng.interactNpcAt(worldX, worldY)) {
        return;
      }
      const gx = worldX / TILE_SIZE;
      const gy = worldY / TILE_SIZE;
      if (gy <= SURFACE_Y && gy >= SURFACE_Y - 4) {
        const nearby = eng.getNearbyBuilding();
        if (gx >= OUTPOST_ZONES.REFINERY.startX && gx <= OUTPOST_ZONES.REFINERY.endX) {
          if (nearby === 'refinery') setActiveOutpost('refinery');
          else eng.setBanner('WALK TO THE REFINERY DEPOT TO SELL ORES!', 2.0);
          return;
        }
        if (gx >= OUTPOST_ZONES.FORGE.startX && gx <= OUTPOST_ZONES.FORGE.endX) {
          if (nearby === 'forge') setActiveOutpost('forge');
          else eng.setBanner('WALK TO THE DRILL FORGE TO UPGRADE!', 2.0);
          return;
        }
        if (gx >= OUTPOST_ZONES.REPAIR.startX && gx <= OUTPOST_ZONES.REPAIR.endX) {
          if (nearby === 'repair') eng.instantServiceRefill();
          else eng.setBanner('WALK TO THE SERVICE BAY TO RECHARGE!', 2.0);
          return;
        }
      }
    }

    eng.input.pointerActive = true;
    eng.input.pointerWorldX = worldX;
    eng.input.pointerWorldY = worldY;
  };

  const handleToggleMute = () => {
    const next = !muted;
    sound.setMuted(next);
    setMuted(next);
  };

  const handleToggleTouch = () => {
    setTouchEnabled((prev) => !prev);
  };

  /* ---------- Admin override terminal (password: 123456) ---------- */
  const handleAdminPassword = (password: string): AdminResult => {
    const admin = adminRef.current;
    if (!admin) return { ok: false, message: 'TERMINAL OFFLINE' };
    const result = admin.attemptUnlock(password);
    setAdminUnlocked(result.ok);
    if (result.ok) {
      sound.playUpgrade();
      engineRef.current?.setBanner('ADMIN OVERRIDE ACTIVE', 2.6);
    } else {
      sound.playHurt();
    }
    return result;
  };

  const handleAdminCommand = (command: string): AdminResult => {
    const admin = adminRef.current;
    const eng = engineRef.current;
    if (!admin || !eng) return { ok: false, message: 'TERMINAL OFFLINE' };
    const result = admin.execute(command);
    if (result.ok) sound.playOreCollect(160);
    else sound.playHurt();
    setAdminUnlocked(admin.unlocked);
    setHud(eng.getHudSnapshot());
    return result;
  };

  const handleAdminLock = () => {
    adminRef.current?.lock();
    setAdminUnlocked(false);
    sound.playTorch();
  };

  const handleOpenAdmin = () => {
    sound.unlock();
    setAdminOpen(true);
  };

  const handleNewExpedition = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.resetNewExpedition();
    expeditionStartedRef.current = true;
    setHasSave(true);
    setPaused(false);
    setActiveOutpost(null);
    setShowTitle(false);
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#120f16] select-none">
      {/* Main 2D Pixel-Art Game Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          sound.unlock();
          if (showTitle || paused || activeOutpost || guideOpen) return;
          canvasPointerIdRef.current = e.pointerId;
          updateCanvasPointer(e.clientX, e.clientY, true);
        }}
        onPointerMove={(e) => {
          if (canvasPointerIdRef.current === e.pointerId) {
            updateCanvasPointer(e.clientX, e.clientY, false);
          }
        }}
        onPointerUp={(e) => {
          if (canvasPointerIdRef.current === e.pointerId) {
            canvasPointerIdRef.current = null;
            if (engineRef.current) {
              engineRef.current.input.pointerActive = false;
            }
          }
        }}
        onPointerCancel={(e) => {
          if (canvasPointerIdRef.current === e.pointerId) {
            canvasPointerIdRef.current = null;
            if (engineRef.current) {
              engineRef.current.input.pointerActive = false;
            }
          }
        }}
        className="pixelated touch-none-canvas block h-full w-full cursor-crosshair"
      />

      {/* Active Gameplay HUD */}
      {!showTitle && hud && (
        <HudOverlay
          hud={hud}
          touchEnabled={touchEnabled}
          adminUnlocked={adminUnlocked}
          onOpenGuide={() => {
            sound.playUiTick();
            setGuideOpen(true);
          }}
          onOpenAdmin={handleOpenAdmin}
          onToggleTouch={handleToggleTouch}
          onOpenPause={() => setPaused(true)}
          onOpenOutpost={(b) => setActiveOutpost(b)}
          onQuickSellAll={() => engineRef.current?.sellAllOres()}
          onServiceRefill={() => engineRef.current?.instantServiceRefill()}
        />
      )}

      {/* Mobile Touch Controls */}
      {!showTitle && !paused && !activeOutpost && touchEnabled && hud && (
        <MobileControls
          consumables={hud.consumables}
          onMoveVector={(mx, my) => {
            touchVectorRef.current = { mx, my };
            syncCombinedInput();
          }}
          onThrustChange={(held) => {
            touchThrustRef.current = held;
            syncCombinedInput();
          }}
          onDrillChange={(held) => {
            touchDrillRef.current = held;
            syncCombinedInput();
          }}
          onUseConsumable={(key: ConsumableKey) => {
            sound.unlock();
            engineRef.current?.useConsumable(key);
          }}
        />
      )}

      {/* Desktop Compact Consumables Hotbar (when Touch Pad is OFF) */}
      {!showTitle && !paused && !activeOutpost && !touchEnabled && hud && (
        <div className="pointer-events-auto fixed right-3 bottom-3 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => engineRef.current?.useConsumable('bomb')}
            className="pixel-btn flex items-center gap-1.5 bg-[#2b1d24]/95 px-2.5 py-1.5"
            title="Use Sulfur Charge [1]"
          >
            <PixelBombIcon className="h-4 w-4" />
            <span className="font-pixel text-[9px] text-[#fca5a5]">
              [1] {hud.consumables.bomb}
            </span>
          </button>

          <button
            type="button"
            onClick={() => engineRef.current?.useConsumable('torch')}
            className="pixel-btn flex items-center gap-1.5 bg-[#292418]/95 px-2.5 py-1.5"
            title="Place Cave Flare [2]"
          >
            <PixelTorchIcon className="h-4 w-4" />
            <span className="font-pixel text-[9px] text-[#fef08a]">
              [2] {hud.consumables.torch}
            </span>
          </button>

          <button
            type="button"
            onClick={() => engineRef.current?.useConsumable('recall')}
            className="pixel-btn flex items-center gap-1.5 bg-[#182636]/95 px-2.5 py-1.5"
            title="Surface Warp [3]"
          >
            <PixelWarpIcon className="h-4 w-4" />
            <span className="font-pixel text-[9px] text-[#bae6fd]">
              [3] {hud.consumables.recall}
            </span>
          </button>
        </div>
      )}

      {/* Refinery & Drill Forge Outpost Modal */}
      {!showTitle && activeOutpost && hud && (
        <OutpostModal
          initialTab={activeOutpost}
          hud={hud}
          onClose={() => setActiveOutpost(null)}
          onSellAll={() => engineRef.current?.sellAllOres()}
          onSellOne={(oreId: OreId) => engineRef.current?.sellSingleOre(oreId, 1)}
          onBuyUpgrade={(key: UpgradeKey) => engineRef.current?.buyUpgrade(key)}
          onBuyConsumable={(key: ConsumableKey) =>
            engineRef.current?.buyConsumable(key)
          }
          onServiceRefill={() => engineRef.current?.instantServiceRefill()}
        />
      )}

      {/* Pause Modal */}
      {!showTitle && paused && hud && (
        <PauseModal
          hud={hud}
          muted={muted}
          touchEnabled={touchEnabled}
          adminUnlocked={adminUnlocked}
          onOpenAdmin={handleOpenAdmin}
          onOpenGuide={() => {
            setPaused(false);
            setGuideOpen(true);
          }}
          onReplayStory={() => {
            setPaused(false);
            setShowCutscene(true);
          }}
          onResume={() => setPaused(false)}
          onToggleMute={handleToggleMute}
          onToggleTouch={handleToggleTouch}
          onNewExpedition={handleNewExpedition}
        />
      )}

      {/* NPC chatter over the outpost (responsive DOM overlay, hidden while a story dialogue box is open) */}
      {!showTitle && !showCutscene && !paused && !activeOutpost && !adminOpen && !guideOpen && !hud?.dialogue && hud?.npcBubble && (
        <NpcBubble
          speaker={hud.npcBubble.speaker}
          text={hud.npcBubble.text}
          x={hud.npcBubble.x}
          y={hud.npcBubble.y}
          onNextLine={() => engineRef.current?.cycleNpcLine(hud.npcBubble!.speaker)}
          onDismiss={() => engineRef.current?.dismissNpcBubble()}
        />
      )}

      {/* Story dialogue from the outpost crew */}
      {!showTitle && !showCutscene && !paused && !activeOutpost && !adminOpen && !guideOpen && hud?.dialogue && (
        <DialogueBox
          line={hud.dialogue}
          bottomOffset={touchEnabled ? (viewportH < 470 ? 14 : viewportH < 620 ? 150 : 192) : 58}
          maxWidth={touchEnabled && viewportH < 470 ? '58vw' : undefined}
          onDismiss={() => engineRef.current?.dismissDialogue()}
        />
      )}

      {/* Intro cinematic */}
      {showCutscene && (
        <Cutscene
          onFinish={() => {
            try {
              localStorage.setItem('sulfured_story_seen', '1');
            } catch {
              /* ignore */
            }
            setShowCutscene(false);
            setShowTitle(false);
            expeditionStartedRef.current = true;
            engineRef.current?.snapCameraToPlayer();
            engineRef.current?.saveGame();
            engineRef.current?.setBanner('DRILL DOWN • SELL ORE • UPGRADE YOUR RIG', 5);
          }}
        />
      )}

      {/* Field Manual */}
      {guideOpen && (
        <GuideModal
          touchEnabled={touchEnabled}
          muted={muted}
          onToggleTouch={handleToggleTouch}
          onToggleMute={handleToggleMute}
          onClose={() => setGuideOpen(false)}
          onReplayStory={() => {
            setGuideOpen(false);
            setShowCutscene(true);
          }}
        />
      )}

      {/* Admin Override Terminal (password: 123456) */}
      {adminOpen && (
        <AdminConsole
          unlocked={adminUnlocked}
          onSubmitPassword={handleAdminPassword}
          onExecute={handleAdminCommand}
          onLock={handleAdminLock}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {/* Title Screen Overlay */}
      {showTitle && (
        <TitleScreen
          hasSave={hasSave}
          onOpenAdmin={handleOpenAdmin}
          onOpenGuide={() => setGuideOpen(true)}
          onWatchStory={() => {
            sound.unlock();
            setShowCutscene(true);
          }}
          onStartOrContinue={() => {
            sound.unlock();
            if (!hasSave && !storySeen()) {
              setShowCutscene(true);
              return;
            }
            expeditionStartedRef.current = true;
            setShowTitle(false);
          }}
          onNewExpedition={() => {
            sound.unlock();
            handleNewExpedition();
          }}
        />
      )}
    </div>
  );
}

export default App;
