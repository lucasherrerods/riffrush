import { useState } from "react";
import { motion } from "framer-motion";
import { Guitar, Play, Power, Settings2, Shirt, type LucideIcon } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { fecharJanela } from "@/modules/platform";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";

interface Props {
  volumeDosEfeitos: number;
  aoJogar: () => void;
  aoPersonagem: () => void;
  aoConfigurar: () => void;
}

interface Item {
  rotulo: string;
  icone: LucideIcon;
  acao: () => void;
}

export function MenuPrincipal({ volumeDosEfeitos, aoJogar, aoPersonagem, aoConfigurar }: Props) {
  const [selecionado, setSelecionado] = useState(0);
  const itens: Item[] = [
    { rotulo: "Jogar", icone: Play, acao: aoJogar },
    { rotulo: "Personagem", icone: Shirt, acao: aoPersonagem },
    { rotulo: "Configurações", icone: Settings2, acao: aoConfigurar },
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
        <motion.div animate={{ rotate: [-8, 8, -8] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
          <Guitar className="size-16 text-primaria" />
        </motion.div>
        <h1 className="titulo-do-jogo text-8xl leading-[1.1] font-black tracking-[-0.02em] uppercase italic max-md:text-5xl">Riff Rush</h1>
        <p className="text-base font-semibold tracking-[0.4em] text-texto-suave">TOQUE ATÉ OS DEDOS SANGRAREM</p>
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
                "flex items-center gap-4 rounded-2xl border px-6 py-3 text-left text-xl font-bold transition-colors",
                ativo ? "border-primaria bg-primaria text-texto" : "border-borda bg-superficie text-texto-suave",
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
