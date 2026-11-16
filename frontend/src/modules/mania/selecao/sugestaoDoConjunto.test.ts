import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { sugestaoDoConjunto } from "./sugestaoDoConjunto";

const conjunto = { id: "osu:1234", origem: "osu", beatmapsetId: 1234, titulo: "Galaxy Collapse", tituloUnicode: "", artista: "Kurokotei", artistaUnicode: "", mapas: [] } as unknown as ConjuntoSalvo;
const dificuldade = { beatmapId: 5678, dificuldade: "Cataclysmic", teclas: 7 } as DificuldadeSalva;

it("um mapa do osu! vira sugestão pelo id do conjunto, com a dificuldade escolhida", () => {
  expect(sugestaoDoConjunto(conjunto, dificuldade)).toEqual({
    modo: "mania",
    musica: "1234",
    versao: "5678",
    titulo: "Galaxy Collapse",
    artista: "Kurokotei",
    dificuldade: "[Cataclysmic] 7K",
  });
});

it("mapa importado de um .osz não dá para o amigo baixar", () => {
  expect(sugestaoDoConjunto({ ...conjunto, origem: "importado", beatmapsetId: undefined } as ConjuntoSalvo, dificuldade)).toBeNull();
});
