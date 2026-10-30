import { isTauri } from "@tauri-apps/api/core";
import { avisar as mostrarAviso } from "@/shared/ui/avisos";
import type { AtualizacaoPronta } from "./useAtualizacao";

/** No app desktop, procura a última release no GitHub e já baixa o instalador; no navegador não há o que atualizar. */
export async function buscarAtualizacao(): Promise<AtualizacaoPronta | null> {
  if (!isTauri()) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const atualizacao = await check();
  if (!atualizacao) return null;
  await atualizacao.download();
  return {
    versao: atualizacao.version,
    instalar: async () => {
      await atualizacao.install();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}

export function avisarAtualizacao(versao: string, reiniciar: () => Promise<void>) {
  mostrarAviso(`Versão ${versao} pronta`, {
    description: "Reinicie para atualizar o Riff Rush.",
    duration: Infinity,
    action: { label: "Reiniciar", onClick: () => void reiniciar() },
  });
}
