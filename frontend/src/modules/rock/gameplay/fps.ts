const JANELA_MS = 500;

export interface LeituraDeFps {
  fps: number;
  /** O intervalo mais longo entre dois quadros da janela: um engasgo aparece aqui mesmo quando a média fica em 60. */
  piorQuadroMs: number;
}

/**
 * Conta quadros por segundo numa janela de meio segundo.
 * `quadro(agora)` recebe o carimbo do requestAnimationFrame e só devolve uma leitura quando a janela fecha; nos outros quadros, null.
 * `reiniciar()` descarta a janela aberta, para o tempo com a aba escondida não virar um quadro lento.
 */
export function criarContadorDeFps() {
  let inicio: number | null = null;
  let anterior = 0;
  let quadros = 0;
  let pior = 0;
  return {
    reiniciar() {
      inicio = null;
      quadros = 0;
      pior = 0;
    },
    quadro(agora: number): LeituraDeFps | null {
      if (inicio === null) {
        inicio = anterior = agora;
        return null;
      }
      quadros++;
      pior = Math.max(pior, agora - anterior);
      anterior = agora;
      const passou = agora - inicio;
      if (passou < JANELA_MS) return null;
      const leitura = { fps: (quadros * 1000) / passou, piorQuadroMs: pior };
      inicio = agora;
      quadros = 0;
      pior = 0;
      return leitura;
    },
  };
}
