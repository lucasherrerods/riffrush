import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import logo from "@jogo/src-tauri/icons/icon.png";
import { IconeGithub } from "@jogo/src/shared/ui/IconeGithub";
import { LINKS, SECOES } from "@/links";

/** Some quando a página desce e volta quando sobe, para não tapar o show. */
export function Topo() {
  const { scrollY } = useScroll();
  const [escondido, setEscondido] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setEscondido(y > 160 && y > (scrollY.getPrevious() ?? 0)));

  return (
    <motion.header
      animate={{ y: escondido ? "-100%" : "0%" }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed inset-x-0 top-0 z-50 border-b border-borda/60 bg-fundo/80 backdrop-blur-md"
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 md:px-6">
        <a href="#" className="flex items-center gap-3">
          <img src={logo} alt="" className="size-9" />
          <span className="font-letreiro text-2xl">Riff Rush</span>
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {SECOES.map((secao) => (
            <a key={secao.id} href={`#${secao.id}`} className="text-texto-suave transition-colors hover:text-texto">
              {secao.rotulo}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <a href={LINKS.github} aria-label="Riff Rush no GitHub" className="text-texto-suave transition-colors hover:text-texto">
            <IconeGithub />
          </a>
          <a href={LINKS.jogarNoNavegador} className="corte bg-primaria px-5 py-2 font-titulo text-lg text-texto">
            Jogar
          </a>
        </div>
      </nav>
    </motion.header>
  );
}
