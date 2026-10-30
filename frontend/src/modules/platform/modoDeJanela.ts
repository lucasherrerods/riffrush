export type ModoDeJanela = "janela" | "tela-cheia" | "sem-borda";

export const MODOS_DE_JANELA: { id: ModoDeJanela; rotulo: string }[] = [
  { id: "janela", rotulo: "Janela" },
  { id: "sem-borda", rotulo: "Sem borda" },
  { id: "tela-cheia", rotulo: "Tela cheia" },
];

interface Tamanho {
  largura: number;
  altura: number;
}

/** Área do monitor em pixels físicos (com DPI alto, maior que os pixels CSS). */
export interface Monitor extends Tamanho {
  x: number;
  y: number;
}

const RESOLUCOES: Tamanho[] = [
  { largura: 1280, altura: 720 },
  { largura: 1366, altura: 768 },
  { largura: 1600, altura: 900 },
  { largura: 1920, altura: 1080 },
  { largura: 2560, altura: 1440 },
  { largura: 3840, altura: 2160 },
];

const idDaResolucao = ({ largura, altura }: Tamanho) => `${largura}x${altura}`;

/** As resoluções que cabem no monitor. A menor fica sempre, para a lista nunca vir vazia. */
export function resolucoesDisponiveis(monitor: Tamanho) {
  const cabem = RESOLUCOES.filter((r) => r.largura <= monitor.largura && r.altura <= monitor.altura);
  return (cabem.length ? cabem : RESOLUCOES.slice(0, 1)).map((r) => ({ ...r, id: idDaResolucao(r), rotulo: `${r.largura} × ${r.altura}` }));
}

/** A resolução salva, ou a maior que cabe quando a salva é de um monitor maior. */
export function resolucaoDaJanela(salva: string | null, monitor: Tamanho): Tamanho {
  const opcoes = resolucoesDisponiveis(monitor);
  const escolhida = salva ? opcoes.find((r) => r.id === salva) : opcoes[0];
  const { largura, altura } = escolhida ?? opcoes[opcoes.length - 1];
  return { largura, altura };
}

/** F11 alterna entre a janela e a tela cheia; de sem borda, volta para a janela. */
export const modoDoF11 = (modo: ModoDeJanela): ModoDeJanela => (modo === "janela" ? "tela-cheia" : "janela");

export interface PlanoDaJanela {
  telaCheia: boolean;
  bordas: boolean;
  posicao?: { x: number; y: number };
  tamanho?: Tamanho;
  centralizar: boolean;
}

/** O que fazer com a janela nativa para entrar no modo. Sem monitor conhecido, mexe só na tela cheia e nas bordas. */
export function planoDaJanela(modo: ModoDeJanela, resolucao: string | null, monitor: Monitor | null): PlanoDaJanela {
  if (modo === "tela-cheia") return { telaCheia: true, bordas: true, centralizar: false };
  if (modo === "sem-borda") {
    if (!monitor) return { telaCheia: false, bordas: false, centralizar: false };
    return { telaCheia: false, bordas: false, posicao: { x: monitor.x, y: monitor.y }, tamanho: { largura: monitor.largura, altura: monitor.altura }, centralizar: false };
  }
  // Sem resolução escolhida, a janela fica do tamanho que a pessoa deixou.
  if (!monitor || !resolucao) return { telaCheia: false, bordas: true, centralizar: false };
  return { telaCheia: false, bordas: true, tamanho: resolucaoDaJanela(resolucao, monitor), centralizar: true };
}
