import { useState } from "react";
import { Dices, LoaderCircle } from "lucide-react";
import { avisar } from "@/shared/ui/avisos";
import { BotaoDaSelecao } from "./BotaoDaSelecao";

/** Baixa uma música sorteada e a deixa selecionada; fica ocupado até o download terminar. Igual nos dois modos. */
export function BotaoDeAleatoria({ aoSortear }: { aoSortear: () => Promise<unknown> }) {
  const [sorteando, setSorteando] = useState(false);
  const sortear = async () => {
    setSorteando(true);
    try {
      await aoSortear();
    } catch (erro) {
      avisar.error(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setSorteando(false);
    }
  };
  return (
    <BotaoDaSelecao disabled={sorteando} onClick={() => void sortear()} aria-label="Aleatória">
      {sorteando ? <LoaderCircle className="animate-spin" /> : <Dices />}
      <span className="max-md:sr-only">Aleatória</span>
    </BotaoDaSelecao>
  );
}
