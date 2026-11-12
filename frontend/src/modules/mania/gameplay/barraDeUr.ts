/** Um toque na barra de UR: o quanto saiu do tempo (negativo é cedo) e quando aconteceu. */
export interface MarcaDeToque {
  desvio: number;
  emMs: number;
}

export const MARCAS_NA_BARRA = 30;
export const DURACAO_DA_MARCA_MS = 3000;

/** Junta os desvios novos às marcas, guardando só as últimas. */
export function guardarMarcas(marcas: MarcaDeToque[], desvios: number[], agoraMs: number): MarcaDeToque[] {
  const todas = [...marcas, ...desvios.map((desvio) => ({ desvio, emMs: agoraMs }))];
  return todas.slice(-MARCAS_NA_BARRA);
}

/** As marcas que ainda aparecem, mais apagadas quanto mais antigas. */
export function marcasVisiveis(marcas: MarcaDeToque[], agoraMs: number) {
  return marcas.flatMap(({ desvio, emMs }) => {
    const alfa = 1 - (agoraMs - emMs) / DURACAO_DA_MARCA_MS;
    return alfa > 0 ? [{ desvio, alfa: Math.min(1, alfa) }] : [];
  });
}

/** De 0 (cedo, no limite da janela) a 1 (tarde); o meio é o tempo certo. */
export function posicaoNaBarra(desvio: number, janela: number) {
  return Math.min(1, Math.max(0, (desvio + janela) / (2 * janela)));
}

/** Quanto cada toque novo puxa a seta: pouco, para ela mostrar a tendência e não pular a cada toque. */
const PESO_DO_TOQUE = 0.15;

/** A média da seta. Só muda com toque novo, então as marcas que somem não a fazem tremer. */
export function mediaSuavizada(media: number | undefined, desvios: number[]): number | undefined {
  let atual = media;
  for (const d of desvios) atual = atual === undefined ? d : atual + (d - atual) * PESO_DO_TOQUE;
  return atual;
}
