import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BALDE_CHEIO, gastarDoBalde, limparTexto } from "@/modules/chat";
import { URL_DO_RELAY, deveEnviarEstado, lerSalasOnline, normalizarCodigo, urlDasSalas, urlParaCriarSala, urlParaEntrarNaSala, type SalaOnline } from "../online";
import type { EstadoDaSalaEmRede, JogadaNaSala, MensagemDaSalaEmRede, PerfilNaSala, ProtocoloDaSala } from "./protocolo";

export const PORTA_DA_SALA = 7777;

/** O modo que o Rock usava antes de existir o Mania: fica de fora do anúncio e das URLs, para as versões antigas. */
export type ModoDaConexao = "rock" | "mania";

export interface InfoDaSala {
  ip: string;
  porta: number;
  endereco: string;
}

export interface SalaEncontrada {
  nome: string;
  ip: string;
  porta: number;
  jogadores: number;
  /** Anúncios das versões antigas não dizem o modo: são do Rock. */
  modo?: string;
}

export interface ConexaoDaSala<Estado> {
  /** null quando o jogador não está em nenhuma sala. */
  sala: Estado | null;
  /** Endereço HTTP do host (para baixar a música compartilhada). */
  endereco: string;
  /** Só para o host da LAN: onde os outros entram. */
  info?: InfoDaSala;
  /** Sala pela internet (relay): o código que os amigos digitam. */
  online?: boolean;
  codigo?: string;
  erro?: string;
}

/** Rodando no navegador servido pelo host (o celular entrou pelo QR code). */
export const ehClienteWebDaSala = () => !("__TAURI_INTERNALS__" in window) && location.port === String(PORTA_DA_SALA);

/** O modo de cada sala na lista; as antigas, sem modo, são do Rock. */
export const daMesmaSala = (modo: ModoDaConexao) => (sala: { modo?: string }) => (sala.modo ?? "rock") === modo;

/**
 * A conexão com a sala de um modo: o WebSocket, o estado guardado para a tela e as ações do lobby.
 * LAN e online falam o mesmo protocolo com o mesmo envelope ({de, msg}); muda só o endereço.
 */
