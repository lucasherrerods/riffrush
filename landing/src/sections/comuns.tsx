import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Download, Play } from "lucide-react";
import { LINKS } from "@/links";

/** Entra deslizando quando aparece na tela. */
export function Surge({ children, atraso = 0, className }: { children: ReactNode; atraso?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: atraso, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Titulo({ selo, children }: { selo: string; children: ReactNode }) {
  return (
    <div className="mb-12 max-w-2xl">
      <p className="mb-3 font-titulo text-xl tracking-widest text-primaria">{selo}</p>
      <h2 className="text-5xl leading-[0.95] md:text-6xl">{children}</h2>
    </div>
  );
}

/** Os dois caminhos para jogar, usados no topo e no fim da página. */
export function Chamadas() {
  return (
    <div className="flex flex-wrap gap-4">
      <a href={LINKS.jogarNoNavegador} className="corte gasto inline-flex items-center gap-3 bg-primaria px-8 py-4 font-titulo text-2xl text-texto transition-transform hover:-translate-y-0.5">
        <Play className="size-5 fill-current" aria-hidden />
        Jogar no navegador
      </a>
      <a href={LINKS.baixar} className="corte inline-flex items-center gap-3 border border-borda bg-superficie-elevada px-8 py-4 font-titulo text-2xl text-texto transition-colors hover:border-texto-suave">
        <Download className="size-5 opacity-70" aria-hidden />
        Baixar para PC
      </a>
    </div>
  );
}
