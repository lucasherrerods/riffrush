import { CAPAS_DAS_BANDAS } from "./capasDasBandas";

/** Com menos que isso, a abertura repetiria demais as mesmas capas e não passa. */
export const MINIMO_DE_CAPAS = 20;

const CACHE = "riffrush-capas-da-abertura";

/** A imagem da capa, do cache do aparelho ou da rede (que ainda guarda para a próxima vez). */
async function baixarCapa(url: string): Promise<Blob> {
  const cache = await caches?.open(CACHE).catch(() => undefined);
  const guardada = await cache?.match(url);
  if (guardada) return guardada.blob();
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Capa indisponível (${resposta.status}).`);
  await cache?.put(url, resposta.clone()).catch(() => undefined);
  return resposta.blob();
}

async function abrirImagem(blob: Blob) {
  const imagem = new Image();
  imagem.src = URL.createObjectURL(blob);
  await imagem.decode();
  return imagem;
}

interface Opcoes {
  /** Quanto esperar pelas capas; o que não chegou até lá fica de fora. */
  tempoMaximoMs?: number;
  baixar?: (url: string) => Promise<Blob>;
  abrir?: (blob: Blob) => Promise<HTMLImageElement>;
}

/** As capas que conseguiram carregar a tempo, já decodificadas para o canvas desenhar sem esperar. */
export async function carregarCapas(urls = CAPAS_DAS_BANDAS.map((c) => c.url), { tempoMaximoMs = 4000, baixar = baixarCapa, abrir = abrirImagem }: Opcoes = {}) {
  const prontas: HTMLImageElement[] = [];
  const todas = Promise.all(
    urls.map((url) =>
      baixar(url)
        .then(abrir)
        .then((imagem) => void prontas.push(imagem))
        .catch(() => undefined),
    ),
  );
  await Promise.race([todas, new Promise((fim) => setTimeout(fim, tempoMaximoMs))]);
  return [...prontas];
}
