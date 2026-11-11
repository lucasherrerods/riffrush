import { useState, type ReactNode } from "react";
import { Dices, Filter, LoaderCircle } from "lucide-react";
import { avisar } from "@/shared/ui/avisos";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { BotaoDaSelecao } from "./BotaoDaSelecao";

interface Props {
  aoSortear: () => Promise<unknown>;
  /** O conteúdo do filtro do sorteio, num popover ao lado; `ativos` é quantas escolhas ele tem ligadas. */
  filtro?: { ativos: number; conteudo: ReactNode };
}

/** Baixa uma música sorteada e a deixa selecionada; fica ocupado até o download terminar. Igual nos dois modos. */
export function BotaoDeAleatoria({ aoSortear, filtro }: Props) {
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
  const botao = (
    <BotaoDaSelecao disabled={sorteando} onClick={() => void sortear()} aria-label="Aleatória">
      {sorteando ? <LoaderCircle className="animate-spin" /> : <Dices />}
      <span className="max-md:sr-only">Aleatória</span>
    </BotaoDaSelecao>
  );
  if (!filtro) return botao;
  return (
    <div className="flex">
      {botao}
      <Popover>
        <PopoverTrigger asChild>
          <BotaoDaSelecao aria-label="Filtro da Aleatória" className="border-l-0 px-2.5">
            <Filter aria-hidden />
            {filtro.ativos > 0 && <span className="font-mono text-primaria">{filtro.ativos}</span>}
          </BotaoDaSelecao>
        </PopoverTrigger>
        <PopoverContent className="w-max max-w-[min(20rem,calc(100vw-2rem))]">{filtro.conteudo}</PopoverContent>
      </Popover>
    </div>
  );
}
