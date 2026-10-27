import { useCallback, useEffect, useState } from "react";
import { abrirBibliotecaDoMania, importarOsz, type BibliotecaDoMania, type ConjuntoSalvo } from "./biblioteca";

export interface ResultadoDaImportacao {
  importados: ConjuntoSalvo[];
  /** Nome do arquivo e o motivo de cada um que não entrou. */
  erros: { arquivo: string; motivo: string }[];
}

/** A biblioteca do Mania aberta, com a lista de conjuntos sempre em dia. */
export function useBibliotecaDoMania(abrir: () => Promise<BibliotecaDoMania> = abrirBibliotecaDoMania) {
  const [biblioteca, setBiblioteca] = useState<BibliotecaDoMania | null>(null);
  const [conjuntos, setConjuntos] = useState<ConjuntoSalvo[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    abrir()
      .then(async (aberta) => {
        const lista = await aberta.listar();
        if (cancelado) return;
        setBiblioteca(aberta);
        setConjuntos(lista);
      })
      .catch(() => !cancelado && setConjuntos([]));
    return () => {
      cancelado = true;
    };
  }, [abrir]);

  const atualizar = useCallback(async () => biblioteca && setConjuntos(await biblioteca.listar()), [biblioteca]);

  /** Os .osz arrastados ou escolhidos pelo jogador: ficam como importados, sem XP. */
  const importar = useCallback(
    async (arquivos: File[]): Promise<ResultadoDaImportacao> => {
      const resultado: ResultadoDaImportacao = { importados: [], erros: [] };
      if (!biblioteca) return resultado;
      for (const arquivo of arquivos) {
        try {
          resultado.importados.push(await importarOsz(biblioteca, arquivo, { origem: "importado" }));
        } catch (erro) {
          resultado.erros.push({ arquivo: arquivo.name, motivo: erro instanceof Error ? erro.message : String(erro) });
        }
      }
      await atualizar();
      return resultado;
    },
    [biblioteca, atualizar],
  );

  /** Um .osz baixado da busca: vem do osu!, com o status e as estrelas de cada dificuldade. */
  const guardarBaixado = useCallback(
    async (osz: Blob, { status, estrelas }: { status: string; estrelas: Record<string, number> }) => {
      if (!biblioteca) throw new Error("A biblioteca ainda não abriu.");
      const salvo = await importarOsz(biblioteca, osz, { origem: "osu", status, estrelas });
      await atualizar();
      return salvo;
    },
    [biblioteca, atualizar],
  );

  const remover = useCallback(
    async (id: string) => {
      await biblioteca?.remover(id);
      await atualizar();
    },
    [biblioteca, atualizar],
  );

  const usar = useCallback(async (id: string) => biblioteca?.usar(id), [biblioteca]);
  const abrirPacote = useCallback(async (id: string) => biblioteca?.abrir(id), [biblioteca]);

  return { conjuntos, importar, guardarBaixado, remover, usar, abrirPacote };
}