export function criarConexaoDaSala<Escolha extends object, NaRede extends object, P extends PerfilNaSala, J extends JogadaNaSala>(
  protocolo: ProtocoloDaSala<Escolha, NaRede, P, J>,
  modo: ModoDaConexao,
) {
  type Estado = EstadoDaSalaEmRede<Escolha, P, J>;
  type Mensagem = MensagemDaSalaEmRede<NaRede, P, J>;
  type Conexao = ConexaoDaSala<Estado>;

  let conexao: Conexao = { sala: null, endereco: "" };
  let socket: WebSocket | null = null;
  let ultimoEstado = -Infinity;
  /** O mesmo limite que os outros contam ao receber: assim a mensagem é recusada aqui, em vez de sumir lá. */
  let baldeDoChat = BALDE_CHEIO;
  const ouvintes = new Set<() => void>();
  // O Rock não manda o modo: assim continua falando com o servidor e o relay das versões antigas.
  const extraDoModo = modo === "rock" ? {} : { modo };

  function atualizar(parcial: Partial<Conexao>) {
    conexao = { ...conexao, ...parcial };
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  const lerConexao = () => conexao;

  function useConexao() {
    return useSyncExternalStore((ouvinte) => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    }, lerConexao);
  }

  function enviar(mensagens: Mensagem[]) {
    if (socket?.readyState !== WebSocket.OPEN) return;
    for (const mensagem of mensagens) socket.send(JSON.stringify(mensagem));
  }

  /** Aplica uma reação do protocolo: guarda o estado novo e manda o que ela pede. */
  function aplicar(reacao: { estado: Estado; enviar: Mensagem[] }) {
    atualizar({ sala: reacao.estado });
    enviar(reacao.enviar);
  }

  function conectar(urlDoSocket: string, endereco: string, personagem: P, souHost: boolean, extra: Pick<Conexao, "info" | "online"> = {}) {
    const atual = new WebSocket(urlDoSocket);
    socket = atual;
    ultimoEstado = -Infinity;
    atualizar({ sala: protocolo.estadoInicial(personagem, souHost), endereco, info: extra.info, online: extra.online, codigo: undefined, erro: undefined });

    atual.onmessage = (evento) => {
      if (socket !== atual || !conexao.sala) return;
      try {
        const { de, msg } = JSON.parse(evento.data) as { de: number; msg: Mensagem };
        const reacao = protocolo.reduzir(conexao.sala, de, msg, performance.now());
        if (reacao.sair) return sairDaSala(reacao.sair);
        atualizar({ sala: reacao.estado, ...(msg.tipo === "bemVindo" && msg.codigo && { codigo: msg.codigo }) });
        enviar(reacao.enviar);
      } catch {
        // Mensagem estragada: ignora.
      }
    };
    atual.onerror = () => {
      if (socket === atual && conexao.sala?.status === "conectando") sairDaSala(extra.online ? "Não consegui conectar no servidor online." : `Não consegui conectar em ${endereco}.`);
    };
    atual.onclose = () => {
      if (socket === atual && conexao.sala) sairDaSala("A conexão com a sala caiu.");
    };
  }

  async function criarSala(personagem: P) {
    try {
      const info = await invoke<InfoDaSala>("lan_criar_sala", { nome: personagem.nome, ...extraDoModo });
      const endereco = `http://127.0.0.1:${info.porta}`;
      conectar(`ws://127.0.0.1:${info.porta}/ws`, endereco, personagem, true, { info });
    } catch (erro) {
      atualizar({ sala: null, erro: String(erro) });
    }
  }

  function entrarNaSala(endereco: string, personagem: P) {
    conectar(`${endereco.replace(/^http/, "ws")}/ws`, endereco, personagem, false);
  }

  /** `publica` false: a sala não aparece na lista, e só entra quem tem o código. */
  function criarSalaOnline(personagem: P, publica = true) {
    const url = urlParaCriarSala(URL_DO_RELAY, personagem.nome, publica);
    conectar(modo === "rock" ? url : `${url}&modo=${modo}`, "", personagem, true, { online: true });
  }

  /** As salas online abertas agora, só as deste modo. Sem resposta do relay, a lista fica vazia e o código continua funcionando. */
  async function procurarSalasOnline(buscar: typeof fetch = fetch): Promise<SalaOnline[]> {
    try {
      const resposta = await buscar(urlDasSalas(URL_DO_RELAY));
      return resposta.ok ? lerSalasOnline(await resposta.json()).filter(daMesmaSala(modo)) : [];
    } catch {
      return [];
    }
  }

  function entrarNaSalaOnline(texto: string, personagem: P) {
    const codigo = normalizarCodigo(texto);
    if (!codigo) return atualizar({ sala: null, erro: "Esse código não existe. Ele tem 5 letras e números, como K7QXM." });
    conectar(urlParaEntrarNaSala(URL_DO_RELAY, codigo), "", personagem, false, { online: true });
  }

  function sairDaSala(erro?: string) {
    const eraHost = conexao.sala?.souHost;
    const antigo = socket;
    socket = null;
    antigo?.close();
    if (eraHost && !conexao.online) void invoke("lan_fechar_sala").catch(() => {});
    atualizar({ sala: null, info: undefined, online: undefined, codigo: undefined, erro });
  }

  /** Só o host da LAN: deixa o arquivo da escolha em `/musica`, para os convidados baixarem. */
  async function compartilharArquivo(arquivo: Blob) {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    await invoke("lan_compartilhar_musica", bytes, { headers: { "x-tipo": arquivo.type || "application/octet-stream" } });
  }

  /** Só o host: troca a escolha da sala e avisa todos. */
  function escolher(escolha: Escolha) {
    if (!conexao.sala) return;
    aplicar(protocolo.escolher(conexao.sala, escolha));
  }

  /** Só o host: tira o jogador `id` da sala. */
  function expulsar(id: number) {
    if (conexao.sala) aplicar(protocolo.expulsarJogador(conexao.sala, id));
  }

  /** Só o host, no online: passa a liderança para o jogador `id`. Na LAN a sala mora no PC de quem criou. */
  function passarLideranca(id: number) {
    if (conexao.sala && conexao.online) aplicar(protocolo.transferirHost(conexao.sala, id));
  }

  /** O convidado já tem a escolha da sala e está (ou não) pronto para começar. */
  function marcarPronto(pronto: boolean) {
    if (!conexao.sala) return;
    enviar([{ tipo: "pronto", musicaId: protocolo.modo.idDaEscolha(protocolo.escolhaDe(conexao.sala)), pronto }]);
  }

  /** Só o host: dá a largada, se todos estão prontos. */
  function darLargada() {
    if (!conexao.sala?.souHost) return;
    if (!protocolo.todosProntos(conexao.sala)) throw new Error("Espere todos ficarem prontos para começar.");
    enviar(protocolo.comecarPartida(conexao.sala));
  }

  function enviarEstado(estado: J) {
    if (conexao.online) {
      const agora = performance.now();
      if (!deveEnviarEstado(ultimoEstado, agora, estado)) return;
      ultimoEstado = agora;
    }
    enviar([{ tipo: "estado", ...estado } as Mensagem]);
  }

  /** Manda uma mensagem no chat da sala. Devolve false quando passou do limite. */
  function enviarChat(texto: string) {
    const limpo = limparTexto(texto);
    if (!conexao.sala || !limpo) return false;
    const limite = gastarDoBalde(baldeDoChat, performance.now());
    baldeDoChat = limite.balde;
    if (!limite.passa) return false;
    enviar([{ tipo: "chat", texto: limpo }]);
    return true;
  }

  function voltarParaASala() {
    if (conexao.sala?.status === "jogando") atualizar({ sala: { ...conexao.sala, status: "naSala" } });
  }

  function atualizarPersonagem(personagem: P) {
    if (!conexao.sala) return;
    atualizar({ sala: { ...conexao.sala, personagem } });
    enviar([{ tipo: "oi", personagem }]);
  }

  /** As salas da LAN deste modo. */
  async function procurarSalas() {
    return (await invoke<SalaEncontrada[]>("lan_procurar_salas")).filter(daMesmaSala(modo));
  }

  return {
    lerConexao,
    useConexao,
    criarSala,
    entrarNaSala,
    temModoOnline: () => !!URL_DO_RELAY,
    criarSalaOnline,
    procurarSalasOnline,
    entrarNaSalaOnline,
    sairDaSala,
    compartilharArquivo,
    escolher,
    expulsar,
    passarLideranca,
    marcarPronto,
    darLargada,
    enviarEstado,
    enviarChat,
    voltarParaASala,
    atualizarPersonagem,
    procurarSalas,
  };
}

export type ConexaoDoModo = ReturnType<typeof criarConexaoDaSala>;
