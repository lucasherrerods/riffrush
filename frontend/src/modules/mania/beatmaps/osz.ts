import { strFromU8, unzipSync } from "fflate";
import { InfoDoBeatmap, hashDoBeatmap } from "../gameplay/motor";

/** Um beatmapset: a música e os dados que se repetem em todas as dificuldades. */
export interface Conjunto {
  titulo: string;
  tituloUnicode: string;
  artista: string;
  artistaUnicode: string;
  mapper: string;
  beatmapsetId?: number;
}

/** Uma dificuldade do conjunto. O `texto` é o .osu inteiro, que o motor lê na hora de jogar. */
export interface MapaDoPacote {
  hash: string;
  beatmapId?: number;
  dificuldade: string;
  teclas: number;
  od: number;
  hp: number;
  notas: number;
  notasLongas: number;
  duracaoMs: number;
  previaMs: number;
  arquivoDeAudio: string;
  fundo?: string;
  texto: string;
}

export interface OszLido {
  conjunto: Conjunto;
  mapas: MapaDoPacote[];
  /** Áudio e imagens que as dificuldades usam, pelo nome escrito no .osu. */
  arquivos: Map<string, Uint8Array>;
}

export class ErroDoOsz extends Error {}

/** Um .osz de música costuma ter dezenas de MB; acima disso é suspeito (ou um zip-bomb). */
const MAXIMO_POR_ARQUIVO = 200 * 1024 * 1024;

const nomeSemPasta = (nome: string) => nome.split("/").pop() ?? nome;

/** Lê um .osz (um zip) e fica só com o que o Mania usa: as dificuldades mania, o áudio e o fundo delas. */
export function lerOsz(bytes: Uint8Array, { maximoPorArquivo = MAXIMO_POR_ARQUIVO } = {}): OszLido {
  const descompactar = (filtro: (nome: string) => boolean) => {
    try {
      return unzipSync(bytes, {
        filter: (arquivo) => {
          if (!filtro(arquivo.name)) return false;
          if (arquivo.originalSize > maximoPorArquivo) throw new ErroDoOsz(`O arquivo ${arquivo.name} é grande demais.`);
          return true;
        },
      });
    } catch (erro) {
      if (erro instanceof ErroDoOsz) throw erro;
      throw new ErroDoOsz("O arquivo não é um .osz válido.");
    }
  };

  const textos = Object.values(descompactar((nome) => nome.toLowerCase().endsWith(".osu"))).map((conteudo) => ({
    texto: strFromU8(conteudo),
    hash: hashDoBeatmap(conteudo),
  }));

  let conjunto: Conjunto | undefined;
  const mapas: MapaDoPacote[] = [];
  for (const { texto, hash } of textos) {
    let info: InfoDoBeatmap;
    try {
      info = new InfoDoBeatmap(texto);
    } catch {
      // Dificuldade de outro modo do osu! (ou quebrada): fica de fora.
      continue;
    }
    conjunto ??= {
      titulo: info.titulo,
      tituloUnicode: info.tituloUnicode || info.titulo,
      artista: info.artista,
      artistaUnicode: info.artistaUnicode || info.artista,
      mapper: info.mapper,
      beatmapsetId: info.beatmapsetId,
    };
    mapas.push({
      hash,
      beatmapId: info.beatmapId,
      dificuldade: info.dificuldade,
      teclas: info.teclas,
      od: info.od,
      hp: info.hp,
      notas: info.notas,
      notasLongas: info.notasLongas,
      duracaoMs: info.duracaoMs,
      previaMs: info.previaMs,
      arquivoDeAudio: info.arquivoDeAudio,
      fundo: info.fundo,
      texto,
    });
    info.free();
  }
  if (!conjunto || !mapas.length) throw new ErroDoOsz("Nenhuma dificuldade do modo mania neste pacote.");
  mapas.sort((a, b) => a.teclas - b.teclas || a.notas - b.notas);

  // O osu! acha os arquivos sem diferenciar maiúsculas: "Audio.MP3" no .osu é o "audio.mp3" do zip.
  const pedidos = new Map<string, string>();
  for (const mapa of mapas) for (const nome of [mapa.arquivoDeAudio, mapa.fundo]) if (nome) pedidos.set(nome.toLowerCase(), nome);
  const encontrados = descompactar((nome) => pedidos.has(nome.toLowerCase()) || pedidos.has(nomeSemPasta(nome).toLowerCase()));
  const arquivos = new Map<string, Uint8Array>();
  for (const [nome, conteudo] of Object.entries(encontrados)) {
    const pedido = pedidos.get(nome.toLowerCase()) ?? pedidos.get(nomeSemPasta(nome).toLowerCase());
    if (pedido) arquivos.set(pedido, conteudo);
  }
  if (!mapas.some((m) => arquivos.has(m.arquivoDeAudio))) throw new ErroDoOsz("O pacote não tem o áudio da música.");
  return { conjunto, mapas, arquivos };
}
