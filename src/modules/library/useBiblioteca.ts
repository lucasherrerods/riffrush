import { useCallback, useEffect, useRef, useState } from "react";
import type { Musica } from "@/modules/songs";
import type { Biblioteca } from "./storage/biblioteca";
import { abrirBibliotecaDoNavegador } from "./storage/bibliotecaDoNavegador";

/** A capa vem como blob: URL, que morre ao fechar o jogo; a biblioteca guarda o arquivo da imagem. */
async function capaDe(musica: Musica) {
  if (!musica.imagemDeCapa) return undefined;
  try {
    return await (await fetch(musica.imagemDeCapa)).blob();
  } catch {
    return undefined;
  }
}

/** As músicas salvas de outras sessões. Sem armazenamento (aba anônima, cota cheia), o jogo segue sem salvar. */
export function useBiblioteca(abrir: () => Promise<Biblioteca> = abrirBibliotecaDoNavegador) {
  const [salvas, setSalvas] = useState<Musica[] | null>(null);
  const biblioteca = useRef<Promise<Biblioteca | null>>(null);

  // Abre uma vez só: a função recebida pode mudar a cada render.
  const abrirAtual = useRef(abrir);
  useEffect(() => {
    biblioteca.current ??= abrirAtual.current().catch(() => null);
    biblioteca.current
      .then((b) => b?.listar() ?? [])
      .catch(() => [])
      .then(setSalvas);
  }, []);

  const guardar = useCallback(async (musicas: Musica[]) => {
    const aberta = await biblioteca.current;
    for (const musica of musicas) await aberta?.guardar(musica, await capaDe(musica)).catch(() => {});
  }, []);

  const usar = useCallback(async (id: string) => {
    await (await biblioteca.current)?.usar(id).catch(() => {});
  }, []);

  return { salvas, guardar, usar };
}
