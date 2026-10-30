/** Expressão de base: um sorriso relaxado de quem está à vontade no palco. */
const PESOS_DE_BASE: Record<string, number> = { relaxed: 0.55 };

const INTERVALO_ENTRE_PISCADAS = 3.7;
const DURACAO_DA_PISCADA = 0.16;

/** Pesos das expressões do VRM (happy, sad, blink…) para o momento atual. */
export function pesosDasExpressoes({ triste, tempo, desdeOPulso }: { triste: boolean; tempo: number; desdeOPulso: number }) {
  const pesos: Record<string, number> = triste ? { sad: 0.8 } : { ...PESOS_DE_BASE };
  if (!triste) {
    const sorriso = Math.exp(-desdeOPulso * 4) * 0.5;
    if (sorriso > 0.01) pesos.happy = Math.max(pesos.happy ?? 0, sorriso);
  }
  const noCiclo = tempo % INTERVALO_ENTRE_PISCADAS;
  if (noCiclo < DURACAO_DA_PISCADA) pesos.blink = Math.sin((noCiclo / DURACAO_DA_PISCADA) * Math.PI);
  return pesos;
}
