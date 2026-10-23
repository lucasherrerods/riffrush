import { marcarComoDoControle, registrarUso } from "./dispositivo";
import { traduzir, type Mapa, type Modo } from "./mapeamento";

interface Opcoes {
  modo: () => Modo;
  mapa: () => Mapa;
}

/** Mais fino que um quadro (~16 ms): o acerto fica com o instante mais preciso. */
const INTERVALO_MS = 5;

/** Lê o controle e transforma os botões em teclas, então todo o jogo funciona sem mudar nada. */
export function iniciarControle({ modo, mapa }: Opcoes) {
  let antes: boolean[] = [];
  let emitidos: string[][] = [];

  const ler = () => {
    const controle = Array.from(navigator.getGamepads?.() ?? []).find((c) => c);
    const agora = controle ? controle.buttons.map((b) => b.pressed) : [];
    const traducao = traduzir(antes, agora, emitidos, modo(), mapa());
    for (const { tipo, code } of traducao.eventos) {
      const evento = new KeyboardEvent(tipo, { code, key: code, bubbles: true, cancelable: true });
      marcarComoDoControle(evento);
      registrarUso("controle");
      window.dispatchEvent(evento);
    }
    antes = agora;
    emitidos = traducao.emitidos;
  };
  const relogio = setInterval(ler, INTERVALO_MS);
  return () => clearInterval(relogio);
}
