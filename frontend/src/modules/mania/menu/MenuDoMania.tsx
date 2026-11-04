import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Play, Search, Settings2, type LucideIcon } from "lucide-react";
import { LogoDoJogo } from "@/modules/menu";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";
import { CirculoDeAcerto } from "./CirculoDeAcerto";

interface Props {
  aoJogar: () => void;
  aoBuscar: () => void;
  aoConfigurar: () => void;
  /** A alavanca que volta para o Rock, embaixo da logo. */
  alavanca?: ReactNode;
}

interface Item {
  rotulo: string;
  icone: LucideIcon;
  acao: () => void;
}

/** A tela inicial do Mania, no molde do menu do Rock: logo, alavanca e as opções em chapas. */
export function MenuDoMania({ aoJogar, aoBuscar, aoConfigurar, alavanca }: Props) {
  const [selecionado, setSelecionado] = useState(0);
  const itens: Item[] = [
    { rotulo: "Jogar", icone: Play, acao: aoJogar },
    { rotulo: "Buscar mapas", icone: Search, acao: aoBuscar },
    { rotulo: "Configurações", icone: Settings2, acao: aoConfigurar },
  ];

  useTeclado((evento) => {
    if (evento.code === "ArrowDown" || evento.code === "ArrowUp") {
      evento.preventDefault();
      const passo = evento.code === "ArrowDown" ? 1 : itens.length - 1;
      setSelecionado((atual) => (atual + passo) % itens.length);
    } else if (evento.code === "Enter") {
      evento.preventDefault();
      itens[selecionado].acao();
    }
  });

  return (
    <div className="rolagem-de-toque relative flex h-full flex-col items-center gap-6 py-6 max-md:px-4">
      <motion.div
        initial={{ y: -40, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 12 }}
        className="mt-auto flex flex-col items-center gap-2"
      >
        <LogoDoJogo modo="Mania" />
        <p className="text-center text-xs font-bold tracking-[0.4em] text-texto-suave max-md:tracking-[0.15em]">SIGA O RITMO</p>
        {alavanca}
      </motion.div>

      <nav aria-label="Menu do Mania" className="mb-auto flex w-60 flex-col gap-1.5 max-md:w-full max-md:max-w-sm max-md:gap-2">
        {itens.map((item, i) => {
          const ativo = i === selecionado;
          return (
            <motion.button
              key={item.rotulo}
              aria-current={ativo}
              initial={{ x: -48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.16 + i * 0.08 }}
              onMouseEnter={() => setSelecionado(i)}
              onClick={item.acao}
              className={cn(
                "chapa flex items-center gap-3 px-2 py-1.5 text-left font-titulo text-lg tracking-wide uppercase transition-colors max-md:py-2 max-md:text-xl",
                ativo ? "border-primaria bg-primaria text-superficie-elevada" : "border-borda bg-superficie-elevada text-texto-suave",
              )}
            >
              <CirculoDeAcerto icone={item.icone} apagado={!ativo} className={ativo ? "ring-superficie-elevada/60" : undefined} />
              {item.rotulo}
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
}
