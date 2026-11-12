import type { Personagem } from "@/modules/rock/character";
import type { EstadoDoJogador } from "@/modules/rock/gameplay";
import { MUSICAS_EMBUTIDAS, type Dificuldade, type Instrumento } from "@/modules/rock/songs";
import {
  criarProtocolo,
  type EstadoDaSalaEmRede,
  type Jogador as JogadorNaSala,
  type MensagemDaSalaEmRede,
  type MensagemDoChatDaSala,
  type ReacaoDaSala,
} from "@/modules/multiplayer";

export { ATRASO_DO_INICIO_MS, MAXIMO_DE_JOGADORES, todosProntos } from "@/modules/multiplayer";

/**
 * Como uma música viaja na rede: as embutidas pelo id, as importadas pelo arquivo que o host compartilha
 * na LAN, e no online as do Encore pelo endereço de onde cada jogador baixa.
 */
export type MusicaNaRede =
  | { tipo: "embutida"; id: string }
  | { tipo: "importada"; id: string; titulo: string; artista: string; nomeDoArquivo: string; md5DoEncore?: string }
  | { tipo: "encore"; id: string; titulo: string; artista: string; nomeDoArquivo: string; url: string; md5DoEncore?: string };

/** O personagem como viaja na sala: com o nível da conta, quando o jogador está logado. */
export type PersonagemNaSala = Personagem & { nivel?: number };

export type Jogador = JogadorNaSala<PersonagemNaSala>;

/** O host escolhe e todos tocam a mesma música, na mesma dificuldade e no mesmo instrumento. */
interface EscolhaDoRock {
  musica: MusicaNaRede;
  dificuldade: Dificuldade;
  instrumento: Instrumento;
}

/** Sem `instrumento` (versão antiga do jogo), a sala toca na guitarra. O Rock não manda `modo`, para as versões antigas. */
type EscolhaDoRockNaRede = { musica: MusicaNaRede; dificuldade: Dificuldade; instrumento?: Instrumento; modo?: string };

export const protocoloDoRock = criarProtocolo<EscolhaDoRock, EscolhaDoRockNaRede, PersonagemNaSala, EstadoDoJogador>({
  nome: "Rock",
  escolhaInicial: { musica: { tipo: "embutida", id: MUSICAS_EMBUTIDAS[0].id }, dificuldade: "medio", instrumento: "guitarra" },
  idDaEscolha: (escolha) => escolha.musica.id,
  escreverEscolha: (escolha) => escolha,
  lerEscolha: ({ modo, musica, dificuldade, instrumento }) => (modo && modo !== "rock" ? null : { musica, dificuldade, instrumento: instrumento ?? "guitarra" }),
});

export type Mensagem = MensagemDaSalaEmRede<EscolhaDoRockNaRede, PersonagemNaSala, EstadoDoJogador>;
export type MensagemDaSala = MensagemDoChatDaSala;
export type EstadoDaSala = EstadoDaSalaEmRede<EscolhaDoRock, PersonagemNaSala, EstadoDoJogador>;
export type Reacao = ReacaoDaSala<EstadoDaSala, Mensagem>;

export const { estadoInicial, reduzir, expulsarJogador, transferirHost, comecarPartida } = protocoloDoRock;

export function escolherMusica(estado: EstadoDaSala, musica: MusicaNaRede, dificuldade: Dificuldade, instrumento: Instrumento = "guitarra"): Reacao {
  return protocoloDoRock.escolher(estado, { musica, dificuldade, instrumento });
}
