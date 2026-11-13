import { AUDIO_DO_SNG, desmascarar, lerIndiceDoSng, tamanhoDoIndiceDoSng } from "@/modules/rock/songs";
import type { FonteDaPrevia } from "@/modules/busca";
import { montarUrlDoChart, type ResultadoDaBusca } from "./encore";

/** O índice costuma caber aqui; se não couber, o resto é pedido depois. */
const PRIMEIRO_PEDACO = 64 * 1024;
/** Sem o ponto marcado pelo charter, a prévia começa um pouco antes do meio, onde costuma estar o refrão. */
const FRACAO_SEM_PONTO = 0.35;
const PREVIA_SEPARADA = /^preview\.(opus|ogg|mp3|wav)$/;
const MUSICA_INTEIRA = /^song\.(opus|ogg|mp3|wav)$/;

const TIPO: Record<string, string> = { opus: "audio/ogg", ogg: "audio/ogg", mp3: "audio/mpeg", wav: "audio/wav" };

/** O arquivo de áudio que melhor serve de prévia: a prévia do chart, a música inteira ou uma das faixas. */
export function audioDaPrevia(nomes: string[]): string | null {
  return nomes.find((n) => PREVIA_SEPARADA.test(n)) ?? nomes.find((n) => MUSICA_INTEIRA.test(n)) ?? nomes.find((n) => AUDIO_DO_SNG.test(n)) ?? null;
}

/** Em segundos. `preview_start_time` do song.ini vem em milissegundos. */
export function inicioDaPrevia(metadados: Record<string, string>, duracaoMs: number, arquivo = ""): number {
  if (PREVIA_SEPARADA.test(arquivo)) return 0;
  const marcado = metadados.preview_start_time ? Number(metadados.preview_start_time) : NaN;
  if (marcado >= 0 && (!duracaoMs || marcado < duracaoMs)) return marcado / 1000;
  return (duracaoMs * FRACAO_SEM_PONTO) / 1000;
}

export interface PreviaDoChart {
  audio: Blob;
  inicioS: number;
}

/**
 * Tira o áudio de um .sng do Encore sem baixar o pacote inteiro: o servidor aceita pedidos
 * por faixa de bytes, então vêm só o índice e o arquivo de áudio escolhido.
 */
export async function buscarPreviaDoChart(resultado: ResultadoDaBusca, { buscar = fetch, sinal }: { buscar?: typeof fetch; sinal?: AbortSignal } = {}): Promise<PreviaDoChart> {
  const url = montarUrlDoChart(resultado);
  const pedir = async (inicio: number, fim: number) => {
    const resposta = await buscar(url, { headers: { Range: `bytes=${inicio}-${fim - 1}` }, signal: sinal });
    if (!resposta.ok) throw new Error("Não deu para tocar a prévia agora.");
    return new Uint8Array(await resposta.arrayBuffer());
  };

  let comeco = await pedir(0, PRIMEIRO_PEDACO);
  const tamanho = tamanhoDoIndiceDoSng(comeco);
  if (tamanho === null) throw new Error("Não deu para tocar a prévia agora.");
  if (tamanho > comeco.length) comeco = await pedir(0, tamanho);

  const indice = lerIndiceDoSng(comeco);
  const nome = audioDaPrevia([...indice.arquivos.keys()]);
  if (!nome) throw new Error("Este chart não tem áudio para ouvir.");
  const { inicio, tamanho: tamanhoDoAudio } = indice.arquivos.get(nome)!;
  const conteudo = desmascarar(await pedir(inicio, inicio + tamanhoDoAudio), indice.mascara);
  const extensao = nome.split(".").pop() ?? "";
  return { audio: new Blob([conteudo as BlobPart], { type: TIPO[extensao] ?? "" }), inicioS: inicioDaPrevia(indice.metadados, resultado.duracaoMs, nome) };
}

/** A prévia do chart pronta para o player da busca, com a URL do Blob solta quando ela para. */
export async function fonteDaPreviaDoChart(resultado: ResultadoDaBusca, sinal: AbortSignal): Promise<FonteDaPrevia> {
  const { audio, inicioS } = await buscarPreviaDoChart(resultado, { sinal });
  const url = URL.createObjectURL(audio);
  return { url, inicioS, liberar: () => URL.revokeObjectURL(url) };
}
