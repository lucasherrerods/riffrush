import type { EstadoOnline, PartidaTransmitida } from "@/modules/presenca";
import type { EntradaDoMania } from "../gameplay/TelaDeJogoMania";

/** O que a presença e a transmissão precisam saber do mapa que está sendo jogado. */
export interface MapaAoVivo {
  titulo: string;
  artista: string;
  dificuldade: string;
  teclas: number;
  /** O md5 do .osu: quem assiste acha o mesmo mapa na biblioteca por ele. */
  hash: string;
}

/** No relay as entradas são `[tempo, código]`; no Mania o código é `coluna * 2 + (1 se toca)`. */
export const entradasParaOLoteDoMania = (entradas: EntradaDoMania[]): [number, number][] => entradas.map(([tempo, coluna, toca]) => [tempo, coluna * 2 + toca]);
export const entradasDoLoteDoMania = (lote: [number, number][]): EntradaDoMania[] => lote.map(([tempo, codigo]) => [tempo, codigo >> 1, codigo & 1]);

const idDoMapa = (mapa: MapaAoVivo) => `osu:${mapa.hash}`;
const rotuloDasTeclas = (mapa: MapaAoVivo) => `${mapa.teclas}K`;

/** Onde a pessoa está, para as listas de quem está online dos dois modos. */
export const estadoTocandoNoMania = (mapa: MapaAoVivo, transmitindo: boolean): EstadoOnline => ({
  tipo: "tocando",
  musica: idDoMapa(mapa),
  titulo: mapa.titulo,
  artista: mapa.artista,
  dificuldade: mapa.dificuldade,
  instrumento: rotuloDasTeclas(mapa),
  transmitindo,
  modo: "mania",
});

/** O início da transmissão: quem assiste monta a mesma partida com o hash, os mods e a semente. */
export const partidaParaTransmitirNoMania = (mapa: MapaAoVivo, mods: number, semente: number): PartidaTransmitida => ({
  musica: idDoMapa(mapa),
  dificuldade: mapa.dificuldade,
  instrumento: rotuloDasTeclas(mapa),
  hashDoChart: mapa.hash,
  semFalha: false,
  velocidade: 1,
  modo: "mania",
  mods,
  semente,
});
