/** Números "aleatórios" previsíveis para testes. */
export function geradorAleatorioDeTeste(semente: number) {
  let estado = semente;
  return () => {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    return estado / 2147483648;
  };
}
