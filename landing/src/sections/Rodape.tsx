import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import logo from "@jogo/src-tauri/icons/icon.png";
import { IconeGithub } from "@jogo/src/shared/ui/IconeGithub";
import { LINKS, SECOES } from "@/links";

const COLUNAS = [
  {
    titulo: "Jogar",
    links: [
      { rotulo: "No navegador", href: LINKS.jogarNoNavegador },
      { rotulo: "Baixar para PC", href: LINKS.baixar },
    ],
  },
  { titulo: "Página", links: SECOES.map((s) => ({ rotulo: s.rotulo, href: `#${s.id}` })) },
  {
    titulo: "Projeto",
    links: [
      { rotulo: "Código no GitHub", href: LINKS.github },
      { rotulo: "Versões", href: LINKS.baixar },
    ],
  },
];

/** Rodapé com o nome do jogo gigante subindo do chão do palco. */
export function Rodape() {
  const ref = useRef<HTMLElement>(null);
  const parado = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const y = useTransform(scrollYProgress, [0, 1], ["60%", "6%"]);

  return (
    <footer ref={ref} className="relative overflow-hidden border-t border-borda">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-20 md:grid-cols-12 md:px-6">
        <div className="md:col-span-5">
          <a href="#" className="flex items-center gap-3">
            <img src={logo} alt="" className="size-10" />
            <span className="font-letreiro text-3xl">Riff Rush</span>
          </a>
          <p className="mt-4 max-w-[36ch] text-base text-texto-suave">Jogo de ritmo grátis e de código aberto, feito para tocar em grupo.</p>
        </div>
        <nav aria-label="Rodapé" className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
          {COLUNAS.map((coluna) => (
            <div key={coluna.titulo}>
              <p className="mb-4 font-titulo text-xl tracking-wide text-texto-suave">{coluna.titulo}</p>
              <ul className="space-y-2">
                {coluna.links.map((link) => (
                  <li key={link.rotulo}>
                    <a href={link.href} className="text-base transition-colors hover:text-primaria">
                      {link.rotulo}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="mx-auto mt-16 flex max-w-6xl items-center justify-between gap-4 px-4 text-sm text-texto-suave md:px-6">
        <span>© 2026 Riff Rush</span>
        <a href={LINKS.github} aria-label="Riff Rush no GitHub" className="transition-colors hover:text-texto">
          <IconeGithub className="size-5" />
        </a>
      </div>

      <div aria-hidden className="pointer-events-none mt-4 h-[clamp(5rem,17vw,15rem)] select-none">
        <motion.p
          style={parado ? undefined : { y }}
          className="titulo-do-jogo text-center font-letreiro text-[clamp(7rem,24vw,22rem)] leading-none whitespace-nowrap opacity-20"
        >
          Riff Rush
        </motion.p>
      </div>
    </footer>
  );
}
