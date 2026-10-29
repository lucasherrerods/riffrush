const JANELA_MS = 500;

/**
 * Conta quadros por segundo numa janela de meio segundo.
 * `quadro(agora)` só devolve um número quando a janela fecha; nos outros quadros, null.
 */
export function criarContadorDeFps() {
  let inicio: number | null = null;
  let quadros = 0;
  return {
    quadro(agora: number): number | null {
      if (inicio === null) {
        inicio = agora;
        return null;
      }
      quadros++;
      const passou = agora - inicio;
      if (passou < JANELA_MS) return null;
      const fps = (quadros * 1000) / passou;
      inicio = agora;
      quadros = 0;
      return fps;
    },
  };
}
