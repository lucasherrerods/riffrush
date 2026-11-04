import { obterContextoDeAudio } from "@/modules/audio";
import { PlayerDeMusica, type FaixaDoPlayer } from "@/modules/player";
import type { ConjuntoSalvo } from "../beatmaps/biblioteca";
import type { OszLido } from "../beatmaps/osz";

/** Uma música da biblioteca do Mania no player dos menus: o áudio sai do .osz quando ela toca. */
export interface FaixaDoMania extends FaixaDoPlayer {
  abrirAudio: () => Promise<Uint8Array | undefined>;
}

export type Decodificar = (contexto: AudioContext, bytes: Uint8Array) => Promise<AudioBuffer>;
const decodificarPadrao: Decodificar = (contexto, bytes) => contexto.decodeAudioData(bytes.slice().buffer);

/** A fila do player: um item por conjunto da biblioteca, na ordem em que ela aparece. */
export function faixasDaBiblioteca(conjuntos: ConjuntoSalvo[], abrirPacote: (id: string) => Promise<OszLido | undefined>): FaixaDoMania[] {
  return conjuntos.map((conjunto) => ({
    id: conjunto.id,
    titulo: conjunto.tituloUnicode || conjunto.titulo,
    artista: conjunto.artistaUnicode || conjunto.artista,
    abrirAudio: async () => {
      const pacote = await abrirPacote(conjunto.id);
      const audio = pacote?.mapas.find((m) => pacote.arquivos.has(m.arquivoDeAudio))?.arquivoDeAudio;
      return audio ? pacote.arquivos.get(audio) : undefined;
    },
  }));
}

export function criarPlayerDoMania(contexto: () => AudioContext = obterContextoDeAudio, decodificar: Decodificar = decodificarPadrao) {
  return new PlayerDeMusica<FaixaDoMania>(contexto, async (faixa) => {
    const bytes = await faixa.abrirAudio();
    if (!bytes) throw new Error("O pacote não tem o áudio da música.");
    return decodificar(contexto(), bytes);
  });
}

/** A trilha dos menus do Mania: toca as músicas da biblioteca, como o player do Rock toca as dele. */
export const playerDoMania = criarPlayerDoMania();
