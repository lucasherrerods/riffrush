import { BOTAO_DA_ESTRELA_PADRAO, BOTOES_DOS_TRASTES_PADRAO } from "@/modules/gamepad";
import type { QualidadeDoPalco } from "@/modules/rock/stage";

export interface Configuracoes {
  /** Códigos das teclas dos 5 trastes e da nota aberta, nesta ordem (KeyboardEvent.code). */
  teclas: string[];
  teclaDaEstrela: string;
  /** Índices (Gamepad API) dos botões do controle de cada traste e da aberta, na mesma ordem das teclas. */
  botoesDoControle: number[];
  botaoDaEstrela: number;
  /** De 1 a 10. */
  velocidade: number;
  /** De 0 (em pé) a 10 (deitada): o quanto a pista se inclina para o fundo. */
  inclinacaoDaPista: number;
  /** Velocidade da música (1 é a normal). Mais lenta rende menos pontos; mais rápida, mais. */
  velocidadeDaMusica: number;
  /** O volume de tudo (Alt + roda em qualquer tela). Os outros volumes são a mistura dentro dele. */
  volumeGeral: number;
  volumeDaMusica: number;
  volumeDosEfeitos: number;
  /** A música que toca nos menus, separada da música da partida. */
  volumeDoPlayer: number;
  atrasoMs: number;
  semFalha: boolean;
  /** Desligada, a nota aberta vira verde. A partida continua valendo para ranking, replay e ao vivo. */
  notaAberta: boolean;
  bot: boolean;
  efeitos: boolean;
  /** Desligado, o personagem 3D some do palco e do HUD (bom para comparar o desempenho). */
  personagem3d: boolean;
  mostrarFps: boolean;
  qualidadeDoPalco: QualidadeDoPalco;
  /** Só a pista e o placar na partida: sem palco, personagem, clipe nem fundo. */
  modoCompetitivo: boolean;
  /** Aparecer na lista de quem está online. `null` enquanto a pessoa não respondeu: nada liga sem ela aceitar. */
  mostrarOnline: boolean | null;
  /** Quem está online pode assistir às partidas ao vivo. */
  permitirEspectadores: boolean;
  /** O chat global no canto do menu principal (precisa de conta). `null` enquanto a pessoa não leu as regras: nada liga sem ela aceitar. */
  chatGlobal: boolean | null;
}

export const CONFIGURACOES_PADRAO: Configuracoes = {
  teclas: ["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL", "KeyD"],
  teclaDaEstrela: "Space",
  botoesDoControle: BOTOES_DOS_TRASTES_PADRAO,
  botaoDaEstrela: BOTAO_DA_ESTRELA_PADRAO,
  velocidade: 6,
  inclinacaoDaPista: 6,
  velocidadeDaMusica: 1,
  volumeGeral: 1,
  volumeDaMusica: 0.8,
  volumeDosEfeitos: 0.5,
  volumeDoPlayer: 0.3,
  atrasoMs: 0,
  semFalha: false,
  notaAberta: true,
  bot: false,
  efeitos: true,
  personagem3d: true,
  mostrarFps: false,
  qualidadeDoPalco: "media",
  modoCompetitivo: true,
  mostrarOnline: null,
  permitirEspectadores: true,
  chatGlobal: null,
};

const CHAVE = "riffrush.configuracoes";
export const INDICE_DA_ESTRELA = 6;

/** Configurações salvas antes da nota aberta têm só os 5 trastes: a aberta entra com o padrão. */
const completar = <T>(salvos: T[], padrao: T[]) => [...salvos, ...padrao.slice(salvos.length)];

export function carregarConfiguracoes(): Configuracoes {
  try {
    const salvas: Configuracoes = { ...CONFIGURACOES_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) ?? "{}") };
    return { ...salvas, teclas: completar(salvas.teclas, CONFIGURACOES_PADRAO.teclas), botoesDoControle: completar(salvas.botoesDoControle, CONFIGURACOES_PADRAO.botoesDoControle) };
  } catch {
    return CONFIGURACOES_PADRAO;
  }
}

export function salvarConfiguracoes(configuracoes: Configuracoes) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(configuracoes));
  } catch {
    // Sem armazenamento: as configurações valem só até fechar o jogo.
  }
}

/** Troca a tecla de um traste (0 a 4), da nota aberta (5) ou do star power (6). Uma tecla já usada troca de lugar com a antiga. */
export function trocarTecla(configuracoes: Configuracoes, indice: number, codigo: string): Configuracoes {
  if (indice === INDICE_DA_ESTRELA) return { ...configuracoes, teclaDaEstrela: codigo };
  const teclas = [...configuracoes.teclas];
  const ocupada = teclas.indexOf(codigo);
  if (ocupada >= 0) teclas[ocupada] = teclas[indice];
  teclas[indice] = codigo;
  return { ...configuracoes, teclas };
}

/**
 * Troca o botão do controle de um traste (0 a 4), da nota aberta (5) ou do star power (6).
 * Um botão já usado troca de lugar com o antigo, para nenhum botão fazer duas coisas.
 */
export function trocarBotao(configuracoes: Configuracoes, indice: number, botao: number): Configuracoes {
  const botoes = [...configuracoes.botoesDoControle, configuracoes.botaoDaEstrela];
  const ocupado = botoes.indexOf(botao);
  if (ocupado >= 0) botoes[ocupado] = botoes[indice];
  botoes[indice] = botao;
  return { ...configuracoes, botoesDoControle: botoes.slice(0, INDICE_DA_ESTRELA), botaoDaEstrela: botoes[INDICE_DA_ESTRELA] };
}

const PREFIXOS: [RegExp, string][] = [
  [/^Key/, ""],
  [/^Digit/, ""],
  [/^Numpad/, "Num "],
  [/^Arrow/, "Seta "],
];
const SUFIXOS: [RegExp, string][] = [
  [/Left$/, " Esq"],
  [/Right$/, " Dir"],
];

export function nomeDaTecla(codigo: string) {
  if (codigo === "Space") return "Espaço";
  let nome = codigo;
  for (const [padrao, troca] of PREFIXOS) nome = nome.replace(padrao, troca);
  for (const [padrao, troca] of SUFIXOS) nome = nome.replace(padrao, troca);
  return nome.replace(/\s+/g, " ").trim();
}

/** Segundos que uma nota leva do horizonte até a linha de batida. */
export function antecedenciaDasNotas(velocidade: number) {
  return 2.6 - velocidade * 0.19;
}
