import { MUSICAS_EMBUTIDAS, importarArquivo, type Musica } from "@/modules/songs";
import type { MusicaNaRede } from "./protocolo";

export function paraRede(musica: Musica): MusicaNaRede {
  if (!musica.arquivo) return { tipo: "embutida", id: musica.id };
  return { tipo: "importada", id: musica.id, titulo: musica.titulo, artista: musica.artista, nomeDoArquivo: musica.arquivo.name };
}

const baixadas = new Map<string, Musica>();

/** Transforma a música da sala numa música jogável, baixando do host quando ela foi importada lá. */
export async function resolverMusica(rede: MusicaNaRede, locais: Musica[], enderecoDoHost: string, baixar: typeof fetch = fetch): Promise<Musica> {
  const local = locais.find((m) => m.id === rede.id);
  if (local) return local;
  if (rede.tipo === "embutida") return MUSICAS_EMBUTIDAS.find((m) => m.id === rede.id) ?? MUSICAS_EMBUTIDAS[0];
  const jaBaixada = baixadas.get(rede.id);
  if (jaBaixada) return jaBaixada;

  const resposta = await baixar(`${enderecoDoHost}/musica`);
  if (!resposta.ok) throw new Error("O host ainda não compartilhou a música.");
  const conteudo = await resposta.blob();
  const arquivo = new File([conteudo], rede.nomeDoArquivo, { type: conteudo.type });
  const musica = { ...(await importarArquivo(arquivo)), id: rede.id, titulo: rede.titulo, artista: rede.artista };
  baixadas.set(rede.id, musica);
  return musica;
}
