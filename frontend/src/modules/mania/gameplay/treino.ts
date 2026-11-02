import { trechosDaMusica, type Batida, type Secao, type Trecho } from "@/shared/lib/treino";

/** As linhas de cada seção do .osu ("[Editor]", "[HitObjects]"...), sem as vazias. */
function secoesDoOsu(texto: string) {
  const secoes = new Map<string, string[]>();
  let atual = "";
  for (const linha of texto.split(/\r?\n/).map((l) => l.trim())) {
    const cabecalho = linha.match(/^\[(.+)\]$/);
    if (cabecalho) secoes.set((atual = cabecalho[1]), []);
    else if (linha && !linha.startsWith("//")) secoes.get(atual)?.push(linha);
  }
  return secoes;
}

const tempoDaNota = (linha: string) => Number(linha.split(",")[2]) / 1000;

/** Os tempos fortes saem dos pontos de tempo não herdados: batida a cada beatLength, compasso a cada `meter` batidas. */
function batidasDoMapa(pontos: string[], duracao: number): Batida[] {
  const proprios = pontos
    .map((linha) => linha.split(",").map(Number))
    .filter(([, duracaoDaBatida, , , , , herdado]) => duracaoDaBatida > 0 && herdado !== 0)
    .map(([tempo, duracaoDaBatida, compasso]) => ({ tempo: tempo / 1000, batida: duracaoDaBatida / 1000, compasso: compasso || 4 }));
  const batidas: Batida[] = [];
  proprios.forEach((ponto, i) => {
    const ate = proprios[i + 1]?.tempo ?? duracao;
    for (let n = 0; ponto.tempo + n * ponto.batida < ate; n++) batidas.push({ tempo: ponto.tempo + n * ponto.batida, forte: n % ponto.compasso === 0 });
  });
  return batidas;
}

/** As partes do mapa para o treino: os bookmarks do autor, ou blocos de compassos. Só as que têm nota. */
export function trechosDoMapa(texto: string, duracao: number): Trecho[] {
  const secoes = secoesDoOsu(texto);
  const marcas = (secoes.get("Editor") ?? [])
    .find((l) => l.startsWith("Bookmarks"))
    ?.split(":")[1]
    ?.split(",")
    .map((t) => Number(t) / 1000)
    .filter((t) => Number.isFinite(t) && t > 0);
  const partes: Secao[] = (marcas ?? []).map((inicio, i) => ({ nome: `Parte ${i + 1}`, inicio }));
  const notas = (secoes.get("HitObjects") ?? []).map(tempoDaNota);
  return trechosDaMusica(partes, batidasDoMapa(secoes.get("TimingPoints") ?? [], duracao), duracao).filter((t) => notas.some((n) => n >= t.inicio && n < t.fim));
}

/** O mesmo .osu só com as notas do trecho; a nota longa que passa do fim termina nele. */
export function mapaDoTrecho(texto: string, trecho: Trecho): string {
  const [antes, objetos = ""] = texto.split(/\[HitObjects\]\r?\n/);
  const quebra = texto.includes("\r\n") ? "\r\n" : "\n";
  const fimMs = Math.round(trecho.fim * 1000);
  const linhas = objetos
    .split(/\r?\n/)
    .filter((linha) => linha.trim() && tempoDaNota(linha) >= trecho.inicio && tempoDaNota(linha) < trecho.fim)
    .map((linha) => {
      const campos = linha.split(",");
      // Nota longa (bit 128): o fim vem antes do primeiro ":" do sexto campo.
      if (!(Number(campos[3]) & 128)) return linha;
      const [fim, ...amostra] = campos[5].split(":");
      campos[5] = [Math.min(Number(fim), fimMs), ...amostra].join(":");
      return campos.join(",");
    });
  return `${antes}[HitObjects]${quebra}${linhas.join(quebra)}${quebra}`;
}
