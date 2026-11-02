import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import type { Trecho } from "@/modules/rock/songs";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { rotuloDaVelocidade } from "../velocidade";

interface Props {
  trechos: Trecho[];
  velocidade: number;
  /** Contar 3, 2, 1 antes de cada repetição. */
  contagem: boolean;
  aoContagem: (contagem: boolean) => void;
  aoComecar: (trecho: Trecho) => void;
  aoSair: () => void;
}

const minutos = (segundos: number) => {
  const inteiros = Math.round(segundos);
  return `${Math.floor(inteiros / 60)}:${String(inteiros % 60).padStart(2, "0")}`;
};

/** Antes do treino: a parte da música que vai repetir. */
export function EscolhaDoTreino({ trechos, velocidade, contagem, aoContagem, aoComecar, aoSair }: Props) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-fundo/80 p-4">
      <div className="flex max-h-full w-96 flex-col gap-4 placa p-6">
        <div>
          <h2 className="text-3xl leading-[1.1] font-black tracking-[-0.02em]">Treinar</h2>
          <p className="text-base text-texto-suave">Escolha a parte que vai repetir. Velocidade: {rotuloDaVelocidade(velocidade)}, nos modificadores.</p>
        </div>
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {trechos.map((trecho) => (
            <li key={trecho.inicio}>
              <Button variant="outline" className="w-full justify-between" onClick={() => aoComecar(trecho)}>
                <span className="truncate">{trecho.nome}</span>
                <span className="font-mono text-texto-suave tabular-nums">
                  {minutos(trecho.inicio)} · {minutos(trecho.fim - trecho.inicio)}
                </span>
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="contagem-do-treino" className="text-base">
            Contagem antes de repetir
          </Label>
          <Switch id="contagem-do-treino" checked={contagem} onCheckedChange={aoContagem} />
        </div>
        <Button variant="ghost" onClick={aoSair}>
          <LogOut className="opacity-70" /> Sair da música
        </Button>
      </div>
    </motion.div>
  );
}
