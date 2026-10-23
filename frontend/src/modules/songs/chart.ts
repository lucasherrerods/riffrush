import type { NotaDaMelodia } from "./composicao";
import type { Dificuldade, Nota } from "./tipos";

const PISTAS_POR_DIFICULDADE: Record<Dificuldade, number> = { facil: 3, medio: 4, dificil: 5, expert: 5 };

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

function entraNaDificuldade(passo: number, dificuldade: Dificuldade) {
  switch (dificuldade) {
    case "facil":
      return passo % 4 === 0;
    case "medio":
      return passo % 4 === 0 || passo % 8 === 6;
    case "dificil":
      return passo % 2 === 0;
    case "expert":
      return true;
  }
}

/** Transforma a melodia em notas do jogo: a altura da nota decide a pista. */
export function chartDaMelodia(melodia: NotaDaMelodia[], dificuldade: Dificuldade, segundosPorBatida: number): Nota[] {
  const pistas = PISTAS_POR_DIFICULDADE[dificuldade];
  const comAcordes = dificuldade === "dificil" || dificuldade === "expert";
  const notas: Nota[] = [];
  for (const m of melodia) {
    if (!entraNaDificuldade(m.passo, dificuldade)) continue;
    const pista = Math.min(pistas - 1, Math.floor((m.grau / 10) * pistas));
    notas.push({ tempo: m.tempo, pista, frase: m.frase, duracao: 0 });
    if (m.acorde && comAcordes) {
      notas.push({ tempo: m.tempo, pista: pista + 2 < pistas ? pista + 2 : pista - 2, frase: m.frase, duracao: 0 });
    }
  }
  return adicionarSustains(notas, segundosPorBatida * 0.95, segundosPorBatida * 0.4);
}
