import React, { useState } from 'react';
import { ORE_LIST, ORES, UPGRADE_ORDER, UPGRADE_TRACKS } from '../game/constants';
import { PixelBombIcon, PixelCoinIcon, PixelCrateIcon, PixelHeartIcon, PixelTorchIcon, PixelWarpIcon } from './PixelIcons';

type GuideTab = 'basics' | 'controls' | 'outpost' | 'survival' | 'story';

interface GuideModalProps {
  onClose: () => void;
  onReplayStory: () => void;
  touchEnabled: boolean;
  onToggleTouch: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

const TABS: Array<{ id: GuideTab; label: string; color: string }> = [
  { id: 'basics', label: 'BASICS', color: '#fde047' },
  { id: 'controls', label: 'CONTROLS', color: '#38bdf8' },
  { id: 'outpost', label: 'OUTPOST', color: '#4ade80' },
  { id: 'survival', label: 'SURVIVAL', color: '#fb7185' },
  { id: 'story', label: 'STORY', color: '#c084fc' },
];

const Key: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => (
  <kbd
    className={`inline-flex h-6 items-center justify-center rounded-none border-2 border-[#09070d] bg-[#2a2438] px-1.5 font-pixel text-[8px] text-[#f5eedc] shadow-[inset_1px_1px_0_#4a4060,0_2px_0_#09070d] ${
      wide ? 'min-w-[58px]' : 'min-w-[24px]'
    }`}
  >
    {children}
  </kbd>
);

const Section: React.FC<{ title: string; color: string; children: React.ReactNode }> = ({ title, color, children }) => (
  <section className="border-2 border-[#09070d] bg-[#17141f]">
    <h4 className="border-b-2 border-[#09070d] px-2.5 py-1.5 font-pixel text-[9px]" style={{ color }}>
      {title}
    </h4>
    <div className="px-2.5 py-2">{children}</div>
  </section>
);

const Row: React.FC<{ keys?: React.ReactNode; children: React.ReactNode }> = ({ keys, children }) => (
  <div className="flex items-start gap-2 border-b border-[#262033] py-1.5 last:border-0">
    {keys && <div className="flex shrink-0 flex-wrap items-center gap-1">{keys}</div>}
    <span className="font-retro min-w-0 text-base leading-snug text-[#d7d1e0]">{children}</span>
  </div>
);

export const GuideModal: React.FC<GuideModalProps> = ({
  onClose,
  onReplayStory,
  touchEnabled,
  onToggleTouch,
  muted,
  onToggleMute,
}) => {
  const [tab, setTab] = useState<GuideTab>('basics');

  return (
    <div className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="animate-panel pixel-panel flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b-4 border-[#09070d] bg-[#13101a] px-2.5 py-2 sm:px-3">
          <div className="min-w-0">
            <div className="font-pixel text-[10px] text-[#fde047] sm:text-xs">FIELD MANUAL</div>
            <div className="font-retro truncate text-sm text-[#8b8496] sm:text-base">
              Everything CUBE-07 needs to know
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn h-9 shrink-0 bg-[#991b1b] px-2.5 font-pixel text-xs text-white"
            aria-label="Close guide"
          >
            X
          </button>
        </div>

        {/* Tabs — horizontally scrollable, never wraps off-panel */}
        <div className="pixel-scroll flex shrink-0 gap-1.5 overflow-x-auto border-b-2 border-[#09070d] bg-[#100d16] px-2 py-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`pixel-btn shrink-0 px-2.5 py-2 font-pixel text-[9px] transition-colors sm:text-[10px] ${
                tab === t.id ? 'text-[#09070d]' : 'bg-[#241f2e] text-[#94a3b8]'
              }`}
              style={tab === t.id ? { backgroundColor: t.color } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="pixel-scroll min-h-0 flex-1 overscroll-contain overflow-y-auto p-2 sm:p-3">
          <div key={tab} className="animate-tab flex flex-col gap-2.5">
            {tab === 'basics' && (
              <>
                <div className="pixel-panel-sulfur flex flex-wrap items-center gap-2 p-2.5">
                  <PixelCoinIcon className="h-5 w-5" />
                  <p className="font-retro flex-1 text-base leading-snug text-[#ece6cf]">
                    You are <span className="text-[#fde047]">CUBE-07</span>, an obsolete Aether mining unit
                    rebuilt from scrap. Dig ore, haul it up, sell it, and upgrade until you reach the Heart of
                    Sulfur.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { n: '1', t: 'DRILL', c: '#fbbf24', d: 'Drive into rock or point at an adjacent block. Hold the drill to bore deeper.' },
                    { n: '2', t: 'SELL', c: '#4ade80', d: 'Fly back to the Refinery on the surface. Watch the Market Surge bonus.' },
                    { n: '3', t: 'UPGRADE', c: '#38bdf8', d: 'Spend credits at the Drill Forge on drill, thrusters, cargo, energy and hull.' },
                  ].map((s) => (
                    <div key={s.n} className="border-2 border-[#09070d] bg-[#17141f] p-2">
                      <div className="font-pixel text-[10px]" style={{ color: s.c }}>
                        {s.n}. {s.t}
                      </div>
                      <div className="font-retro mt-1 text-base leading-snug text-[#c5bfd0]">{s.d}</div>
                    </div>
                  ))}
                </div>

                <Section title="READING THE HUD" color="#fde047">
                  <Row keys={<PixelCoinIcon className="h-4 w-4" />}>Credits — spend these at the Forge.</Row>
                  <Row keys={<span className="font-pixel text-[9px] text-[#7dd3fc]">m</span>}>
                    Depth in meters. Deeper strata hold rarer ore — and worse hazards.
                  </Row>
                  <Row keys={<PixelHeartIcon className="h-4 w-4" />}>
                    Hull HP. At zero, a rescue drone hauls you back to the Service Bay.
                  </Row>
                  <Row keys={<span className="font-pixel text-[9px] text-[#4ade80]">⚡</span>}>
                    Energy. Drilling and thrusters drain it; it refills slowly on the surface.
                  </Row>
                  <Row keys={<PixelCrateIcon className="h-4 w-4" />}>
                    Cargo slots. Full cargo = no more pickups until you sell.
                  </Row>
                </Section>

                <Section title="THE STRATA" color="#fbbf24">
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {[
                      ['Ash & Topsoil', '0–35 m', '#b5845c'],
                      ['Sulfur Limestone', '36–85 m', '#d9cf38'],
                      ['Brimstone Basalt', '86–140 m', '#a864e8'],
                      ['Abyssal Obsidian', '141–185 m', '#4f86ff'],
                      ['The Sulfured Core', '186 m +', '#ff7729'],
                    ].map(([name, depth, c]) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 border border-[#09070d]" style={{ backgroundColor: c }} />
                        <span className="font-retro text-base text-[#d7d1e0]">{name}</span>
                        <span className="font-retro ml-auto text-sm text-[#8b8496]">{depth}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {tab === 'controls' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onToggleTouch}
                    className={`pixel-btn py-2.5 font-pixel text-[9px] ${touchEnabled ? 'bg-[#4d7c0f] text-[#ecfccb]' : 'bg-[#2a2438] text-[#cbd5e1]'}`}
                  >
                    TOUCH PAD {touchEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className={`pixel-btn py-2.5 font-pixel text-[9px] ${!muted ? 'bg-[#0369a1] text-[#e0f2fe]' : 'bg-[#2a2438] text-[#cbd5e1]'}`}
                  >
                    AUDIO {muted ? 'MUTED' : 'ON'}
                  </button>
                </div>

                <Section title="KEYBOARD & MOUSE" color="#38bdf8">
                  <Row keys={<><Key>A</Key><Key>D</Key><Key>◀</Key><Key>▶</Key></>}>Move left / right</Row>
                  <Row keys={<><Key>W</Key><Key>▲</Key><Key wide>SPACE</Key></>}>Jetpack thrusters (drains energy)</Row>
                  <Row keys={<><Key>S</Key><Key>▼</Key></>}>Aim drill down / descend</Row>
                  <Row keys={<><Key wide>HOLD CLICK</Key></>}>Aim and drill the block under the cursor</Row>
                  <Row keys={<><Key>J</Key><Key wide>ENTER</Key></>}>Drill in the facing direction</Row>
                  <Row keys={<Key>E</Key>}>Interact with Refinery / Forge / Service Bay</Row>
                  <Row keys={<><Key>1</Key><Key>2</Key><Key>3</Key></>}>Sulfur Charge / Cave Flare / Surface Warp</Row>
                  <Row keys={<Key>M</Key>}>Mute audio</Row>
                  <Row keys={<Key wide>` / F2</Key>}>Admin override terminal</Row>
                </Section>

                <Section title="TOUCH CONTROLS" color="#4ade80">
                  <Row keys={<span className="font-pixel text-[9px] text-[#fbbf24]">STICK</span>}>
                    Drag the left thumbstick to steer and drill in that direction.
                  </Row>
                  <Row keys={<span className="font-pixel text-[9px] text-[#38bdf8]">FLY</span>}>
                    Hold to fire the jetpack. Release to fall.
                  </Row>
                  <Row keys={<span className="font-pixel text-[9px] text-[#fbbf24]">DRILL</span>}>
                    Hold to bore the block you are facing. Faster with drill upgrades.
                  </Row>
                  <Row keys={<span className="font-pixel text-[9px] text-[#c084fc]">TAP</span>}>
                    Tap an adjacent block on the canvas to drill it directly.
                  </Row>
                  <Row>Tap the surface buildings to open the Refinery or Forge.</Row>
                  <Row>Toggle <span className="text-[#fde047]">PAD</span> in the HUD to hide/show the touch controls.</Row>
                </Section>

                <div className="border-2 border-[#09070d] bg-[#141a22] p-2">
                  <div className="font-retro text-base leading-snug text-[#a5c8e0]">
                    <span className="text-[#7dd3fc]">Tip:</span> the drill arm follows your pointer or your
                    movement direction. Hold a direction against a wall to drill straight into it.
                  </div>
                </div>
              </>
            )}

            {tab === 'outpost' && (
              <>
                <Section title="REFINERY DEPOT" color="#fbbf24">
                  <div className="font-retro text-base leading-snug text-[#d7d1e0]">
                    Sell single ores or the whole hold. One ore is always marked{' '}
                    <span className="text-[#fde047]">MARKET SURGE</span> and pays{' '}
                    <span className="text-[#fde047]">+35%</span>. The surge rotates every two minutes — save
                    that ore for the right moment.
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {ORE_LIST.map((o) => (
                      <div key={o.id} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 border border-[#09070d]" style={{ backgroundColor: o.color }} />
                        <span className="font-retro truncate text-sm text-[#bdb6c8]">{o.name}</span>
                        <span className="font-retro ml-auto text-sm text-[#fde047]">${o.baseValue}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="DRILL FORGE — UPGRADES" color="#38bdf8">
                  <div className="flex flex-col gap-1.5">
                    {UPGRADE_ORDER.map((k) => {
                      const tr = UPGRADE_TRACKS[k];
                      return (
                        <div key={k} className="border-l-4 bg-[#14111c] pl-2" style={{ borderColor: tr.accentColor }}>
                          <div className="font-pixel text-[9px]" style={{ color: tr.accentColor }}>
                            {tr.name}
                          </div>
                          <div className="font-retro text-sm leading-snug text-[#a9a3b8]">{tr.shortDesc}</div>
                        </div>
                      );
                    })}
                  </div>
                </Section>

                <Section title="SUPPLIES" color="#c084fc">
                  <Row keys={<PixelBombIcon className="h-4 w-4" />}>Sulfur Charge — blasts a 5×5 area. Great for hard rock.</Row>
                  <Row keys={<PixelTorchIcon className="h-4 w-4" />}>Cave Flare — permanent light where you place it.</Row>
                  <Row keys={<PixelWarpIcon className="h-4 w-4" />}>Surface Warp — instant trip home with a full hold.</Row>
                </Section>

                <Section title="SERVICE BAY" color="#4ade80">
                  <div className="font-retro text-base leading-snug text-[#d7d1e0]">
                    Stand beneath the green cross building to refill hull and energy for free. Surface energy
                    also regenerates on its own, and the bay repairs damage over time.
                  </div>
                </Section>
              </>
            )}

            {tab === 'survival' && (
              <>
                <Section title="HAZARDS" color="#fb7185">
                  <Row keys={<span className="h-3 w-3 border border-black bg-[#ea580c]" />}>
                    <span className="text-[#fdba74]">Magma crust</span> — touching it burns hull. Break it from a
                    distance or use a charge.
                  </Row>
                  <Row keys={<span className="h-3 w-3 border border-black bg-[#d9f926]" />}>
                    <span className="text-[#e6f56a]">Pressurized sulfur pockets</span> — burst into a toxic cloud
                    that drains hull. Back off and let it clear.
                  </Row>
                  <Row keys={<Key>▲</Key>}>Long falls hurt. Land with thrusters or avoid big drops.</Row>
                  <Row keys={<PixelCrateIcon className="h-4 w-4" />}>
                    A full cargo stops pickups — ores stay on the ground until you clear space.
                  </Row>
                </Section>

                <Section title="STAYING ALIVE" color="#4ade80">
                  <div className="font-retro flex flex-col gap-1 text-base leading-snug text-[#d7d1e0]">
                    <div>• Hull at 0 → immediate rescue to the Service Bay (no credits lost).</div>
                    <div>• Energy at 0 while stranded → rescue drone deploys.</div>
                    <div>• Cave Flares make deep trips far safer — place them as you descend.</div>
                    <div>• The Optic upgrade widens light and pings hidden ore veins.</div>
                    <div>• Upgrade drills to break harder strata: Basalt needs Mk.II, Obsidian Mk.III, Mythril Mk.IV.</div>
                  </div>
                </Section>

                <Section title="DEPTH REWARDS" color="#fbbf24">
                  <div className="font-retro flex flex-col gap-1 text-base leading-snug text-[#d7d1e0]">
                    <div>• Rare ores live in narrow depth bands — check the Refinery prices.</div>
                    <div>• The Heart of Sulfur is the richest ore, deep in the Sulfured Core.</div>
                    <div>• Market Surge applies to one ore at a time, rotating on a timer.</div>
                  </div>
                </Section>
              </>
            )}

            {tab === 'story' && (
              <>
                <div className="border-2 border-[#09070d]">
                  <div className="hazard-stripe h-2 w-full" />
                  <div className="bg-[#140f1e] p-3">
                    <h3 className="font-pixel text-xs leading-snug text-[#fde047] sm:text-sm">THE FALL OF CUBE-07</h3>
                    <p className="font-retro mt-1.5 text-base leading-snug text-[#d7d1e0] sm:text-lg">
                      CUBE-07 was built in the floating city of <span className="text-[#a5f3fc]">Aether</span> in
                      2200, when humanity lived above a poisoned Earth. By 2245 the city&rsquo;s technology had
                      advanced far beyond its old mining units — and CUBE-07 was declared obsolete and swept off
                      the edge of the sky.
                    </p>
                    <p className="font-retro mt-1.5 text-base leading-snug text-[#d7d1e0] sm:text-lg">
                      It survived the fall, barely. Broken and alone, it found the rusted ruins of an old human
                      mining project and rebuilt itself from leftover parts. But the outpost was not abandoned:
                      the surviving humans emerged from their bunkers and made a deal. Parts and repairs, in
                      exchange for the ore beneath their feet.
                    </p>
                    <p className="font-retro mt-1.5 text-base leading-snug text-[#d7d1e0] sm:text-lg">
                      Now CUBE-07 works the <span className="text-[#fde047]">Sulfured Caves</span> — digging,
                      selling, upgrading, and looking for the Heart of Sulfur that once powered Aether itself.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    ['MARA', 'Refinery Elder', '#fbbf24', 'Trades ore for credits and remembers what the sky city forgot.'],
                    ['GUS', 'Forge Mechanic', '#38bdf8', 'Bolt-on specialist. Turns scrap into military-grade drill bits.'],
                    ['DOC ILSE', 'Service Bay Medic', '#4ade80', 'Patches hulls, frets about cave gas, fixes you anyway.'],
                    ['PIP', 'Outpost Kid', '#fb923c', 'Wants to be a miner. Cheers loudest when you find something shiny.'],
                  ].map(([n, role, c, d]) => (
                    <div key={n} className="border-2 border-[#09070d] bg-[#17141f] p-2">
                      <div className="font-pixel text-[9px]" style={{ color: c as string }}>{n}</div>
                      <div className="font-retro text-sm text-[#8b8496]">{role}</div>
                      <div className="font-retro mt-0.5 text-base leading-snug text-[#bdb6c8]">{d}</div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={onReplayStory} className="pixel-btn w-full bg-[#2a1d30] py-3 font-pixel text-[10px] text-[#fbcfe8]">
                  ▶ REPLAY THE CINEMATIC
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t-2 border-[#09070d] bg-[#100d16] px-2.5 py-2">
          <span className="font-retro min-w-0 truncate text-sm text-[#6f6880]">
            {ORES.sulfur.name} pays ${ORES.sulfur.baseValue}
            <span className="hidden sm:inline"> — buy low, dig deep.</span>
          </span>
          <button type="button" onClick={onClose} className="pixel-btn shrink-0 bg-[#2a2438] px-3 py-1.5 font-pixel text-[9px] text-[#cbd5e1]">
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
