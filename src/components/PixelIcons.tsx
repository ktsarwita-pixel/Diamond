import type { ReactNode } from 'react';

type IconProps = { className?: string };

function Icon({ className = 'h-5 w-5', children, viewBox = '0 0 24 24' }: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      viewBox={viewBox}
      className={`pixelated shrink-0 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function PixelCubeDrillEmblem({ className = 'h-12 w-12' }: IconProps) {
  return (
    <Icon className={className} viewBox="0 0 42 42">
      {/* The treads and suspension are drawn behind the chassis. */}
      <path d="M5 28h23v9H5z" fill="#09080d" />
      <path d="M7 30h19v5H7z" fill="#3a4150" />
      <path d="M7 30h19v1H7z" fill="#8e99a4" />
      <path d="M8 31h3v4H8zm6 0h3v4h-3zm6 0h3v4h-3z" fill="#151923" />
      <path d="M10 32h2v2h-2zm8 0h2v2h-2zm5 0h2v2h-2z" fill="#a0aab4" />
      <path d="M5 8h24v23H5z" fill="#09080d" />
      <path d="M7 10h20v19H7z" fill="#b8541e" />
      <path d="M7 10h20v3H7zm0 3h3v14H7z" fill="#ffbb65" />
      <path d="M10 14h14v12H10z" fill="#e1852f" />
      <path d="M25 13h2v14h-2zM9 27h18v2H9z" fill="#743615" />
      {/* Aether serial and patched, riveted plating. */}
      <path d="M10 22h7v5h-7z" fill="#211c20" />
      <path d="M11 23h5v3h-5z" fill="#cb9b5f" />
      <path d="M11 23h5v1h-5z" fill="#f1cc90" />
      <path d="M8 11h2v2H8zm16 0h2v2h-2zM8 26h2v2H8zm16 0h2v2h-2z" fill="#f9d596" />
      <path d="M19 23h3v1h-3zm0 2h4v1h-4z" fill="#603924" />
      {/* Lamp, antenna and reflective glass. */}
      <path d="M11 5h14v5H11z" fill="#09080d" />
      <path d="M13 6h10v2H13z" fill="#596372" />
      <path d="M17 5h5v4h-5z" fill="#fde296" />
      <path d="M23 2h2v4h-2z" fill="#242b35" />
      <path d="M22 1h4v2h-4z" fill="#fd6370" />
      <path d="M12 15h13v7H12z" fill="#101722" />
      <path d="M13 16h11v1H13z" fill="#416b85" />
      <path d="M15 18h3v3h-3zm6 0h2v3h-2z" fill="#6fd9f2" />
      <path d="M15 18h1v1h-1z" fill="#fffdf0" />
      {/* Joint, hydraulic collar and machined bit. */}
      <path d="M27 16h5v11h-5z" fill="#09080d" />
      <path d="M28 18h3v7h-3z" fill="#788696" />
      <path d="M31 19h5v5h-5z" fill="#09080d" />
      <path d="M32 20h3v3h-3z" fill="#d9e0e2" />
      <path d="M36 18h2v7h-2z" fill="#11121a" />
      <path d="M38 19h2v5h-2z" fill="#11121a" />
      <path d="M40 20h1v3h-1z" fill="#11121a" />
      <path d="M36 19h2v5h-2zm2 1h2v3h-2zm2 1h1v1h-1z" fill="#aeb8c4" />
      <path d="M36 19h1v2h-1zm2 2h1v2h-1zm2 0h1v1h-1z" fill="#fff0ae" />
    </Icon>
  );
}

export function PixelCoinIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M7 1h10v2h3v3h2v12h-2v3h-3v2H7v-2H4v-3H2V6h2V3h3z" fill="#140d12" />
      <path d="M7 3h10v2h3v2h1v10h-1v2h-3v2H7v-2H4v-2H3V7h1V5h3z" fill="#a55919" />
      <path d="M7 3h9v1H7zM5 5h3v2H5zM4 7h2v9H4z" fill="#fff0a0" />
      <path d="M8 5h8v2h3v10h-3v2H8v-2H6V7h2z" fill="#e5aa27" />
      <path d="M8 7h8v1h2v8h-2v1H8v-1H7V8h1z" fill="#f6d368" />
      <path d="M11 8h3v2h2v2h-2v1h-3v1h4v2h-2v2h-2v-2H9v-2h2v-1H9v-3h2z" fill="#9a5b1c" />
      <path d="M7 6h2v2H7zm0 9h1v2H7z" fill="#fff5c7" />
    </Icon>
  );
}

export function PixelHeartIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 3h6v2h4V3h6v2h2v7h-2v3h-3v3h-3v3h-4v-3H7v-3H4v-3H2V5h2z" fill="#0c0b12" />
      <path d="M4 5h6v2h4V5h6v7h-2v3h-3v3H9v-3H6v-3H4z" fill="#912b38" />
      <path d="M5 6h5v2h4V6h5v6h-2v3h-3v2h-4v-2H7v-3H5z" fill="#f46675" />
      <path d="M5 6h4v2H6v3H5zM6 11h2v2H6zM10 16h4v1h-4z" fill="#ffb9ae" />
      <path d="M18 10h1v3h-1zm-3 4h2v1h-2z" fill="#ce394e" />
    </Icon>
  );
}

export function PixelBoltIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M11 1h10v3l-5 5h4v4L9 23H5l3-8H3v-4z" fill="#0d1017" />
      <path d="M12 3h7l-6 7h5v2L8 21l2-8H5z" fill="#208563" />
      <path d="M12 3h5l-6 8h4l-7 9 2-8H6z" fill="#63dda2" />
      <path d="M12 4h2l-5 7H7zM9 14h2l-1 3H9z" fill="#dcffe3" />
    </Icon>
  );
}

export function PixelCrateIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M2 2h20v20H2z" fill="#0d0b10" />
      <path d="M4 4h16v16H4z" fill="#704020" />
      <path d="M5 5h14v14H5z" fill="#b3713b" />
      <path d="M5 5h14v2H5zM5 7h2v12H5z" fill="#e1a365" />
      <path d="M17 7h2v12h-2zM7 17h10v2H7z" fill="#77401f" />
      <path d="M10 5h4v14h-4zM5 10h14v4H5z" fill="#54331e" />
      <path d="M11 6h2v12h-2zM6 11h12v2H6z" fill="#977044" />
      <path d="M6 6h2v2H6zm10 10h2v2h-2z" fill="#f4c27b" />
    </Icon>
  );
}

export function PixelBombIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M11 0h2v4h-2zM9 4h6v2H9z" fill="#0d0b10" />
      <path d="M11 1h2v3h-2z" fill="#956f4a" />
      <path d="M11 1h2v2h-2zM9 0h2v2H9zm5 1h2v1h-2z" fill="#ffe197" />
      <path d="M7 6h10v2h3v3h2v8h-2v3H4v-3H2v-8h2V8h3z" fill="#100d14" />
      <path d="M7 8h10v2h3v9h-2v2H6v-2H4v-9h3z" fill="#8b2632" />
      <path d="M7 9h8v2h3v8H6v-8h1z" fill="#e14a42" />
      <path d="M8 10h5v2H8zM7 12h3v4H7z" fill="#ffad88" />
      <path d="M15 12h2v6h-2zM11 17h6v2h-6z" fill="#aa2c31" />
      <path d="M11 12h2v5h-2zm-2 2h6v2H9z" fill="#fee88f" />
    </Icon>
  );
}

export function PixelTorchIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M10 1h4v3h2v3h2v4h-2v2H8v-2H6V7h2V4h2z" fill="#1b0e12" />
      <path d="M11 2h2v3h2v3h2v3h-3v2h-4v-2H7V8h2V5h2z" fill="#ee5c27" />
      <path d="M11 5h2v3h2v3h-2v2h-2v-2H9V8h2z" fill="#ffbe49" />
      <path d="M11 8h2v4h-2z" fill="#fff4b3" />
      <path d="M9 13h6v10H9z" fill="#0d0b10" />
      <path d="M10 14h4v8h-4z" fill="#815030" />
      <path d="M10 14h1v8h-1z" fill="#c58a4c" />
      <path d="M9 17h6v2H9z" fill="#34343b" />
    </Icon>
  );
}

export function PixelWarpIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M8 1h8v2h3v3h2v12h-2v3h-3v2H8v-2H5v-3H3V6h2V3h3z" fill="#08111b" />
      <path d="M8 3h8v2h3v13h-3v2H8v-2H5V5h3z" fill="#19557c" />
      <path d="M8 5h8v2h2v9h-2v2H8v-2H6V7h2z" fill="#54bbdf" />
      <path d="M10 5h4v3h3v8h-3v2h-4v-2H7V8h3z" fill="#a4edfd" />
      <path d="M10 8h4v3h2v3h-2v3h-4v-3H8v-3h2z" fill="#e8ffff" />
      <path d="M11 3h2v4h-2zm0 13h2v4h-2zM5 10h4v3H5zm10 0h4v3h-4z" fill="#d7faff" />
      <path d="M0 4h3v2H0zm20 13h3v2h-3zM2 20h3v1H2z" fill="#5bbce8" />
    </Icon>
  );
}

export function PixelPlayIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 2h5v2h4v3h4v3h4v4h-4v3h-4v3H9v2H4z" fill="#0e0c13" />
      <path d="M6 5h3v2h4v3h4v4h-4v3H9v2H6z" fill="#f3b94e" />
      <path d="M7 6h2v3h3v3H9v5H7z" fill="#fff2b2" />
    </Icon>
  );
}

export function PixelPauseIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 3h8v18H3zm10 0h8v18h-8z" fill="#0e0c13" />
      <path d="M5 5h4v14H5zm10 0h4v14h-4z" fill="#e0b45d" />
      <path d="M5 5h4v2H5zm10 0h4v2h-4z" fill="#fff2b2" />
    </Icon>
  );
}

export function PixelReplayIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M7 2h11v2h3v3h2v10h-2v3h-3v2H7v-3h11v-2h2V7h-2V5H7v3H3V3h4z" fill="#0c0a11" />
      <path d="M7 4h11v2h2v2h1v8h-1v2h-2v2H9v-2h9v-2h1V8h-1V6H7v4H5V5h2z" fill="#e6bf74" />
      <path d="M8 2h2v10H8zM4 8h8v3H4z" fill="#fff0ba" />
    </Icon>
  );
}

export function PixelSkipIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M1 4h4v2h3v3h3v-5h4v2h3v3h3v-5h3v16h-3v-5h-3v3h-3v2h-4v-5h-3v3H5v2H1z" fill="#0e0c13" />
      <path d="M3 7h3v2h3v6H6v2H3zm10 0h3v2h3v6h-3v2h-3zm8-1h1v12h-1z" fill="#f0c06b" />
      <path d="M3 7h2v5H3zm10 0h2v5h-2z" fill="#fff2be" />
    </Icon>
  );
}

export function PixelRadarIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M11 1h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM11 20h2v3h-2z" fill="#0a121c" />
      <path d="M7 3h10v2h3v3h2v8h-2v3h-3v2H7v-2H4v-3H2V8h2V5h3z" fill="#132a3e" />
      <path d="M7 5h10v2h2v2h1v6h-1v2h-2v2H7v-2H5v-2H4V9h1V7h2z" fill="#0c1825" />
      <path d="M8 8h8v8H8z" fill="#184a6c" />
      <path d="M10 10h4v4h-4z" fill="#38bdf8" />
      <path d="M11 11h2v2h-2z" fill="#ffffff" />
      <path d="M12 6h2v5h-2zM14 8h3v2h-3z" fill="#7dd3fc" />
    </Icon>
  );
}

export function PixelTrophyIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 3h18v2h-2v5h-2v3h-2v3h-2v2h2v2H9v-2h2v-2H9v-3H7v-3H5V5H3zM1 5h2v4H1zm20 0h2v4h-2z" fill="#120c06" />
      <path d="M5 5h14v2h-2v3h-2v3h-2v2h-2v-2H9v-3H7V7H5z" fill="#eab308" />
      <path d="M6 6h12v1H6zm1 2h10v1H7zm1 2h8v1H8zm1 2h6v1H9z" fill="#fde047" />
      <path d="M7 19h10v3H7z" fill="#b45309" />
      <path d="M8 20h8v1H8z" fill="#fef08a" />
    </Icon>
  );
}

export function PixelGearIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M10 1h4v4h-4zM10 19h4v4h-4zM1 10h4v4H1zm18 0h4v4h-4zM4 4h4v3H4zm12 0h4v3h-4zM4 17h4v3H4zm12 0h4v3h-4z" fill="#0d1017" />
      <path d="M6 6h12v12H6z" fill="#475569" />
      <path d="M7 7h10v10H7z" fill="#94a3b8" />
      <path d="M10 10h4v4h-4z" fill="#0d1017" />
      <path d="M11 11h2v2h-2z" fill="#cbd5e1" />
    </Icon>
  );
}

export function PixelFlameIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M11 1h2v3h2v3h2v4h-2v3h2v4h-2v2h-2v2h-4v-2H7v-2H5v-4h2v-3H5V7h2V4h2V2h2z" fill="#1a0a05" />
      <path d="M10 3h4v4h2v5h-2v4h2v2h-2v2H8v-2H6v-4h2V8h2z" fill="#ea580c" />
      <path d="M10 6h3v4h2v4h-2v2H9v-2H7v-4h3z" fill="#f97316" />
      <path d="M10 10h3v4h-1v2h-2v-2h-1z" fill="#fde047" />
      <path d="M11 12h1v2h-1z" fill="#ffffff" />
    </Icon>
  );
}

export function PixelVolumeIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M2 8h4v8H2zM6 8l6-5v18l-6-5z" fill="#090a10" />
      <path d="M3 9h3v6H3zm4 0l4-3v12l-4-3z" fill="#e2e8f0" />
      <path d="M15 7h2v2h-2zm0 8h2v2h-2zm3-6h2v2h-2zm0 4h2v2h-2zm3-4h2v6h-2z" fill="#38bdf8" />
    </Icon>
  );
}

export function PixelVibrateIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M7 2h10v20H7z" fill="#0d1017" />
      <path d="M8 4h8v16H8z" fill="#64748b" />
      <path d="M11 18h2v1h-2zM10 5h4v1h-4z" fill="#cbd5e1" />
      <path d="M2 6h2v12H2zm18 0h2v12h-2zM0 9h2v6H0zm22 0h2v6h-2z" fill="#eab308" />
    </Icon>
  );
}
