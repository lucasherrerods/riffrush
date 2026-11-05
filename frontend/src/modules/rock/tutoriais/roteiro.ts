/**
 * As demonstrações dos tutoriais: uma pista em miniatura que repete um trecho curto. Cada roteiro diz as notas
 * que caem, o que o jogador aperta e as legendas que acompanham, tudo em segundos dentro do laço.
 */

/** 0 a 4 são os trastes, do verde ao laranja; 5 é a nota aberta. */
export type PistaDaDemo = 0 | 1 | 2 | 3 | 4 | 5;
export const ABERTA: PistaDaDemo = 5;

export interface NotaDaDemo {
  tempo: number;
  pista: PistaDaDemo;
  /** Sem tipo, a nota comum, que pede a palheta. */
  tipo?: "hopo" | "tap";
  /** Segundos de sustain. */
  duracao?: number;
  /** Nota de frase de star power: aparece branca e brilhante. */
  estrela?: boolean;
  /** O que acontece com ela no roteiro: acertada (o padrão) ou perdida. */
  resultado?: "acerto" | "erro";
}

export type EntradaDaDemo =
  | { tempo: number; tipo: "aperta" | "solta"; pista: Exclude<PistaDaDemo, 5> }
  | { tempo: number; tipo: "palheta" }
  /** Palhetada sem nota: a sequência quebra. */
  | { tempo: number; tipo: "palhetaEmVao" }
  | { tempo: number; tipo: "estrela" };

export interface LegendaDaDemo {
  de: number;
  ate: number;
  texto: string;
}

export interface Roteiro {
  /** Duração do laço, em segundos. */
  duracao: number;
  notas: NotaDaDemo[];
  entradas: EntradaDaDemo[];
  legendas: LegendaDaDemo[];
  /** Mostra a palheta embaixo da pista (o jeito Palhetada). */
  comPalheta?: boolean;
}

/** Quanto tempo a nota leva do topo da pista até a linha de acerto. */
export const QUEDA_S = 1.6;
/** Quanto o brilho do acerto ou o X do erro fica na linha. */
const DURACAO_DO_RETORNO = 0.35;
const DURACAO_DA_PALHETADA = 0.12;

export interface NotaNaTela extends NotaDaDemo {
  /** 0 no topo da pista, 1 na linha de acerto; passa de 1 enquanto o sustain desce. */
  posicao: number;
  /** Quanto do sustain ainda está acima da linha, na mesma escala de `posicao`. */
  cauda: number;
  /** Já passou da linha: acertada some na hora, a perdida segue descendo apagada. */
  passou: boolean;
}

export interface EstadoDaDemo {
  notas: NotaNaTela[];
  /** Os trastes apertados agora. */
  apertados: Set<number>;
  /** A palheta acabou de ser tocada. */
  palhetando: boolean;
  /** Brilhos de acerto e marcas de erro ainda na linha, por pista. */
  retornos: { pista: PistaDaDemo; tipo: "acerto" | "erro"; forca: number }[];
  /** A palhetada em vão acabou de acontecer. */
  emVao: boolean;
  estrelaAtiva: boolean;
  legenda: string | null;
  /** Notas acertadas seguidas até agora, para o contador da demo. */
  sequencia: number;
}

/** O que a pista mostra no instante `t` do laço (já dentro de 0 a `duracao`). */
export function estadoNoInstante(roteiro: Roteiro, t: number): EstadoDaDemo {
  const notas: NotaNaTela[] = [];
  for (const nota of roteiro.notas) {
    const duracao = nota.duracao ?? 0;
    const posicao = 1 - (nota.tempo - t) / QUEDA_S;
    const fim = nota.tempo + duracao;
    const passou = t > nota.tempo;
    const acertada = (nota.resultado ?? "acerto") === "acerto";
    // A acertada some na linha, menos o sustain, que fica até acabar; a perdida segue até sair da pista.
    const sumiu = acertada ? t > fim : posicao > 1.25;
    if (posicao < 0 || sumiu) continue;
    const cauda = duracao > 0 ? Math.max(0, (fim - Math.max(t, acertada ? t : nota.tempo)) / QUEDA_S) : 0;
    notas.push({ ...nota, posicao: acertada && passou ? 1 : posicao, cauda, passou });
  }

  const apertados = new Set<number>();
  let estrelaAtiva = false;
  for (const entrada of roteiro.entradas) {
    if (entrada.tempo > t) break;
    if (entrada.tipo === "aperta") apertados.add(entrada.pista);
    else if (entrada.tipo === "solta") apertados.delete(entrada.pista);
    else if (entrada.tipo === "estrela") estrelaAtiva = true;
  }

  const recente = (tempo: number, janela: number) => t >= tempo && t - tempo < janela;
  const palhetando = roteiro.entradas.some((e) => (e.tipo === "palheta" || e.tipo === "palhetaEmVao") && recente(e.tempo, DURACAO_DA_PALHETADA));
  const emVao = roteiro.entradas.some((e) => e.tipo === "palhetaEmVao" && recente(e.tempo, DURACAO_DO_RETORNO * 2));
  const retornos = roteiro.notas
    .filter((n) => recente(n.tempo, DURACAO_DO_RETORNO))
    .map((n) => ({ pista: n.pista, tipo: n.resultado ?? ("acerto" as const), forca: 1 - (t - n.tempo) / DURACAO_DO_RETORNO }));

  // A sequência conta acordes (notas no mesmo instante valem uma) e zera no erro ou na palhetada em vão.
  let sequencia = 0;
  const acontecimentos = [
    ...[...new Set(roteiro.notas.filter((n) => n.tempo <= t).map((n) => n.tempo))].map((tempo) => ({
      tempo,
      erro: roteiro.notas.some((n) => n.tempo === tempo && n.resultado === "erro"),
    })),
    ...roteiro.entradas.filter((e) => e.tipo === "palhetaEmVao" && e.tempo <= t).map((e) => ({ tempo: e.tempo, erro: true })),
  ].sort((a, b) => a.tempo - b.tempo);
  for (const { erro } of acontecimentos) sequencia = erro ? 0 : sequencia + 1;

  const legenda = roteiro.legendas.find((l) => t >= l.de && t < l.ate)?.texto ?? null;
  return { notas, apertados, palhetando, retornos, emVao, estrelaAtiva, legenda, sequencia };
}

/** As entradas de quem toca a nota `pista` em `tempo`: aperta um pouco antes e solta depois (ou no fim do sustain). */
export function tocarNota(tempo: number, pista: Exclude<PistaDaDemo, 5>, { duracao = 0, palheta = false, antes = 0.08 } = {}): EntradaDaDemo[] {
  const entradas: EntradaDaDemo[] = [
    { tempo: tempo - antes, tipo: "aperta", pista },
    { tempo: tempo + Math.max(duracao, 0.12), tipo: "solta", pista },
  ];
  if (palheta) entradas.push({ tempo, tipo: "palheta" });
  return entradas;
}

/** Junta e põe em ordem as entradas de várias notas. */
export const ordenar = (...grupos: EntradaDaDemo[][]) => grupos.flat().sort((a, b) => a.tempo - b.tempo);
