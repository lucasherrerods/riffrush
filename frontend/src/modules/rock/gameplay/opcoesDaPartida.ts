import { ESTILO_PADRAO, SKIN_PADRAO, type EstiloDaCacapa, type SkinDaPista } from "@/modules/rock/skins";
import type { QualidadeDoPalco } from "@/modules/rock/stage";
import type { JeitoDeJogar } from "./partida";

/** O que a partida precisa saber das configurações do jogador. */
export interface OpcoesDaPartida {
  teclas: string[];
  teclaDaEstrela: string;
  rotuloDaTeclaDaEstrela: string;
  /** Com um controle conectado, o nome do botão aparece embaixo de cada traste. */
  rotulosDosTrastes?: string[];
  /** Segundos que a nota leva do horizonte até a linha de batida. */
  antecedencia: number;
  volumeDaMusica: number;
  volumeDosEfeitos: number;
  atrasoMs: number;
  semFalha: boolean;
  /** A nota aberta vira verde. O hash continua o do chart original, então replay, ranking e ao vivo seguem valendo. */
  semAberta: boolean;
  /** Velocidade da música (1 é a normal). */
  velocidadeDaMusica: number;
  /** Como as teclas viram notas. Vai no replay, e a API rejulga com ele. */
  jeitoDeJogar: JeitoDeJogar;
  /** Na palhetada, a tecla que toca o acorde. O direcional do controle chega como `PALHETA_DO_CONTROLE`. */
  teclaDaPalheta: string;
  bot: boolean;
  efeitos: boolean;
  /** Mostra o personagem 3D no palco e no HUD. */
  personagem: boolean;
  mostrarFps: boolean;
  qualidadeDoPalco: QualidadeDoPalco;
  /** Fração da resolução nativa em que a pista é desenhada. */
  escalaDeRenderizacao: number;
  modoCompetitivo: boolean;
  /** Na tela dividida com muitas pistas: só o raio e o pulo, sem brilhos nem explosões. */
  soEfeitosLeves?: boolean;
  /** No desktop, segura as teclas Windows, Alt e Alt+Tab e os atalhos do navegador enquanto se joga. */
  bloquearAtalhos: boolean;
  /** O visual da pista e das notas. */
  skin: SkinDaPista;
  /** O formato e as cores das caçapas e das notas. */
  cacapa: EstiloDaCacapa;
}

export const OPCOES_PADRAO_DA_PARTIDA: OpcoesDaPartida = {
  teclas: ["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL", "KeyD"],
  teclaDaEstrela: "Space",
  rotuloDaTeclaDaEstrela: "Espaço",
  antecedencia: 1.46,
  volumeDaMusica: 0.8,
  volumeDosEfeitos: 0.5,
  atrasoMs: 0,
  semFalha: false,
  semAberta: false,
  velocidadeDaMusica: 1,
  jeitoDeJogar: "gamepad",
  teclaDaPalheta: "Enter",
  bot: false,
  efeitos: true,
  personagem: true,
  mostrarFps: false,
  qualidadeDoPalco: "media",
  escalaDeRenderizacao: 1,
  modoCompetitivo: false,
  bloquearAtalhos: true,
  skin: SKIN_PADRAO,
  cacapa: ESTILO_PADRAO,
};

/** Um jogador da tela dividida: as teclas dele e como reconhecer o que é dele. */
export interface JogadorLocal {
  nome: string;
  opcoes: OpcoesDaPartida;
  aceitaEvento: (evento: Event) => boolean;
}

/** Opções que só mudam o que aparece em volta da pista: trocá-las no meio da partida não a recomeça. */
const SO_DA_TELA: ReadonlySet<keyof OpcoesDaPartida> = new Set(["modoCompetitivo"]);

const iguais = (a: unknown, b: unknown) =>
  Object.is(a, b) || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => Object.is(item, b[i])));

/** Se a troca de `antes` para `depois` muda algo que a partida usa, e ela precisa recomeçar. */
export function reiniciaAPartida(antes: OpcoesDaPartida, depois: OpcoesDaPartida) {
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]) as Set<keyof OpcoesDaPartida>;
  return [...chaves].some((chave) => !SO_DA_TELA.has(chave) && !iguais(antes[chave], depois[chave]));
}
