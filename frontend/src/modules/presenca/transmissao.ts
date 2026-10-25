import type { EventoDaTransmissao } from "@/modules/gameplay";
import type { Dificuldade, Instrumento } from "@/modules/songs";
import { entradasParaOLote, urlDaTransmissao, type MensagemDaTransmissao } from "./protocolo";

interface SocketMinimo {
  readyState: number;
  onopen: (() => void) | null;
  onclose: ((evento?: { reason?: string }) => void) | null;
  send(texto: string): void;
  close(): void;
}

export interface PartidaParaTransmitir {
  contaId: string;
  /** O id do ranking da música, para quem assiste achar a mesma. */
  musica: string;
  dificuldade: Dificuldade;
  instrumento: Instrumento;
}

export interface DependenciasDaTransmissao {
  urlDoRelay: string;
  pedirFicha: () => Promise<string>;
  criarSocket?: (url: string) => SocketMinimo;
}

const ABERTO = 1;

/**
 * Leva os eventos da partida para o relay. É o melhor esforço: se a ficha ou a conexão falharem,
 * a partida segue normal e só fica sem quem assista.
 */
export function criarTransmissao(partida: PartidaParaTransmitir, deps: DependenciasDaTransmissao) {
  let socket: SocketMinimo | null = null;
  let fila: string[] = [];
  let encerrada = false;
  /** A ficha ou a conexão falharam: o resto da partida não é transmitido. */
  let desistiu = false;

  const despachar = () => {
    if (socket?.readyState !== ABERTO) return;
    for (const texto of fila) socket.send(texto);
    fila = [];
    if (encerrada) socket.close();
  };
  const mandar = (mensagem: MensagemDaTransmissao) => {
    if (desistiu) return;
    fila.push(JSON.stringify(mensagem));
    despachar();
  };

  const abrir = async () => {
    try {
      const ficha = await deps.pedirFicha();
      if (encerrada && fila.length === 0) return;
      const criar = deps.criarSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketMinimo);
      const este = criar(urlDaTransmissao(deps.urlDoRelay, partida.contaId, ficha));
      socket = este;
      este.onopen = despachar;
      // O fechamento da conexão de uma rodada anterior chega depois e não pode derrubar a nova.
      este.onclose = () => {
        if (socket !== este) return;
        socket = null;
        fila = [];
        desistiu = true;
      };
    } catch {
      fila = [];
      desistiu = true;
    }
  };

  return (evento: EventoDaTransmissao) => {
    if (evento.tipo === "inicio") {
      // Recomeçar a música abre uma transmissão nova; quem assiste recebe o início de novo.
      const anterior = socket;
      socket = null;
      anterior?.close();
      fila = [];
      encerrada = false;
      desistiu = false;
      mandar({
        tipo: "inicio",
        partida: { musica: partida.musica, dificuldade: partida.dificuldade, instrumento: partida.instrumento, hashDoChart: evento.hashDoChart, semFalha: evento.semFalha },
      });
      void abrir();
    } else if (evento.tipo === "lote") {
      mandar({ tipo: "lote", ate: evento.ate, entradas: entradasParaOLote(evento.entradas) });
    } else if (evento.tipo === "pausa") {
      mandar({ tipo: "pausa", pausado: evento.pausado });
    } else {
      encerrada = true;
      mandar({ tipo: "fim" });
    }
  };
}
