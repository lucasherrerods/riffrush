import { motion } from "framer-motion";
import { Hourglass, Info, Sparkles } from "lucide-react";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import type { RegistroDaPartida } from "./api";

interface Props {
  xp: RegistroDaPartida;
  /** Só as músicas do Encore valem XP: o servidor confere a partida pelo chart de lá. */
  valeXp?: boolean;
}

/** No resultado: quanto XP a partida deu e se a conta subiu de nível. */
export function GanhoDeXp({ xp, valeXp = true }: Props) {
  if (!valeXp) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chapa flex w-full max-w-2xl items-center gap-2 bg-superficie p-4">
        <Info className="size-4 text-texto-suave opacity-70" />
        <span className="font-titulo text-xl tracking-wide">Esta música não vale XP</span>
        <span className="flex-1" />
        <span className="text-base text-texto-suave">Só as baixadas em Buscar músicas valem, porque o servidor confere a partida.</span>
      </motion.div>
    );
  }
  if ("pendente" in xp) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chapa flex w-full max-w-2xl items-center gap-2 bg-superficie p-4">
        <Hourglass className="size-4 text-texto-suave opacity-70" />
        <span className="font-titulo text-xl tracking-wide">XP em validação</span>
        <span className="flex-1" />
        <span className="text-base text-texto-suave">Entra na conta assim que o servidor conferir a partida.</span>
      </motion.div>
    );
  }
  const { depois } = xp;
  const subiu = depois.nivel > xp.antes.nivel;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chapa flex w-full max-w-2xl flex-col gap-2 bg-superficie p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-destaque opacity-70" />
        <span className="font-titulo text-xl tracking-wide">+{xp.xp_ganho.toLocaleString("pt-BR")} XP</span>
        <span className="flex-1" />
        {subiu ? (
          <span className="font-titulo text-xl text-destaque">Subiu para o nível {depois.nivel}!</span>
        ) : (
          <span className="text-base text-texto-suave">Nível {depois.nivel}</span>
        )}
      </div>
      <BarraDeProgresso fracao={depois.xp_no_nivel / depois.xp_para_o_proximo} rotulo={`XP do nível ${depois.nivel}`} />
      <span className="text-right font-mono text-sm text-texto-suave">
        {depois.xp_no_nivel.toLocaleString("pt-BR")} / {depois.xp_para_o_proximo.toLocaleString("pt-BR")}
      </span>
    </motion.div>
  );
}
