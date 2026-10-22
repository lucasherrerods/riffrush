import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Personagem } from "@/modules/character";
import type { EstadoDoJogador } from "@/modules/gameplay";
import type { Dificuldade, Musica } from "@/modules/songs";
import { paraRede } from "./musicaNaRede";
import { comecarPartida, escolherMusica, estadoInicial, reduzir, type EstadoDaSala, type Mensagem } from "./protocolo";

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
  /** Só para o host: onde os outros entram. */
  info?: InfoDaSala;
  erro?: string;
}

let conexao: Conexao = { sala: null, endereco: "" };
let socket: WebSocket | null = null;
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

function conectar(endereco: string, personagem: Personagem, souHost: boolean, info?: InfoDaSala) {
  const atual = new WebSocket(`${endereco.replace(/^http/, "ws")}/ws`);
  socket = atual;
  atualizar({ sala: estadoInicial(personagem, souHost), endereco, info, erro: undefined });

  atual.onmessage = (evento) => {
    if (socket !== atual || !conexao.sala) return;
    try {
      const { de, msg } = JSON.parse(evento.data) as { de: number; msg: Mensagem };
      const reacao = reduzir(conexao.sala, de, msg, performance.now());
      if (reacao.sair) return sairDaSala(reacao.sair);
      atualizar({ sala: reacao.estado });
      enviar(reacao.enviar);
    } catch {
      // Mensagem estragada: ignora.
    }
  };
  atual.onerror = () => {
    if (socket === atual && conexao.sala?.status === "conectando") sairDaSala(`Não consegui conectar em ${endereco}.`);
  };
  atual.onclose = () => {
    if (socket === atual && conexao.sala) sairDaSala("A conexão com a sala caiu.");
  };
}

export async function criarSala(personagem: Personagem) {
  try {
    const info = await invoke<InfoDaSala>("lan_criar_sala", { nome: personagem.nome });
    conectar(`http://127.0.0.1:${info.porta}`, personagem, true, info);
  } catch (erro) {
    atualizar({ sala: null, erro: String(erro) });
  }
}

export function entrarNaSala(endereco: string, personagem: Personagem) {
  conectar(endereco, personagem, false);
}

export function sairDaSala(erro?: string) {
  const eraHost = conexao.sala?.souHost;
  const antigo = socket;
  socket = null;
  antigo?.close();
  if (eraHost) void invoke("lan_fechar_sala").catch(() => {});
  atualizar({ sala: null, info: undefined, erro });
}

export function escolher(musica: Musica, dificuldade: Dificuldade) {
  if (!conexao.sala) return;
  const reacao = escolherMusica(conexao.sala, paraRede(musica), dificuldade);
  atualizar({ sala: reacao.estado });
  enviar(reacao.enviar);
}

/** Só o host: compartilha a música importada (se for o caso) e dá a largada para todos. */
export async function comecar(musica: Musica) {
  if (!conexao.sala?.souHost) return;
  if (musica.arquivo) {
    const bytes = new Uint8Array(await musica.arquivo.arrayBuffer());
    await invoke("lan_compartilhar_musica", bytes, { headers: { "x-tipo": musica.arquivo.type || "application/octet-stream" } });
  }
  escolher(musica, conexao.sala.dificuldade);
  enviar(comecarPartida(conexao.sala));
}

export function enviarEstado(estado: EstadoDoJogador) {
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
