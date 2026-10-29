import { strToU8, zipSync } from "fflate";

/** Um .osu do modo mania pequeno, com uma nota simples e uma longa. */
export function osu({ dificuldade = "Hard", teclas = 4, modo = 3, audio = "audio.mp3", fundo = "fundo.jpg", beatmapId = 11 } = {}) {
  return `osu file format v14

[General]
AudioFilename: ${audio}
PreviewTime: 5000
Mode: ${modo}

[Metadata]
Title:Musica
TitleUnicode:Música
Artist:Banda
ArtistUnicode:Banda
Creator:Mapper
Version:${dificuldade}
BeatmapID:${beatmapId}
BeatmapSetID:7

[Difficulty]
HPDrainRate:7
CircleSize:${teclas}
OverallDifficulty:8

[Events]
0,0,"${fundo}",0,0

[TimingPoints]
0,500,4,2,0,40,1,0

[HitObjects]
64,192,1000,1,0,0:0:0:0:
192,192,1500,128,0,2000:0:0:0:0:
`;
}

/** No jsdom o TextEncoder devolve um Uint8Array de outro realm, que o fflate confunde com uma pasta: a cópia resolve. */
export function pacote(arquivos: Record<string, string | Uint8Array>) {
  return zipSync(Object.fromEntries(Object.entries(arquivos).map(([nome, conteudo]) => [nome, typeof conteudo === "string" ? new Uint8Array(strToU8(conteudo)) : conteudo])));
}
