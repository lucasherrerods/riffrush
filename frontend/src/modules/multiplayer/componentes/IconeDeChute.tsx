import type { SVGProps } from "react";

/** Bota dando um chute, no traço dos ícones do lucide (o lucide não tem um). */
export function IconeDeChute(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <g transform="rotate(-25 13 12)">
        <path d="M8 3h5v8l6 1.5a2.5 2.5 0 0 1 2 2.5v1H8z" />
        <path d="M8 13h5" />
      </g>
      <path d="M2 9h3M1 13h4M3 17h3" />
    </svg>
  );
}
