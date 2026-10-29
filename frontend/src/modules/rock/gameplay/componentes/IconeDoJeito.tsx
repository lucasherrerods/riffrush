import { Gamepad2, Guitar, Pointer, type LucideIcon } from "lucide-react";
import type { JeitoDeJogar } from "../partida";

export const NOMES_DOS_JEITOS: Record<JeitoDeJogar, string> = { tapping: "Tapping", gamepad: "Gamepad", palhetada: "Palhetada" };
const ICONES: Record<JeitoDeJogar, LucideIcon> = { tapping: Pointer, gamepad: Gamepad2, palhetada: Guitar };

/** O ícone de cada jeito de jogar, o mesmo nas configurações e no ranking. */
export function IconeDoJeito({ jeito, className, rotulo }: { jeito: JeitoDeJogar; className?: string; rotulo?: string }) {
  const Icone = ICONES[jeito];
  return <Icone className={className} aria-label={rotulo} aria-hidden={!rotulo} role={rotulo ? "img" : undefined} />;
}
