/** O áudio é do app, não de um modo: o Rock e o Mania leem e gravam os mesmos volumes. */
export interface PreferenciasDeAudio {
  /** O volume de tudo (Alt + roda em qualquer tela). Os outros volumes são a mistura dentro dele. */
  volumeGeral: number;
  /** A música da partida e também a que toca nos menus. */
  volumeDaMusica: number;
  volumeDosEfeitos: number;
}

export const PREFERENCIAS_DE_AUDIO_PADRAO: PreferenciasDeAudio = { volumeGeral: 1, volumeDaMusica: 0.8, volumeDosEfeitos: 0.5 };

const CHAVE = "riffrush.audio";
/** Antes de o áudio ser global, os volumes ficavam nas configurações do Rock. */
const CHAVE_ANTIGA = "riffrush.configuracoes";

const ler = (chave: string): Record<string, unknown> => {
  try {
    const lido = JSON.parse(localStorage.getItem(chave) ?? "{}");
    return lido && typeof lido === "object" ? lido : {};
  } catch {
    return {};
  }
};

const volume = (valor: unknown, padrao: number) => (typeof valor === "number" && Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : padrao);

/** Lê os volumes sem confiar no armazenamento: valor quebrado volta ao padrão, fora de 0 a 1 vai ao limite. */
export function lerPreferenciasDeAudio(): PreferenciasDeAudio {
  const lidas = { ...ler(CHAVE_ANTIGA), ...ler(CHAVE) };
  const chaves = Object.keys(PREFERENCIAS_DE_AUDIO_PADRAO) as (keyof PreferenciasDeAudio)[];
  return Object.fromEntries(chaves.map((chave) => [chave, volume(lidas[chave], PREFERENCIAS_DE_AUDIO_PADRAO[chave])])) as unknown as PreferenciasDeAudio;
}

export function guardarPreferenciasDeAudio(parcial: Partial<PreferenciasDeAudio>) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...lerPreferenciasDeAudio(), ...parcial }));
  } catch {
    // Sem armazenamento: os volumes valem só até fechar o jogo.
  }
}
