import { useRef, useState } from "react";
import { importarArquivo, type Musica } from "@/modules/rock/songs";
import { avisar } from "@/shared/ui/avisos";
import { ehImportavel, resumirProgresso, type Progresso } from "./importacao";

/**
 * Importa os arquivos escolhidos, arrastados ou baixados, acompanhando o progresso, e avisa o resultado.
 * `extra` vai junto em cada música importada (ex.: de onde ela veio).
 */
export function useImportacao(aoImportar: (importadas: Musica[]) => void) {
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const aoImportarAtual = useRef(aoImportar);
  aoImportarAtual.current = aoImportar;

  const importar = async (arquivos: File[], extra: Partial<Musica> = {}) => {
    for (const recusado of arquivos.filter((a) => !ehImportavel(a))) avisar.error(`${recusado.name} não é música, clipe nem .sng.`);
    const aceitos = arquivos.filter(ehImportavel);
    if (!aceitos.length) return;

    const nomes = aceitos.map((a) => a.name);
    const fracoes = aceitos.map(() => 0);
    const atualizar = () => setProgresso(resumirProgresso(nomes, fracoes));
    atualizar();
    const tentativas = await Promise.allSettled(
      aceitos.map((arquivo, i) =>
        importarArquivo(arquivo, (fracao) => {
          fracoes[i] = fracao;
          atualizar();
        }),
      ),
    );
    setProgresso(null);

    for (const t of tentativas) if (t.status === "rejected") avisar.error(String(t.reason));
    const importadas = tentativas.flatMap((t) => (t.status === "fulfilled" ? [{ ...t.value, ...extra }] : []));
    if (!importadas.length) return;
    aoImportarAtual.current(importadas);
    const comChart = importadas.every((m) => m.sng);
    avisar.success(
      `${importadas.length} ${importadas.length === 1 ? "música importada" : "músicas importadas"}! ` +
        (comChart ? "Usando o chart do Clone Hero." : "O chart é gerado automaticamente."),
    );
  };

  return { importar, progresso };
}
