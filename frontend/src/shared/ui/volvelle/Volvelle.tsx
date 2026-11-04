import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { aplicarTokens } from "@/shared/styles/tokens";
import type { Tema } from "@/shared/styles/temas";
import { CURVA_DO_GIRO, DURACAO_DO_GIRO_MS, geometriaDaVolvelle } from "./geometria";

export interface LadoDaVolvelle {
  cena: ReactNode;
  tema: Tema;
  /** O título do modo, parado na tela: o disco gira por baixo e a linha da troca o corta. */
  titulo?: ReactNode;
}

/** Onde o título fica na tela, medido na tela inicial. */
export interface PosicaoNaTela {
  x: number;
  y: number;
  largura: number;
}

interface Props {
  /** A metade de cima, de pé quando o disco está parado no começo. */
  cima: LadoDaVolvelle;
  /** A metade de baixo, de ponta-cabeça até o disco dar meia volta. */
  baixo: LadoDaVolvelle;
  /** Meia volta dada: a metade de baixo é a que aparece. */
  virada: boolean;
  /** Durante o giro as duas metades aparecem e as animações de dentro param, para o giro sair liso. */
  girando: boolean;
  posicaoDoTitulo?: PosicaoNaTela;
}

function useTamanhoDaTela() {
  const [tamanho, setTamanho] = useState(() => ({ largura: window.innerWidth, altura: window.innerHeight }));
  useEffect(() => {
    const medir = () => setTamanho({ largura: window.innerWidth, altura: window.innerHeight });
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return tamanho;
}

/** Uma metade do disco, pintada com o tema do seu modo sem mexer no tema do resto do app. */
interface PropsDaMetade {
  lado: LadoDaVolvelle;
  raio: number;
  cena: ReturnType<typeof geometriaDaVolvelle>["cena"];
  deCabeca?: boolean;
  visivel: boolean;
  /** Quanto o disco girou: a camada do título gira o contrário, para ficar parada na tela. */
  angulo: number;
  giro: CSSProperties;
  posicaoDoTitulo?: PosicaoNaTela;
  mostrarTitulo: boolean;
}

function Metade({ lado, raio, cena, deCabeca, visivel, angulo, giro, posicaoDoTitulo, mostrarTitulo }: PropsDaMetade) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) aplicarTokens(ref.current, lado.tema);
  }, [lado.tema]);
  return (
    <div className={cn("absolute inset-0", deCabeca && "rotate-180")}>
      <div ref={ref} data-parte="metade" className="absolute inset-x-0 top-0 overflow-hidden bg-fundo" style={{ height: raio }}>
        {/* A cena que não aparece nem monta: só entra quando o disco começa a girar. */}
        {visivel && (
          <div className="absolute" style={{ left: cena.esquerda, top: cena.topo, width: cena.largura, height: cena.altura }}>
            {lado.cena}
          </div>
        )}
        {/* Sempre montada, para girar junto desde o começo; só aparece durante a troca. */}
        {posicaoDoTitulo && lado.titulo && (
          <div
            className={cn("absolute top-0 left-0 transition-transform", !mostrarTitulo && "invisible")}
            style={{ width: raio * 2, height: raio * 2, transformOrigin: `${raio}px ${raio}px`, transform: `rotate(${-(angulo + (deCabeca ? 180 : 0))}deg)`, ...giro }}
          >
            <div data-parte="titulo" className="absolute flex flex-col items-center gap-2" style={{ left: cena.esquerda + posicaoDoTitulo.x, top: cena.topo + posicaoDoTitulo.y, width: posicaoDoTitulo.largura }}>
              {lado.titulo}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Um disco giratório de papel, como nos livros infantis: a tela mostra a metade de cima,
 * e meia volta em torno do eixo, no meio da borda de baixo, traz a outra metade com o outro cenário.
 * Os elementos de um mundo se põem de um lado enquanto os do outro nascem do lado oposto.
 */
export function Volvelle({ cima, baixo, virada, girando, posicaoDoTitulo }: Props) {
  const { largura, altura } = useTamanhoDaTela();
  const { raio, eixo, cena } = geometriaDaVolvelle(largura, altura);
  const angulo = virada ? 180 : 0;
  const giro = { transitionDuration: `${DURACAO_DO_GIRO_MS}ms`, transitionTimingFunction: CURVA_DO_GIRO } as CSSProperties;

  return (
    <div aria-hidden="true" data-girando={girando || undefined} className="volvelle pointer-events-none fixed inset-0 overflow-hidden">
      <div
        data-parte="disco"
        className={cn("absolute rounded-full transition-transform", girando && "will-change-transform")}
        style={{ left: eixo.x - raio, top: eixo.y - raio, width: raio * 2, height: raio * 2, transform: `rotate(${angulo}deg)`, ...giro }}
      >
        <Metade lado={cima} raio={raio} cena={cena} visivel={girando || !virada} angulo={angulo} giro={giro} posicaoDoTitulo={posicaoDoTitulo} mostrarTitulo={girando} />
        <Metade lado={baixo} raio={raio} cena={cena} deCabeca visivel={girando || virada} angulo={angulo} giro={giro} posicaoDoTitulo={posicaoDoTitulo} mostrarTitulo={girando} />
        {/* A dobra do papel entre os dois mundos: a linha que varre a tela no giro. */}
        <div className="absolute inset-x-0 h-1 -translate-y-1/2 bg-texto/60" style={{ top: raio }} />
      </div>
      {/* O miolo do mecanismo, no eixo: um mostrador que gira ao contrário, mais devagar, e só aparece no giro. */}
      <div
        className={cn("absolute rounded-full border-4 border-texto/60 bg-superficie-elevada transition-[transform,opacity]", girando ? "opacity-100" : "opacity-0")}
        style={{ left: eixo.x - 80, top: eixo.y - 80, width: 160, height: 160, transform: `rotate(${virada ? -90 : 0}deg)`, ...giro }}
      >
        <div className="absolute inset-3 rounded-full bg-[repeating-conic-gradient(var(--cor-texto)_0deg_2deg,transparent_2deg_30deg)] opacity-50" />
        <div className="absolute top-1/2 left-1/2 size-8 -translate-1/2 rounded-full bg-primaria" />
      </div>
    </div>
  );
}
