/**
 * Ícones SVG (linha, estilo Lucide) usados na UI — substituem os emojis.
 * Todos herdam `currentColor` por padrão; tamanho e traço configuráveis.
 */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, strokeWidth = 1.8, children, ...p }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      {children}
    </svg>
  );
}

export const IconBell = (p: P) => (
  <Svg {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Svg>
);
export const IconUsers = (p: P) => (
  <Svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
);
export const IconTag = (p: P) => (
  <Svg {...p}><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.2L4 3a1 1 0 0 0-1 1l.2 5.59a2 2 0 0 0 .58 1.41l9.6 9.6a2 2 0 0 0 2.82 0l4.4-4.4a2 2 0 0 0 0-2.82Z" /><circle cx="7.5" cy="7.5" r="1" /></Svg>
);
export const IconActivity = (p: P) => (
  <Svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p} strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p} strokeWidth={2}><path d="M15 18l-6-6 6-6" /></Svg>
);
export const IconPencil = (p: P) => (
  <Svg {...p} strokeWidth={2}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" /></Svg>
);
export const IconNodes = (p: P) => (
  <Svg {...p} strokeWidth={2}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="12" r="2.5" /><path d="M6 8.5V16M8.2 7 15.8 11M8.2 17 15.8 13" /></Svg>
);
export const IconZap = (p: P) => (
  <Svg {...p}><path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" /></Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18" /></Svg>
);
export const IconHexagon = (p: P) => (
  <Svg {...p}><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" /><path d="M12 12 4 7.5M12 12l8-4.5M12 12v9" /></Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p} strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const IconMessage = (p: P) => (
  <Svg {...p} strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-8.8 8.5A9 9 0 1 1 21 11.5Z" /></Svg>
);
export const IconUserPlus = (p: P) => (
  <Svg {...p} strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="m19 8 2 2 4-4" /></Svg>
);
export const IconUser = (p: P) => (
  <Svg {...p} strokeWidth={2}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /></Svg>
);
export const IconX = (p: P) => (
  <Svg {...p} strokeWidth={2}><path d="M18 6 6 18M6 6l12 12" /></Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Svg>
);
export const IconSpinner = (p: P) => (
  <Svg {...p} strokeWidth={2.5}><path d="M12 2a10 10 0 0 1 10 10" /></Svg>
);
export const IconGithub = ({ size = 16, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden {...p}>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);
