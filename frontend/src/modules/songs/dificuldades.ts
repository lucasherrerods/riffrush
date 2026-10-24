import { DIFICULDADES, type Dificuldade, type Musica } from "./tipos";

const ORDEM = DIFICULDADES.map((d) => d.id);

/** As dificuldades que a música tem de verdade. Sem a lista, o chart é gerado e existe nas quatro. */
export function dificuldadesDaMusica(musica: Pick<Musica, "dificuldades">) {
  const { dificuldades } = musica;
  return dificuldades?.length ? DIFICULDADES.filter((d) => dificuldades.includes(d.id)) : DIFICULDADES;
}

/** A dificuldade pedida ou, se não houver, a mais próxima (empate vai para a mais fácil). */
export function dificuldadeMaisProxima(disponiveis: Dificuldade[], pedida: Dificuldade): Dificuldade | undefined {
  const alvo = ORDEM.indexOf(pedida);
  const distancia = (d: Dificuldade) => Math.abs(ORDEM.indexOf(d) - alvo);
  return [...disponiveis].sort((a, b) => distancia(a) - distancia(b) || ORDEM.indexOf(a) - ORDEM.indexOf(b))[0];
}
