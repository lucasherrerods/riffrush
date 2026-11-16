import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import type { MapaNaRede } from "./protocolo";

export interface MapaDaBiblioteca {
  conjunto: ConjuntoSalvo;
  dificuldade: DificuldadeSalva;
}

export function paraRede(conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva): MapaNaRede {
  const comum = {
    hash: dificuldade.hash,
    titulo: conjunto.tituloUnicode || conjunto.titulo,
    artista: conjunto.artistaUnicode || conjunto.artista,
    dificuldade: dificuldade.dificuldade,
    teclas: dificuldade.teclas,
  };
  if (podeJogarOnline(conjunto)) return { tipo: "osu", beatmapsetId: conjunto.beatmapsetId!, ...comum, ...(conjunto.status && { status: conjunto.status }) };
  return { tipo: "importado", ...comum };
}

/** Pela internet só vão os mapas do osu!: cada jogador baixa o mesmo .osz dos espelhos. */
export const podeJogarOnline = (conjunto: ConjuntoSalvo) => conjunto.origem === "osu" && !!conjunto.beatmapsetId;

export function acharNaBiblioteca(mapa: MapaNaRede, conjuntos: ConjuntoSalvo[]): MapaDaBiblioteca | null {
  for (const conjunto of conjuntos) {
    const dificuldade = conjunto.mapas.find((m) => m.hash === mapa.hash);
    if (dificuldade) return { conjunto, dificuldade };
  }
  return null;
}

export interface DependenciasDoMapa {
  conjuntos: ConjuntoSalvo[];
  /** Endereço HTTP do host da LAN; vazio no online. */
  endereco: string;
  baixarOsz: (beatmapsetId: number) => Promise<Blob>;
  /** Guarda o .osz baixado do osu!, com o status que o host conhece. */
  guardarDoOsu: (osz: Blob, status?: string) => Promise<ConjuntoSalvo>;
  /** Guarda o .osz que veio do host como importado. */
  importar: (osz: Blob) => Promise<ConjuntoSalvo>;
  buscar?: typeof fetch;
}

/**
 * O convidado consegue o mapa da sala: da biblioteca, dos espelhos do osu! ou do host da LAN.
 * Lança com a mensagem para a tela quando não dá.
 */
export async function resolverMapa(mapa: MapaNaRede, { conjuntos, endereco, baixarOsz, guardarDoOsu, importar, buscar = fetch }: DependenciasDoMapa): Promise<MapaDaBiblioteca> {
  const salvo = acharNaBiblioteca(mapa, conjuntos);
  if (salvo) return salvo;
  let conjunto: ConjuntoSalvo;
  if (mapa.tipo === "osu") conjunto = await guardarDoOsu(await baixarOsz(mapa.beatmapsetId), mapa.status);
  else {
    if (!endereco) throw new Error("Este mapa só existe no PC do host.");
    const resposta = await buscar(`${endereco}/musica`);
    if (!resposta.ok) throw new Error("O host ainda não compartilhou o mapa.");
    conjunto = await importar(await resposta.blob());
  }
  const achado = acharNaBiblioteca(mapa, [conjunto]);
  if (!achado) throw new Error("O mapa baixado é de outra versão da dificuldade do host.");
  return achado;
}
