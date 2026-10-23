import { useCallback, useEffect, useRef, useState } from "react";
import { importarArquivo, type Musica } from "@/modules/songs";
import { avisar } from "@/shared/ui/avisos";
import type { Biblioteca } from "./storage/biblioteca";
import { abrirBibliotecaDoNavegador } from "./storage/bibliotecaDoNavegador";
import { abrirBibliotecaDoPc } from "./storage/bibliotecaDoPc";

/** No app do PC as músicas vão para o disco; no navegador (e no celular da sala), para o IndexedDB. */
const abrirBibliotecaPadrao = () => ("__TAURI_INTERNALS__" in window ? abrirBibliotecaDoPc() : abrirBibliotecaDoNavegador());

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
export function useBiblioteca(abrir: () => Promise<Biblioteca> = abrirBibliotecaPadrao) {
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
    for (const musica of musicas) {
      await aberta
        ?.guardar(musica, await capaDe(musica))
        .catch((erro) => avisar.error(`Não consegui salvar ${musica.titulo}: ${erro instanceof Error ? erro.message : erro}`));
    }
  }, []);

  const usar = useCallback(async (id: string) => {
    await (await biblioteca.current)?.usar(id).catch(() => {});
  }, []);

  /**
   * Deixa a música pronta para a partida: lê o arquivo guardado no PC e, num .sng salvo,
   * extrai de novo o clipe, que não fica guardado separado.
   */
  const prepararParaTocar = useCallback(async (musica: Musica): Promise<Musica> => {
    const arquivo = musica.arquivo ?? (musica.noAparelho ? await (await biblioteca.current)?.abrir(musica.id).catch(() => undefined) : undefined);
    const faltaOClipe = musica.sng && musica.video && !musica.arquivoDeVideo;
    if (!arquivo || (arquivo === musica.arquivo && !faltaOClipe)) return musica;
    const arquivoDeVideo = faltaOClipe ? (await importarArquivo(arquivo).catch(() => undefined))?.arquivoDeVideo : musica.arquivoDeVideo;
    return { ...musica, arquivo, arquivoDeVideo };
  }, []);

  return { salvas, guardar, usar, prepararParaTocar };
}
