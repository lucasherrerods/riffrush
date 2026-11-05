import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { aplicarTokens } from "@/shared/styles/tokens";
import type { Tema } from "@/shared/styles/temas";
import { CURVA_DO_GIRO, DURACAO_DO_GIRO_MS, curvaDoGiro, geometriaDaVolvelle, semiplanoDaCapa } from "./geometria";

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
  /** A metade do modo que sai fica o giro inteiro embaixo da capa: não precisa ser desenhada duas vezes. */
  coberta?: "cima" | "baixo";
}

/**
 * Um disco giratório de papel, como nos livros infantis: o fundo da tela inicial dos dois modos.
 * A tela mostra a metade de cima; meia volta em torno do eixo, no meio da borda de baixo, traz a outra
 * metade com o outro cenário. A tela do modo novo já fica por cima, usável, desde o começo do giro.
 */
export function Volvelle({ cima, baixo, virada, girando, coberta }: PropsDoFundo) {
  const geometria = useGeometria();
  return (
    <div aria-hidden="true" data-girando={girando || undefined} className="volvelle pointer-events-none fixed inset-0 overflow-hidden">
      <Disco geometria={geometria} virada={virada} girando={girando}>
        {(girando ? coberta !== "cima" : !virada) && <Metade lado={cima} geometria={geometria} />}
        {(girando ? coberta !== "baixo" : virada) && <Metade lado={baixo} geometria={geometria} deCabeca />}
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
export function CapaDaVolvelle({ saindo, virada }: PropsDaCapa) {
  const geometria = useGeometria();
  const { raio, eixo } = geometria;
  const angulo = virada ? 180 : 0;
  // Quanto o disco já girou desde a partida: é o ângulo da linha que corta a foto.
  const alvo = saindo ? angulo - (saindo.emCima ? 0 : 180) : 0;
  const recorte = useRecorteQueGira(alvo, eixo, raio, !saindo);
  return (
    <div aria-hidden="true" data-girando={saindo ? true : undefined} className="volvelle pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <Disco geometria={geometria} virada={virada} girando={!!saindo}>
        {saindo && <Metade lado={saindo.lado} geometria={geometria} deCabeca={!saindo.emCima} bloqueia />}
      </Disco>
      {/*
        A foto da tela que saiu fica fora do disco, parada e em resolução cheia: girar a cópia junto com o disco
        (e desgirar de volta) fazia o navegador desenhá-la mais borrada. Um recorte no ângulo da linha a corta.
      */}
      {saindo?.foto && (
        <div ref={recorte} data-parte="foto" className="pointer-events-auto absolute inset-0">
          <Foto foto={saindo.foto} />
        </div>
      )}
      <Disco geometria={geometria} virada={virada} girando={!!saindo}>
        {/* A dobra do papel entre os dois mundos: a linha que varre a tela no giro. */}
        {saindo && <div className="absolute inset-x-0 h-1 -translate-y-1/2 bg-texto/60" style={{ top: raio }} />}
        {/* O miolo do mecanismo, no eixo, girando junto com o disco: uma animação à parte por cima da capa fazia o navegador redesenhá-la a cada quadro. */}
        {saindo && (
          <div className="absolute rounded-full border-4 border-texto/60 bg-superficie-elevada" style={{ left: raio - 80, top: raio - 80, width: 160, height: 160 }}>
            <div className="absolute inset-3 rounded-full bg-[repeating-conic-gradient(var(--cor-texto)_0deg_2deg,transparent_2deg_30deg)] opacity-50" />
            <div className="absolute top-1/2 left-1/2 size-8 -translate-1/2 rounded-full bg-primaria" />
          </div>
        )}
      </Disco>
    </div>
  );
}

/** Recorta o elemento no lado de cima da linha do disco, acompanhando o giro quadro a quadro com a mesma curva. */
function useRecorteQueGira(alvo: number, eixo: { x: number; y: number }, raio: number, imediato: boolean) {
  const elemento = useRef<HTMLDivElement | null>(null);
  const atual = useRef(0);
  useLayoutEffect(() => {
    const de = atual.current;
    const aplicar = (graus: number) => {
      atual.current = graus;
      if (elemento.current) elemento.current.style.clipPath = semiplanoDaCapa(eixo, raio * 2, graus);
    };
    // Sem troca, volta para a partida na hora, pronto para o próximo giro.
    if (de === alvo || imediato) return aplicar(alvo);
    const comeco = performance.now();
    let quadro = requestAnimationFrame(function passo(agora) {
      const t = Math.min(1, (agora - comeco) / DURACAO_DO_GIRO_MS);
      aplicar(de + (alvo - de) * curvaDoGiro(t));
      if (t < 1) quadro = requestAnimationFrame(passo);
    });
    return () => cancelAnimationFrame(quadro);
  }, [alvo, imediato, eixo.x, eixo.y, raio]); // eslint-disable-line react-hooks/exhaustive-deps
  return useCallback(
    (el: HTMLDivElement | null) => {
      elemento.current = el;
      if (el) el.style.clipPath = semiplanoDaCapa(eixo, raio * 2, atual.current);
    },
    [eixo.x, eixo.y, raio], // eslint-disable-line react-hooks/exhaustive-deps
  );
}
