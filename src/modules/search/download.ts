import { montarUrlDoChart, nomeDoArquivo, type ResultadoDaBusca } from "./encore";

/** Acima disso o jogador confirma antes: packs com vídeo passam de 1 GB e pesam no celular. */
export const LIMITE_PARA_AVISAR = 300 * 1024 * 1024;

const ASSINATURA_DO_SNG = new TextEncoder().encode("SNGPKG");

export interface OpcoesDoDownload {
  comVideo?: boolean;
  aoProgredir?: (fracao: number) => void;
  /** Recebe o tamanho em bytes; devolve false para desistir. */
  confirmarTamanho?: (bytes: number) => Promise<boolean>;
  sinal?: AbortSignal;
  buscar?: typeof fetch;
}

const ehSng = (bytes: Uint8Array) => ASSINATURA_DO_SNG.every((byte, i) => bytes[i] === byte);

/** Baixa o .sng do chart. Devolve null se o jogador desistiu de um arquivo grande. */
export async function baixarDoEncore(resultado: ResultadoDaBusca, { comVideo, aoProgredir = () => {}, confirmarTamanho, sinal, buscar = fetch }: OpcoesDoDownload = {}): Promise<File | null> {
  let resposta: Response;
  try {
    resposta = await buscar(montarUrlDoChart(resultado, { comVideo }), { signal: sinal });
  } catch (erro) {
    if (sinal?.aborted) throw erro;
    throw new Error("Sem conexão com o Encore. Confira a internet e tente de novo.");
  }
  if (resposta.status === 404) throw new Error("Esse chart não está mais no Encore.");
  if (!resposta.ok || !resposta.body) throw new Error("O Encore não conseguiu entregar o arquivo. Tente de novo mais tarde.");

  const tamanho = Number(resposta.headers.get("Content-Length")) || 0;
  if (tamanho > LIMITE_PARA_AVISAR && confirmarTamanho && !(await confirmarTamanho(tamanho))) {
    await resposta.body.cancel();
    return null;
  }

  const pedacos: Uint8Array[] = [];
  let recebidos = 0;
  const leitor = resposta.body.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    pedacos.push(value);
    recebidos += value.length;
    if (tamanho) aoProgredir(Math.min(1, recebidos / tamanho));
  }

  if (!ehSng(pedacos[0] ?? new Uint8Array())) throw new Error("O arquivo baixado não é um .sng válido.");
  return new File(pedacos as BlobPart[], nomeDoArquivo(resultado), { type: "application/octet-stream" });
}

export function formatarTamanho(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB` : `${Math.round(mb)} MB`;
}
