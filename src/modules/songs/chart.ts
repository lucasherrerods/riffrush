import type { Nota } from "./tipos";

/** Toda nota com espaço livre até a próxima vira sustain, segurada até um pouco antes dela. */
export function adicionarSustains(notas: Nota[], folgaMinima: number, cauda: number) {
  for (let i = 0; i < notas.length; i++) {
    let proxima = i + 1;
    while (proxima < notas.length && notas[proxima].tempo === notas[i].tempo) proxima++;
    const espaco = (proxima < notas.length ? notas[proxima].tempo : notas[i].tempo + folgaMinima * 2) - notas[i].tempo;
    if (espaco >= folgaMinima) notas[i].duracao = espaco - cauda;
  }
  return notas;
}
