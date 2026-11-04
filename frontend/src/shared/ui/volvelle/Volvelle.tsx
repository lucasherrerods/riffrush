import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { aplicarTokens } from "@/shared/styles/tokens";
import type { Tema } from "@/shared/styles/temas";
import { CURVA_DO_GIRO, DURACAO_DO_GIRO_MS, geometriaDaVolvelle } from "./geometria";

export interface LadoDaVolvelle {
  cena: ReactNode;
  tema: Tema;
}

/** A foto da tela que saiu, posta no lugar exato onde ela estava. */
export interface FotoDaTela {
  elemento: HTMLElement;
  retangulo: { x: number; y: number; largura: number; altura: number };
}

type Geometria = ReturnType<typeof geometriaDaVolvelle>;

function useGeometria() {
  const [tamanho, setTamanho] = useState(() => ({ largura: window.innerWidth, altura: window.innerHeight }));
  useEffect(() => {
    const medir = () => setTamanho({ largura: window.innerWidth, altura: window.innerHeight });
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return geometriaDaVolvelle(tamanho.largura, tamanho.altura);
}

const GIRO: CSSProperties = { transitionDuration: `${DURACAO_DO_GIRO_MS}ms`, transitionTimingFunction: CURVA_DO_GIRO };

/** O disco: gira meia volta em torno do meio da borda de baixo da tela. */
function Disco({ geometria, virada, girando, children }: { geometria: Geometria; virada: boolean; girando: boolean; children: ReactNode }) {
  const { raio, eixo } = geometria;
  return (
    <div
      data-parte="disco"
      className={cn("pointer-events-none absolute rounded-full transition-transform", girando && "will-change-transform")}
      style={{ left: eixo.x - raio, top: eixo.y - raio, width: raio * 2, height: raio * 2, transform: `rotate(${virada ? 180 : 0}deg)`, ...GIRO }}
    >
      {children}
    </div>
  );
}

/** Uma metade do disco, pintada com o tema do seu modo sem mexer no tema do resto do app. */
function Metade({ lado, geometria, deCabeca, children, bloqueia = false }: { lado: LadoDaVolvelle; geometria: Geometria; deCabeca?: boolean; children?: ReactNode; bloqueia?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { raio, cena } = geometria;
  useLayoutEffect(() => {
    if (ref.current) aplicarTokens(ref.current, lado.tema);
  }, [lado.tema]);
  return (
    <div className={cn("absolute inset-0", deCabeca && "rotate-180")}>
      <div ref={ref} data-parte="metade" className={cn("absolute inset-x-0 top-0 overflow-hidden bg-fundo", bloqueia && "pointer-events-auto")} style={{ height: raio }}>
        <div className="absolute" style={{ left: cena.esquerda, top: cena.topo, width: cena.largura, height: cena.altura }}>
          {lado.cena}
        </div>
        {children}
      </div>
    </div>
  );
}

/** A foto da tela que saiu. */
function Foto({ foto }: { foto: FotoDaTela }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const caixa = ref.current;
    if (!caixa) return;
    caixa.replaceChildren(foto.elemento);
    return () => caixa.replaceChildren();
  }, [foto.elemento]);
  return <div ref={ref} data-parte="frente" className="absolute" style={{ left: foto.retangulo.x, top: foto.retangulo.y, width: foto.retangulo.largura, height: foto.retangulo.altura }} />;
}

interface PropsDoFundo {
  /** A metade de cima, de pé quando o disco está parado no começo. */
  cima: LadoDaVolvelle;
  /** A metade de baixo, de ponta-cabeça até o disco dar meia volta. */
  baixo: LadoDaVolvelle;
  /** Meia volta dada: a metade de baixo é a que aparece. */
  virada: boolean;
  /** Durante o giro as duas metades aparecem e as animações de dentro param, para o giro sair liso. */
  girando: boolean;
}

/**
 * Um disco giratório de papel, como nos livros infantis: o fundo da tela inicial dos dois modos.
 * A tela mostra a metade de cima; meia volta em torno do eixo, no meio da borda de baixo, traz a outra
 * metade com o outro cenário. A tela do modo novo já fica por cima, usável, desde o começo do giro.
 */
export function Volvelle({ cima, baixo, virada, girando }: PropsDoFundo) {
  const geometria = useGeometria();
  return (
    <div aria-hidden="true" data-girando={girando || undefined} className="volvelle pointer-events-none fixed inset-0 overflow-hidden">
      <Disco geometria={geometria} virada={virada} girando={girando}>
        {(girando || !virada) && <Metade lado={cima} geometria={geometria} />}
        {(girando || virada) && <Metade lado={baixo} geometria={geometria} deCabeca />}
      </Disco>
    </div>
  );
}

interface PropsDaCapa {
  /** O modo que está saindo: o cenário dele e a foto da tela dele. */
  saindo?: { lado: LadoDaVolvelle; emCima: boolean; foto?: FotoDaTela };
  virada: boolean;
}

/**
 * A capa do disco, por cima da tela: leva a metade do modo que saiu, com a foto da tela dele,
 * e gira junto com o fundo até sair da tela. A foto fica parada no lugar enquanto a linha passa,
 * cortando a tela antiga e revelando a nova, que já está montada por baixo.
 * Fica montada sempre que o disco aparece, para começar a girar do lugar certo.
 */
/** Faz o navegador registrar a posição de partida assim que a camada monta, para a transição sair dela. */
const registrarPartida = (elemento: HTMLElement | null) => {
  if (elemento) void getComputedStyle(elemento).transform;
};

export function CapaDaVolvelle({ saindo, virada }: PropsDaCapa) {
  const geometria = useGeometria();
  const { raio, cena } = geometria;
  const angulo = virada ? 180 : 0;
  return (
    <div aria-hidden="true" data-girando={saindo ? true : undefined} className="volvelle pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <Disco geometria={geometria} virada={virada} girando={!!saindo}>
        {saindo && (
          <Metade lado={saindo.lado} geometria={geometria} deCabeca={!saindo.emCima} bloqueia>
            {/* Gira o contrário do disco: a foto da tela fica parada enquanto a metade passa. */}
            <div
              ref={registrarPartida}
              className="absolute top-0 left-0 transition-transform"
              style={{ width: raio * 2, height: raio * 2, transformOrigin: `${raio}px ${raio}px`, transform: `rotate(${-(angulo + (saindo.emCima ? 0 : 180))}deg)`, ...GIRO }}
            >
              <div className="absolute" style={{ left: cena.esquerda, top: cena.topo, width: cena.largura, height: cena.altura }}>
                {saindo.foto && <Foto foto={saindo.foto} />}
              </div>
            </div>
          </Metade>
        )}
        {/* A dobra do papel entre os dois mundos: a linha que varre a tela no giro. */}
        {saindo && <div className="absolute inset-x-0 h-1 -translate-y-1/2 bg-texto/60" style={{ top: raio }} />}
      </Disco>
      {/* O miolo do mecanismo, no eixo: um mostrador que gira ao contrário, mais devagar, e só aparece no giro. */}
      <div
        className={cn("absolute rounded-full border-4 border-texto/60 bg-superficie-elevada transition-[transform,opacity]", saindo ? "opacity-100" : "opacity-0")}
        style={{ left: geometria.eixo.x - 80, top: geometria.eixo.y - 80, width: 160, height: 160, transform: `rotate(${virada ? -90 : 0}deg)`, ...GIRO }}
      >
        <div className="absolute inset-3 rounded-full bg-[repeating-conic-gradient(var(--cor-texto)_0deg_2deg,transparent_2deg_30deg)] opacity-50" />
        <div className="absolute top-1/2 left-1/2 size-8 -translate-1/2 rounded-full bg-primaria" />
      </div>
    </div>
  );
}
