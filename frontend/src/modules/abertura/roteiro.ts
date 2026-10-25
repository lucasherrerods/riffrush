/** Uma capa da abertura: a imagem do álbum ou, sem ela, o gradiente da música. */
export type CapaDaAbertura = { tipo: "imagem"; url: string } | { tipo: "gradiente"; cores: [string, string] };

/** Um corte: a capa que aparece a partir de `inicio`, com o zoom, o giro e o deslocamento dela. */
export interface Corte {
  inicio: number;
  capa: number;
  zoom: number;
  giro: number;
  dx: number;
  dy: number;
}

export const DURACAO = {
  /** As capas trocando, cada vez mais rápido. */
  cortes: 2.6,
  /** O nome aparece com as capas passando dentro das letras. */
  nome: 1.4,
  /** As letras ficam sólidas e tudo some. */
  saida: 0.8,
};
export const DURACAO_TOTAL = DURACAO.cortes + DURACAO.nome + DURACAO.saida;

/** Gradientes para completar quando a biblioteca tem poucas capas. */
const GRADIENTES_EXTRAS: [string, string][] = [
  ["#7f1d1d", "#f97316"],
  ["#1e1b4b", "#db2777"],
  ["#052e16", "#eab308"],
  ["#0c4a6e", "#a855f7"],
  ["#450a0a", "#fde047"],
  ["#111827", "#ef4444"],
];

/** As capas com imagem vêm primeiro; o resto completa até `minimo` com os gradientes das músicas e os extras. */
export function capasDaAbertura(musicas: { imagemDeCapa?: string; capa: [string, string] }[], minimo = 12): CapaDaAbertura[] {
  const imagens: CapaDaAbertura[] = [...new Set(musicas.flatMap((m) => (m.imagemDeCapa ? [m.imagemDeCapa] : [])))].map((url) => ({ tipo: "imagem", url }));
  const gradientes: CapaDaAbertura[] = [...musicas.map((m) => m.capa), ...GRADIENTES_EXTRAS].map((cores) => ({ tipo: "gradiente", cores }));
  const capas = [...imagens];
  for (let i = 0; capas.length < minimo && gradientes.length; i++) capas.push(gradientes[i % gradientes.length]);
  return capas;
}

/** Gerador simples com semente: a mesma semente monta a mesma abertura (e os testes ficam estáveis). */
function sorteador(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Os cortes do começo da abertura até o fim: começam a cada 0,35 s e aceleram até uns 0,06 s,
 * nunca repetindo a mesma capa duas vezes seguidas.
 */
export function roteiroDaAbertura(quantasCapas: number, semente = Date.now()): Corte[] {
  const sortear = sorteador(semente);
  const cortes: Corte[] = [];
  let tempo = 0;
  let anterior = -1;
  while (tempo < DURACAO_TOTAL && quantasCapas > 0) {
    let capa = Math.floor(sortear() * quantasCapas);
    if (capa === anterior && quantasCapas > 1) capa = (capa + 1) % quantasCapas;
    anterior = capa;
    cortes.push({ inicio: tempo, capa, zoom: 1.05 + sortear() * 0.35, giro: (sortear() - 0.5) * 0.3, dx: (sortear() - 0.5) * 0.3, dy: (sortear() - 0.5) * 0.3 });
    const progresso = Math.min(1, tempo / DURACAO.cortes);
    tempo += 0.35 - 0.29 * progresso * progresso;
  }
  return cortes;
}

/** O corte que está na tela no instante `tempo`. */
export function corteNoTempo(cortes: Corte[], tempo: number) {
  let atual = cortes[0];
  for (const corte of cortes) {
    if (corte.inicio > tempo) break;
    atual = corte;
  }
  return atual;
}

/** De 0 a 1, quanto o vermelho já tomou as capas: nada no começo, tudo quando o nome entra. */
export function vermelhoNoTempo(tempo: number) {
  return Math.max(0, Math.min(1, (tempo - DURACAO.cortes * 0.4) / (DURACAO.cortes * 0.6)));
}

const CHAVE = "riffrush:abertura";

/** A abertura passa uma vez por dia, para não cansar quem abre o jogo várias vezes. */
export function deveMostrarAbertura(hoje = new Date()) {
  try {
    return localStorage.getItem(CHAVE) !== hoje.toDateString();
  } catch {
    return true;
  }
}

export function marcarAberturaVista(hoje = new Date()) {
  try {
    localStorage.setItem(CHAVE, hoje.toDateString());
  } catch {
    // Sem armazenamento: a abertura volta na próxima vez.
  }
}
