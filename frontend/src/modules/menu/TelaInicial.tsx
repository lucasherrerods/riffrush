import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";

/** A troca de modo em andamento: as opções saem voando, o disco gira, e as do outro modo chegam. */
export interface TrocaDeModo {
  fase: "saindo" | "chegando";
  /** Para que lado o disco gira: as opções saem para um lado e chegam do outro. */
  sentido: 1 | -1;
}

/** O que o app passa a cada modo quando a tela inicial é compartilhada entre eles. */
export interface PalcoCompartilhado {
  troca?: TrocaDeModo;
  /** O modo avisa se está na tela inicial, para o app mostrar o disco atrás dela. */
  aoMudarDeTela: (naTelaInicial: boolean) => void;
}

/** Marca a tela de cada modo: no clique da troca, o app tira uma foto dela para a capa do disco. */
export const PARTE_DA_TELA_DO_MODO = "tela-do-modo";

export interface OpcaoDaTelaInicial {
  rotulo: string;
  icone: LucideIcon;
  acao: () => void;
}

interface Props {
  logo: ReactNode;
  subtitulo: string;
  /** A alavanca que troca de modo, embaixo da logo. */
  alavanca?: ReactNode;
  opcoes: OpcaoDaTelaInicial[];
  rotuloDoMenu?: string;
  /** Com uma janela aberta por cima, as setas e o Enter são dela. */
  pausada?: boolean;
  /** Para o modo tocar os próprios efeitos. */
  aoMover?: () => void;
  aoEscolher?: () => void;
  /** Como cada modo desenha o ícone e a chapa da opção. */
  desenharIcone?: (opcao: OpcaoDaTelaInicial, ativa: boolean) => ReactNode;
  classeDaOpcao?: (ativa: boolean) => string;
  classeDoMenu?: string;
  className?: string;
  /** O que cada modo põe a mais na tela: chat, rodapé, janelas. */
  children?: ReactNode;
  troca?: TrocaDeModo;
  /** Só a imagem da tela, desenhada no disco da troca: sem teclado e sem animação de entrada. */
  estatica?: boolean;
}

const iconePadrao = ({ icone: Icone }: OpcaoDaTelaInicial) => <Icone className="size-3.5 opacity-70 max-md:size-5" />;
const classePadrao = (ativa: boolean) => (ativa ? "gasto border-primaria bg-primaria text-texto" : "border-borda bg-superficie text-texto-suave");

/**
 * A tela inicial dos dois modos: logo, subtítulo, alavanca e as opções em chapas,
 * com setas e Enter. Cada modo só diz quais são as opções e como elas se desenham.
 */
export function TelaInicial({
  logo,
  subtitulo,
  alavanca,
  opcoes,
  rotuloDoMenu,
  pausada = false,
  aoMover,
  aoEscolher,
  desenharIcone = iconePadrao,
  classeDaOpcao = classePadrao,
  classeDoMenu = "w-56 gap-1",
  className,
  children,
  troca,
  estatica = false,
}: Props) {
  // Na troca a tela nova já aparece no lugar, usável, enquanto a capa com a antiga sai girando.
  const semEntrada = estatica || troca?.fase === "chegando";
  // A alavanca e as opções chegam voando de um lado, uma atrás da outra, ao abrir o jogo e ao voltar para a tela inicial.
  const voo = {
    inicio: semEntrada ? (false as const) : { x: "70vw", opacity: 0, rotate: 8 },
    parada: { x: 0, opacity: 1, rotate: 0 },
    transicao: (ordem: number) => ({ type: "spring" as const, stiffness: 140, damping: 18, delay: 0.15 + ordem * 0.06 }),
  };
  const [selecionada, setSelecionada] = useState(0);

  const escolher = (opcao: OpcaoDaTelaInicial) => {
    aoEscolher?.();
    opcao.acao();
  };

  useTeclado((evento) => {
    if (pausada || estatica) return;
    if (evento.code === "ArrowDown" || evento.code === "ArrowUp") {
      evento.preventDefault();
      aoMover?.();
      const passo = evento.code === "ArrowDown" ? 1 : opcoes.length - 1;
      setSelecionada((atual) => (atual + passo) % opcoes.length);
    } else if (evento.code === "Enter") {
      evento.preventDefault();
      escolher(opcoes[selecionada]);
    }
  });

  return (
    <div
      className={cn("rolagem-de-toque relative flex h-full flex-col items-center gap-6 overflow-x-hidden py-6 max-md:px-4", className)}
    >
      <motion.div
        initial={semEntrada ? false : { y: -40, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 12 }}
        className="mt-auto flex flex-col items-center gap-2"
      >
        {logo}
        <p className="text-center text-xs font-bold tracking-[0.4em] text-texto-suave max-md:tracking-[0.15em]">{subtitulo}</p>
        {alavanca && (
          <motion.div initial={voo.inicio} animate={voo.parada} transition={voo.transicao(0)}>
            {alavanca}
          </motion.div>
        )}
      </motion.div>

      <nav aria-label={rotuloDoMenu} className={cn("mb-auto flex flex-col max-md:w-full max-md:max-w-sm max-md:gap-2", classeDoMenu)}>
        {opcoes.map((opcao, i) => {
          const ativa = i === selecionada;
          return (
            <motion.button
              key={opcao.rotulo}
              aria-current={ativa}
              // As opções sempre chegam voando de um lado: ao abrir o jogo, ao voltar para a tela inicial e na troca de modo.
              initial={voo.inicio}
              animate={voo.parada}
              transition={voo.transicao(i + 1)}
              onMouseEnter={() => {
                if (!ativa) aoMover?.();
                setSelecionada(i);
              }}
              onClick={() => escolher(opcao)}
              className={cn(
                "chapa flex items-center gap-3 px-3 py-1 text-left font-titulo text-lg tracking-wide uppercase transition-colors max-md:px-4 max-md:py-2 max-md:text-xl",
                classeDaOpcao(ativa),
              )}
            >
              {desenharIcone(opcao, ativa)}
              {opcao.rotulo}
            </motion.button>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
