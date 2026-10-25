import { lerMensagemDaTransmissao, urlDaTransmissao, type MensagemDaTransmissao } from "./protocolo";

/** Quem assiste fica este tanto atrás de quem joga, para o lote seguinte sempre chegar antes de ser preciso. */
export const ATRASO_AO_VIVO = 2;
/** Mais longe que isso do ponto certo (rede travou, quem joga pausou), a partida de quem assiste recomeça no lugar certo. */
const TOLERANCIA = 1.5;

/** O instante (performance.now) em que a música teria começado para quem assiste ficar `ATRASO_AO_VIVO` atrás. */
export const inicioParaAssistir = (agoraMs: number, ate: number) => agoraMs - (ate - ATRASO_AO_VIVO) * 1000;

export function precisaSincronizar(agoraMs: number, inicioMs: number, ate: number) {
  return Math.abs((agoraMs - inicioMs) / 1000 - (ate - ATRASO_AO_VIVO)) > TOLERANCIA;
}

interface SocketMinimo {
  onmessage: ((evento: { data: string }) => void) | null;
  onclose: ((evento?: { reason?: string }) => void) | null;
  close(): void;
}

/** Abre a transmissão de alguém só para receber. Devolve como fechar. */
export function assistirTransmissao(
  urlDoRelay: string,
  contaId: string,
  aoReceber: (mensagem: MensagemDaTransmissao) => void,
  criarSocket: (url: string) => SocketMinimo = (url) => new WebSocket(url) as unknown as SocketMinimo,
) {
  const socket = criarSocket(urlDaTransmissao(urlDoRelay, contaId));
  let fechada = false;
  socket.onmessage = (evento) => {
    const mensagem = lerMensagemDaTransmissao(evento.data);
    if (mensagem) aoReceber(mensagem);
  };
  // A conexão caiu sem aviso: para quem assiste, é o mesmo que a partida acabar.
  socket.onclose = () => !fechada && aoReceber({ tipo: "fim" });
  return () => {
    fechada = true;
    socket.close();
  };
}
