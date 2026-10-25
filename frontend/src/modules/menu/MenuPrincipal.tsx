import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Radio, Search, Settings2, Shirt, Trophy, Users, Zap, type LucideIcon } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import type { Documento } from "@/modules/legal";
import { abrirLink } from "@/modules/platform";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";

interface Props {
  volumeDosEfeitos: number;
  /** Celular que entrou pelo QR code: o foco é a sala. */
  noCelular?: boolean;
  aoJogar: () => void;
  aoMultijogador: () => void;
  aoPersonagem: () => void;
  aoConfigurar: () => void;
  aoBuscarMusicas: () => void;
  /** Sem contas ligadas não há leaderboard, e a opção some. */
  aoLeaderboard?: () => void;
  /** Sem o relay ou sem contas não há quem está online, e a opção some. */
  aoOnline?: () => void;
  aoAbrirDocumento: (documento: Documento) => void;
}

interface Item {
  rotulo: string;
  icone: LucideIcon;
  acao: () => void;
}

const URL_DO_PROJETO = "https://github.com/lucasherrerods/riffrush";

export function MenuPrincipal({ volumeDosEfeitos, noCelular = false, aoJogar, aoMultijogador, aoPersonagem, aoConfigurar, aoBuscarMusicas, aoLeaderboard, aoOnline, aoAbrirDocumento }: Props) {
  const [selecionado, setSelecionado] = useState(0);
  const comuns: Item[] = [
    ...(aoLeaderboard ? [{ rotulo: "Leaderboard", icone: Trophy, acao: aoLeaderboard }] : []),
    ...(aoOnline ? [{ rotulo: "Online", icone: Radio, acao: aoOnline }] : []),
    { rotulo: "Buscar músicas", icone: Search, acao: aoBuscarMusicas },
    { rotulo: "Personagem", icone: Shirt, acao: aoPersonagem },
    { rotulo: "Configurações", icone: Settings2, acao: aoConfigurar },
  ];
  const itens: Item[] = noCelular
    ? [{ rotulo: "Entrar na sala", icone: Users, acao: aoMultijogador }, { rotulo: "Jogar sozinho", icone: Play, acao: aoJogar }, ...comuns]
    : [
        { rotulo: "Jogar", icone: Play, acao: aoJogar },
        { rotulo: "Multiplayer", icone: Users, acao: aoMultijogador },
        ...comuns,
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
        <p className="bg-primaria px-4 py-1 text-center text-base font-bold tracking-[0.4em] text-texto -skew-x-12 max-md:tracking-[0.15em]">O PALCO É SEU</p>
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

      <footer className="absolute right-6 bottom-6 flex items-center gap-3 text-base text-texto-suave">
        {(
          [
            ["privacidade", "Privacidade"],
            ["termos", "Termos"],
          ] as const
        ).map(([documento, rotulo]) => (
          <a
            key={documento}
            href={`/${documento}`}
            onClick={(evento) => {
              evento.preventDefault();
              aoAbrirDocumento(documento);
            }}
            className="opacity-70 transition-opacity hover:opacity-100"
          >
            {rotulo}
          </a>
        ))}
        <span>© 2026 Riff Rush</span>
        <a
          href={URL_DO_PROJETO}
          aria-label="Riff Rush no GitHub"
          onClick={(evento) => {
            evento.preventDefault();
            void abrirLink(URL_DO_PROJETO);
          }}
          className="opacity-70 transition-opacity hover:opacity-100"
        >
          {/* Marca do GitHub (Octicons, licença MIT): o lucide não tem mais ícones de marca. */}
          <svg viewBox="0 0 16 16" aria-hidden className="size-6 fill-current">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </footer>
    </div>
  );
}
