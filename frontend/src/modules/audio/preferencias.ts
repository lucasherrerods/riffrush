import { useSyncExternalStore } from "react";
import { guardarPreferenciasDeAudio, lerPreferenciasDeAudio, type PreferenciasDeAudio } from "./armazenamento";
import { definirVolumeGeral, volumeGeral } from "./volume";

type Mistura = Omit<PreferenciasDeAudio, "volumeGeral">;

const { volumeGeral: _, ...salva } = lerPreferenciasDeAudio();
let mistura: Mistura = salva;
let estadoAtual: PreferenciasDeAudio = { ...mistura, volumeGeral: volumeGeral.estado().volume };
const ouvintes = new Set<() => void>();

function avisar() {
  const geral = volumeGeral.estado().volume;
  if (geral === estadoAtual.volumeGeral && Object.entries(mistura).every(([chave, valor]) => estadoAtual[chave as keyof Mistura] === valor)) return;
  estadoAtual = { ...mistura, volumeGeral: geral };
  for (const ouvinte of ouvintes) ouvinte();
}

// O volume geral também muda pelo Alt + roda, fora daqui.
volumeGeral.inscrever(avisar);

/** Os volumes do app, iguais nos dois modos, para a tela acompanhar com `useSyncExternalStore`. */
export const preferenciasDeAudio = {
  inscrever(ouvinte: () => void) {
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  },
  estado: () => estadoAtual,
};

/** Muda e grava os volumes. O volume geral passa pelo módulo de volume, que liga o ganho mestre. */
export function mudarPreferenciasDeAudio({ volumeGeral: geral, ...parcial }: Partial<PreferenciasDeAudio>) {
  if (Object.keys(parcial).length) {
    mistura = { ...mistura, ...parcial };
    guardarPreferenciasDeAudio(parcial);
  }
  if (geral !== undefined) definirVolumeGeral(geral);
  avisar();
}

export function usePreferenciasDeAudio() {
  return useSyncExternalStore(preferenciasDeAudio.inscrever, preferenciasDeAudio.estado);
}
