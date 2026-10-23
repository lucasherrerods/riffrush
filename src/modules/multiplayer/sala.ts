import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Personagem } from "@/modules/character";
import type { EstadoDoJogador } from "@/modules/gameplay";
import type { Dificuldade, Musica } from "@/modules/songs";
import { paraRede } from "./musicaNaRede";
import { URL_DO_RELAY, deveEnviarEstado, lerSalasOnline, normalizarCodigo, podeTocarOnline, urlDasSalas, urlParaCriarSala, urlParaEntrarNaSala, type SalaOnline } from "./online";
import { comecarPartida, escolherMusica, estadoInicial, reduzir, todosProntos, type EstadoDaSala, type Mensagem } from "./protocolo";

export const PORTA_DA_SALA = 7777;

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
}

export interface Conexao {
  /** null quando o jogador não está em nenhuma sala. */
  sala: EstadoDaSala | null;
  /** Endereço HTTP do host (para baixar a música compartilhada). */
  endereco: string;
  /** Só para o host da LAN: onde os outros entram. */
  info?: InfoDaSala;
  /** Sala pela internet (relay): o código que os amigos digitam. */
  online?: boolean;
  codigo?: string;
  erro?: string;
}

let conexao: Conexao = { sala: null, endereco: "" };
let socket: WebSocket | null = null;
let ultimoEstado = -Infinity;
const ouvintes = new Set<() => void>();

function atualizar(parcial: Partial<Conexao>) {
  conexao = { ...conexao, ...parcial };
  ouvintes.forEach((ouvinte) => ouvinte());
}

export const lerConexao = () => conexao;

export function useConexao() {
  return useSyncExternalStore((ouvinte) => {
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
  }, lerConexao);
}

/** Rodando no navegador servido pelo host (o celular entrou pelo QR code). */
export const ehClienteWebDaSala = () => !("__TAURI_INTERNALS__" in window) && location.port === String(PORTA_DA_SALA);

function enviar(mensagens: Mensagem[]) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  for (const mensagem of mensagens) socket.send(JSON.stringify(mensagem));
}

/**
 * Abre a conexão com a sala. LAN e online falam o mesmo protocolo com o mesmo envelope
 * ({de, msg}); muda só o endereço do WebSocket.
 */
function conectar(urlDoSocket: string, endereco: string, personagem: Personagem, souHost: boolean, extra: Pick<Conexao, "info" | "online"> = {}) {
  const atual = new WebSocket(urlDoSocket);
  socket = atual;
  ultimoEstado = -Infinity;
  atualizar({ sala: estadoInicial(personagem, souHost), endereco, info: extra.info, online: extra.online, codigo: undefined, erro: undefined });

  atual.onmessage = (evento) => {
    if (socket !== atual || !conexao.sala) return;
    try {
      const { de, msg } = JSON.parse(evento.data) as { de: number; msg: Mensagem };
      const reacao = reduzir(conexao.sala, de, msg, performance.now());
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

export async function criarSala(personagem: Personagem) {
  try {
    const info = await invoke<InfoDaSala>("lan_criar_sala", { nome: personagem.nome });
    const endereco = `http://127.0.0.1:${info.porta}`;
    conectar(`ws://127.0.0.1:${info.porta}/ws`, endereco, personagem, true, { info });
  } catch (erro) {
    atualizar({ sala: null, erro: String(erro) });
  }
}

export function entrarNaSala(endereco: string, personagem: Personagem) {
  conectar(`${endereco.replace(/^http/, "ws")}/ws`, endereco, personagem, false);
}

export const temModoOnline = () => !!URL_DO_RELAY;

export function criarSalaOnline(personagem: Personagem) {
  conectar(urlParaCriarSala(URL_DO_RELAY, personagem.nome), "", personagem, true, { online: true });
}

/** As salas online abertas agora. Sem resposta do relay, a lista fica vazia e o código continua funcionando. */
export async function procurarSalasOnline(buscar: typeof fetch = fetch): Promise<SalaOnline[]> {
  try {
    const resposta = await buscar(urlDasSalas(URL_DO_RELAY));
    return resposta.ok ? lerSalasOnline(await resposta.json()) : [];
  } catch {
    return [];
  }
}

export function entrarNaSalaOnline(texto: string, personagem: Personagem) {
  const codigo = normalizarCodigo(texto);
  if (!codigo) return atualizar({ sala: null, erro: "Esse código não existe. Ele tem 5 letras e números, como K7QXM." });
  conectar(urlParaEntrarNaSala(URL_DO_RELAY, codigo), "", personagem, false, { online: true });
}

export function sairDaSala(erro?: string) {
  const eraHost = conexao.sala?.souHost;
  const antigo = socket;
  socket = null;
  antigo?.close();
  if (eraHost && !conexao.online) void invoke("lan_fechar_sala").catch(() => {});
  atualizar({ sala: null, info: undefined, online: undefined, codigo: undefined, erro });
}

/** Só o host: troca a música ou a dificuldade da sala. */
export async function escolher(musica: Musica, dificuldade: Dificuldade) {
  if (!conexao.sala?.souHost) return;
  // Na LAN o arquivo importado sai do host: compartilha antes de avisar, para os convidados já poderem baixar.
  if (!conexao.online && musica.arquivo && musica.id !== conexao.sala.musica.id) {
    const bytes = new Uint8Array(await musica.arquivo.arrayBuffer());
    await invoke("lan_compartilhar_musica", bytes, { headers: { "x-tipo": musica.arquivo.type || "application/octet-stream" } });
  }
  if (!conexao.sala) return;
  const reacao = escolherMusica(conexao.sala, paraRede(musica, { online: conexao.online }), dificuldade);
  atualizar({ sala: reacao.estado });
  enviar(reacao.enviar);
}

/** O convidado já tem a música da sala e está (ou não) pronto para começar. */
export function marcarPronto(pronto: boolean) {
  if (!conexao.sala) return;
  enviar([{ tipo: "pronto", musicaId: conexao.sala.musica.id, pronto }]);
}

/** Só o host: compartilha a música importada (se for o caso) e dá a largada para todos. */
export async function comecar(musica: Musica) {
  if (!conexao.sala?.souHost) return;
  if (conexao.online && !podeTocarOnline(musica)) throw new Error("No modo online só dá para tocar músicas do jogo ou baixadas pela Busca músicas.");
  await escolher(musica, conexao.sala.dificuldade);
  if (!conexao.sala) return;
  if (!todosProntos(conexao.sala)) throw new Error("Espere todos ficarem prontos para começar.");
  enviar(comecarPartida(conexao.sala));
}

export function enviarEstado(estado: EstadoDoJogador) {
  if (conexao.online) {
    const agora = performance.now();
    if (!deveEnviarEstado(ultimoEstado, agora, estado)) return;
    ultimoEstado = agora;
  }
  enviar([{ tipo: "estado", ...estado }]);
}

export function voltarParaASala() {
  if (conexao.sala?.status === "jogando") atualizar({ sala: { ...conexao.sala, status: "naSala" } });
}

export function atualizarPersonagem(personagem: Personagem) {
  if (!conexao.sala) return;
  atualizar({ sala: { ...conexao.sala, personagem } });
  enviar([{ tipo: "oi", personagem }]);
}

export function procurarSalas() {
  return invoke<SalaEncontrada[]>("lan_procurar_salas");
}
