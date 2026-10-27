import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Play, Radio, Search, Settings2, Shirt, Trophy, Users, Zap, type LucideIcon } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import type { Documento } from "@/modules/legal";
import { abrirLink } from "@/modules/platform";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";
import { IconeGithub } from "@/shared/ui/IconeGithub";

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
  /** O chat global, no canto de baixo à esquerda. */
  chat?: ReactNode;
}

interface Item {
  rotulo: string;
  icone: LucideIcon;
  acao: () => void;
}

const URL_DO_PROJETO = "https://github.com/lucasherrerods/riffrush";
const URL_DA_LANDING = "https://playriffrush.vercel.app";

export function MenuPrincipal({ volumeDosEfeitos, noCelular = false, aoJogar, aoMultijogador, aoPersonagem, aoConfigurar, aoBuscarMusicas, aoLeaderboard, aoOnline, aoAbrirDocumento, chat }: Props) {
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
    <div className="relative flex h-full flex-col items-center gap-6 overflow-y-auto py-6 max-md:gap-12">
      <motion.div
        initial={{ y: -40, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 12 }}
        className="mt-auto flex flex-col items-center gap-2"
      >
        <h1 aria-label="Riff Rush" className="titulo-do-jogo flex items-center gap-2 text-7xl leading-none tracking-[0.01em] max-md:text-[14vw]">
          Riff
          <motion.span animate={{ rotate: [-6, 6, -6] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
            <Zap className="size-12 fill-primaria text-primaria max-md:size-[10vw]" />
          </motion.span>
          Rush
        </h1>
        <p className="bg-primaria px-3 py-0.5 text-center text-sm font-bold tracking-[0.4em] text-texto -skew-x-12 max-md:tracking-[0.15em]">O PALCO É SEU</p>
      </motion.div>

      <nav className="mb-auto flex w-64 flex-col gap-1.5 max-md:w-[85vw] max-md:gap-2">
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
                "chapa flex items-center gap-4 px-4 py-1.5 text-left font-titulo text-xl max-md:px-6 max-md:py-3 max-md:text-3xl tracking-wide uppercase transition-colors",
                ativo ? "gasto border-primaria bg-primaria text-texto" : "border-borda bg-superficie text-texto-suave",
              )}
            >
              <Icone className="size-4 opacity-70 max-md:size-6" />
              {item.rotulo}
            </motion.button>
          );
        })}
      </nav>

      {chat && (
        <aside aria-label="Chat" className="absolute bottom-6 left-6 flex max-h-72 w-96 flex-col justify-end max-lg:hidden">
          {chat}
        </aside>
      )}

      <footer className="absolute right-6 bottom-6 flex items-center gap-3 text-sm text-texto-suave">
        {(
          [
            ["privacidade", "Política de Privacidade"],
            ["termos", "Termos de Uso"],
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
        <LinkExterno url={URL_DA_LANDING}>Sobre</LinkExterno>
        <span>© 2026 Riff Rush</span>
        <LinkExterno url={URL_DO_PROJETO} rotulo="Riff Rush no GitHub">
          <IconeGithub />
        </LinkExterno>
      </footer>
    </div>
  );
}

/** Link para fora do jogo: no app desktop abre no navegador do sistema, e não dentro da janela. */
function LinkExterno({ url, rotulo, children }: { url: string; rotulo?: string; children: ReactNode }) {
  return (
    <a
      href={url}
      aria-label={rotulo}
      onClick={(evento) => {
        evento.preventDefault();
        void abrirLink(url);
      }}
      className="opacity-70 transition-opacity hover:opacity-100"
    >
      {children}
    </a>
  );
}
