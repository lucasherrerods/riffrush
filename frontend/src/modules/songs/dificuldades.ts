import { DIFICULDADES, INSTRUMENTOS, type Dificuldade, type Instrumento, type Musica, type Trilhas } from "./tipos";

const ORDEM = DIFICULDADES.map((d) => d.id);

type ComTrilhas = Pick<Musica, "trilhas" | "dificuldades">;

/** As trilhas da música. Sem elas, o chart é gerado na guitarra, nas quatro dificuldades. */
function trilhasDaMusica({ trilhas, dificuldades }: ComTrilhas): Trilhas {
  if (trilhas && Object.keys(trilhas).length) return trilhas;
  return { guitarra: dificuldades?.length ? dificuldades : ORDEM };
}

/** Os instrumentos que a música tem, na ordem da seleção. */
export function instrumentosDaMusica(musica: ComTrilhas) {
  const trilhas = trilhasDaMusica(musica);
  return INSTRUMENTOS.filter((i) => trilhas[i.id]?.length);
}

/** O instrumento pedido ou, se a música não o tiver, o primeiro que ela tem. */
export function instrumentoDaMusica(musica: ComTrilhas, pedido: Instrumento): Instrumento {
  const tem = instrumentosDaMusica(musica);
  return tem.some((i) => i.id === pedido) ? pedido : tem[0].id;
}

/** As dificuldades que a música tem de verdade no instrumento. */
export function dificuldadesDaMusica(musica: ComTrilhas, instrumento: Instrumento = "guitarra") {
  const dificuldades = trilhasDaMusica(musica)[instrumentoDaMusica(musica, instrumento)]!;
  return DIFICULDADES.filter((d) => dificuldades.includes(d.id));
}

/** A dificuldade pedida ou, se não houver, a mais próxima (empate vai para a mais fácil). */
export function dificuldadeMaisProxima(disponiveis: Dificuldade[], pedida: Dificuldade): Dificuldade | undefined {
  const alvo = ORDEM.indexOf(pedida);
  const distancia = (d: Dificuldade) => Math.abs(ORDEM.indexOf(d) - alvo);
  return [...disponiveis].sort((a, b) => distancia(a) - distancia(b) || ORDEM.indexOf(a) - ORDEM.indexOf(b))[0];
}
