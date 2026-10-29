import { baixarSng } from "@/modules/rock/search";
import { MUSICAS_EMBUTIDAS, importarArquivo, type Musica } from "@/modules/rock/songs";
import type { MusicaNaRede } from "./protocolo";

export function paraRede(musica: Musica, { online = false } = {}): MusicaNaRede {
  if (online && musica.urlDoEncore) {
    const nomeDoArquivo = musica.arquivo?.name ?? `${musica.artista} - ${musica.titulo}.sng`;
    return { tipo: "encore", id: musica.id, titulo: musica.titulo, artista: musica.artista, nomeDoArquivo, url: musica.urlDoEncore };
  }
  if (!musica.arquivo) return { tipo: "embutida", id: musica.id };
  return { tipo: "importada", id: musica.id, titulo: musica.titulo, artista: musica.artista, nomeDoArquivo: musica.arquivo.name };
}

const baixadas = new Map<string, Musica>();

/** Busca o arquivo da música: do host na LAN, ou direto do Encore no online. */
async function baixarArquivo(rede: Exclude<MusicaNaRede, { tipo: "embutida" }>, enderecoDoHost: string, baixar: typeof fetch): Promise<File> {
  if (rede.tipo === "encore") {
    const arquivo = await baixarSng(rede.url, rede.nomeDoArquivo, { buscar: baixar });
    if (!arquivo) throw new Error("Não consegui baixar a música do Encore.");
    return arquivo;
  }
  const resposta = await baixar(`${enderecoDoHost}/musica`);
  if (!resposta.ok) throw new Error("O host ainda não compartilhou a música.");
  const conteudo = await resposta.blob();
  return new File([conteudo], rede.nomeDoArquivo, { type: conteudo.type });
}

/** Transforma a música da sala numa música jogável, baixando quando o jogador ainda não tem. */
export async function resolverMusica(rede: MusicaNaRede, locais: Musica[], enderecoDoHost: string, baixar: typeof fetch = fetch): Promise<Musica> {
  // O mesmo .sng baixado por dois jogadores gera o mesmo id (nome e tamanho), então quem já tem usa o seu.
  const local = locais.find((m) => m.id === rede.id);
  if (local) return local;
  if (rede.tipo === "embutida") return MUSICAS_EMBUTIDAS.find((m) => m.id === rede.id) ?? MUSICAS_EMBUTIDAS[0];
  const jaBaixada = baixadas.get(rede.id);
  if (jaBaixada) return jaBaixada;

  const arquivo = await baixarArquivo(rede, enderecoDoHost, baixar);
  const musica: Musica = {
    ...(await importarArquivo(arquivo)),
    id: rede.id,
    titulo: rede.titulo,
    artista: rede.artista,
    ...(rede.tipo === "encore" && { urlDoEncore: rede.url }),
  };
  baixadas.set(rede.id, musica);
  return musica;
}
