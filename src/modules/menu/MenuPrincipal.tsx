import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Power, Settings2, Shirt, Users, Zap, type LucideIcon } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { fecharJanela } from "@/modules/platform";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";

interface Props {
  volumeDosEfeitos: number;
  /** Celular que entrou pelo QR code: o foco é a sala, e não existe "Sair" (é só fechar a aba). */
  noCelular?: boolean;
  aoJogar: () => void;
  aoMultijogador: () => void;
  aoPersonagem: () => void;
  aoConfigurar: () => void;
}

interface Item {
  rotulo: string;
  icone: LucideIcon;
  acao: () => void;
}

export function MenuPrincipal({ volumeDosEfeitos, noCelular = false, aoJogar, aoMultijogador, aoPersonagem, aoConfigurar }: Props) {
  const [selecionado, setSelecionado] = useState(0);
  const comuns: Item[] = [
    { rotulo: "Personagem", icone: Shirt, acao: aoPersonagem },
    { rotulo: "Configurações", icone: Settings2, acao: aoConfigurar },
  ];
  const itens: Item[] = noCelular
    ? [{ rotulo: "Entrar na sala", icone: Users, acao: aoMultijogador }, { rotulo: "Jogar sozinho", icone: Play, acao: aoJogar }, ...comuns]
    : [
        { rotulo: "Jogar", icone: Play, acao: aoJogar },
        { rotulo: "Multijogador", icone: Users, acao: aoMultijogador },
        ...comuns,
        { rotulo: "Sair", icone: Power, acao: () => void fecharJanela() },
      ];

  const escolher = (item: Item) => {
    tocarEfeito("selecionar", volumeDosEfeitos);
    item.acao();
  };

  useTeclado((evento) => {
    if (evento.code === "ArrowDown" || evento.code === "ArrowUp") {
      evento.preventDefault();
      tocarEfeito("mover", volumeDosEfeitos);
      const passo = evento.code === "ArrowDown" ? 1 : itens.length - 1;
      setSelecionado((atual) => (atual + passo) % itens.length);
    } else if (evento.code === "Enter") {
      escolher(itens[selecionado]);
    }
  });

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-16">
      <motion.div
        initial={{ y: -40, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 12 }}
        className="flex flex-col items-center gap-2"
      >
        <h1 aria-label="Riff Rush" className="titulo-do-jogo flex items-center gap-2 text-9xl leading-none tracking-[0.01em] max-md:text-7xl">
          Riff
          <motion.span animate={{ rotate: [-6, 6, -6] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
            <Zap className="size-24 fill-primaria text-primaria max-md:size-14" />
          </motion.span>
          Rush
        </h1>
        <p className="bg-primaria px-4 py-1 text-center text-base font-bold tracking-[0.4em] text-texto -skew-x-12 max-md:tracking-[0.15em]">TOQUE ATÉ OS DEDOS SANGRAREM</p>
      </motion.div>

      <nav className="flex w-80 flex-col gap-2 max-md:w-[85vw]">
        {itens.map((item, i) => {
          const ativo = i === selecionado;
          const Icone = item.icone;
          return (
            <motion.button
              key={item.rotulo}
              aria-current={ativo}
              initial={{ x: -48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.16 + i * 0.08 }}
              onMouseEnter={() => {
                if (!ativo) tocarEfeito("mover", volumeDosEfeitos);
                setSelecionado(i);
              }}
              onClick={() => escolher(item)}
              className={cn(
                "chapa flex items-center gap-4 px-6 py-3 text-left font-titulo text-3xl tracking-wide uppercase transition-colors",
                ativo ? "gasto border-primaria bg-primaria text-texto" : "border-borda bg-superficie text-texto-suave",
              )}
            >
              <Icone className="size-6 opacity-70" />
              {item.rotulo}
            </motion.button>
          );
        })}
      </nav>

      <p className="absolute bottom-6 text-base text-texto-suave">↑ ↓ para navegar · Enter para escolher</p>
    </div>
  );
}
