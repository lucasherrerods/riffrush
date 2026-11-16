import type { Musica } from "@/modules/rock/songs";
import { sugestaoDaMusica } from "./sugestaoDaMusica";

const musica = { id: "encore:abc", titulo: "Through the Fire", artista: "DragonForce" } as Musica;

it("um chart do Encore vira sugestão pelo md5, com a dificuldade e o instrumento", () => {
  expect(sugestaoDaMusica({ ...musica, md5DoEncore: "fb0079d4c2e025d5b8dd70724750a923" }, "expert", "guitarra")).toEqual({
    modo: "rock",
    musica: "fb0079d4c2e025d5b8dd70724750a923",
    versao: "expert",
    titulo: "Through the Fire",
    artista: "DragonForce",
    dificuldade: "Expert · Guitarra",
  });
});

it("música importada ou do jogo não dá para o amigo baixar", () => {
  expect(sugestaoDaMusica(musica, "expert", "guitarra")).toBeNull();
});
