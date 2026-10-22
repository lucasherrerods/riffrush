import { motion } from "framer-motion";
import { ListOrdered, LogOut, Play, RotateCcw, Skull } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface Props {
  derrota: boolean;
  /** Em rede não dá para recomeçar nem sair sozinho: só desistir e ver o placar. */
  emRede: boolean;
  aoContinuar: () => void;
  aoRecomecar: () => void;
  aoSair: () => void;
  aoDesistir: () => void;
}

export function MenuDePausa({ derrota, emRede, aoContinuar, aoRecomecar, aoSair, aoDesistir }: Props) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-fundo/80">
      <motion.div
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        className="flex w-80 flex-col gap-2 placa p-6 text-center"
      >
        {derrota ? (
          <>
            <Skull className="mx-auto size-12 text-perigo" aria-hidden />
            <h2 className="text-3xl leading-[1.1] font-black tracking-[-0.02em] text-perigo">A galera vaiou!</h2>
            <p className="mb-2 text-base text-texto-suave">O medidor de rock zerou.{emRede ? "" : " Bora de novo?"}</p>
          </>
        ) : (
          <h2 className="mb-2 text-3xl leading-[1.1] font-black tracking-[-0.02em]">{emRede ? "Menu" : "Pausado"}</h2>
        )}
        {!derrota && (
          <Button size="lg" onClick={aoContinuar}>
            <Play className="opacity-70" /> Continuar
          </Button>
        )}
        {emRede ? (
          <Button size="lg" variant={derrota ? "default" : "ghost"} onClick={aoDesistir}>
            <ListOrdered className="opacity-70" /> {derrota ? "Ver placar" : "Desistir e ver placar"}
          </Button>
        ) : (
          <>
            <Button size="lg" variant="outline" onClick={aoRecomecar}>
              <RotateCcw className="opacity-70" /> Recomeçar
            </Button>
            <Button size="lg" variant="ghost" onClick={aoSair}>
              <LogOut className="opacity-70" /> Sair da música
            </Button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
