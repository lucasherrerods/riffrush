export interface Configuracoes {
  /** Códigos das teclas dos 5 trastes (KeyboardEvent.code). */
  teclas: string[];
  teclaDaEstrela: string;
  /** De 1 a 10. */
  velocidade: number;
  volumeDaMusica: number;
  volumeDosEfeitos: number;
  atrasoMs: number;
  semFalha: boolean;
  bot: boolean;
  efeitos: boolean;
}

export const CONFIGURACOES_PADRAO: Configuracoes = {
  teclas: ["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL"],
  teclaDaEstrela: "Space",
  velocidade: 6,
  volumeDaMusica: 0.8,
  volumeDosEfeitos: 0.5,
  atrasoMs: 0,
  semFalha: false,
  bot: false,
  efeitos: true,
};

const CHAVE = "riffrush.configuracoes";
const INDICE_DA_ESTRELA = 5;

export function carregarConfiguracoes(): Configuracoes {
  try {
    return { ...CONFIGURACOES_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) ?? "{}") };
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

/** Troca a tecla de um traste (0 a 4) ou do star power (5). Uma tecla já usada troca de lugar com a antiga. */
export function trocarTecla(configuracoes: Configuracoes, indice: number, codigo: string): Configuracoes {
  if (indice === INDICE_DA_ESTRELA) return { ...configuracoes, teclaDaEstrela: codigo };
  const teclas = [...configuracoes.teclas];
  const ocupada = teclas.indexOf(codigo);
  if (ocupada >= 0) teclas[ocupada] = teclas[indice];
  teclas[indice] = codigo;
  return { ...configuracoes, teclas };
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
