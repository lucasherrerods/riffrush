import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { tocarTrovao } from "@/modules/audio";
import { ENTRADA, emCaminho, raioDaEntrada } from "../entrada";

interface Props {
  titulo: string;
  artista?: string;
  /** Dificuldade e instrumento, embaixo do nome. */
  detalhe: string;
  volumeDosEfeitos: number;
  /** Na hora em que as faixas abrem: a partida monta por baixo. */
  aoAbrir: () => void;
  /** Quando a entrada sai da tela. */
  aoTerminar: () => void;
}

const FAIXA = "absolute inset-y-[-20%] w-[160%] -skew-x-12";

/**
 * A entrada na música: clarão e trovão, um raio cortando a tela, faixas vermelha e preta varrendo na diagonal
 * e o nome da música entrando com um tranco. No fim as faixas abrem para a partida.
 * Qualquer tecla ou clique pula.
 */
export function EntradaDaPartida({ titulo, artista, detalhe, volumeDosEfeitos, aoAbrir, aoTerminar }: Props) {
  const raio = useMemo(() => raioDaEntrada(Math.floor(Math.random() * 1e6)), []);
  const avisos = useRef({ aoAbrir, aoTerminar });
  avisos.current = { aoAbrir, aoTerminar };

  useEffect(() => {
    tocarTrovao(volumeDosEfeitos);
    let abriu = false;
    const abrir = () => {
      if (abriu) return;
      abriu = true;
      avisos.current.aoAbrir();
    };
    const terminar = () => {
      abrir();
      avisos.current.aoTerminar();
    };
    const timers = [setTimeout(abrir, ENTRADA.saida * 1000), setTimeout(terminar, ENTRADA.total * 1000)];
    const pular = (evento: Event) => {
      evento.preventDefault();
      evento.stopPropagation();
      terminar();
    };
    window.addEventListener("keydown", pular, true);
    window.addEventListener("pointerdown", pular, true);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", pular, true);
      window.removeEventListener("pointerdown", pular, true);
    };
    // O trovão toca uma vez, na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const em = (segundos: number) => segundos / ENTRADA.total;

  return (
    <div role="status" aria-label={`Entrando em ${titulo}`} className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {/* As faixas entram da esquerda, param cobrindo a tela e saem pela direita. */}
      <motion.div
        className={`${FAIXA} -left-[30%] bg-primaria`}
        initial={{ x: "-110%" }}
        animate={{ x: ["-110%", "0%", "0%", "110%"] }}
        transition={{ duration: ENTRADA.total, times: [0, em(ENTRADA.varrida) * 0.7, em(ENTRADA.saida), 1], ease: ["easeOut", "linear", "easeIn"] }}
      />
      <motion.div
        className={`${FAIXA} -left-[30%] bg-fundo`}
        initial={{ x: "-110%" }}
        animate={{ x: ["-110%", "-110%", "0%", "0%", "110%"] }}
        transition={{ duration: ENTRADA.total, times: [0, em(0.12), em(ENTRADA.varrida), em(ENTRADA.saida + 0.08), 1], ease: ["linear", "easeOut", "linear", "easeIn"] }}
      />

      {/* O raio pisca como um de verdade: acende, quase apaga e volta. */}
      <motion.svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.25, 1, 0.6, 0] }}
        transition={{ duration: 0.9, times: [0, 0.05, 0.15, 0.25, 0.6, 1] }}
      >
        {[raio.principal, ...raio.galhos].map((pontos, i) => (
          <g key={i}>
            <polyline points={emCaminho(pontos)} fill="none" stroke="var(--color-primaria)" strokeOpacity={0.5} strokeWidth={i ? 10 : 22} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <polyline points={emCaminho(pontos)} fill="none" stroke="var(--color-texto)" strokeWidth={i ? 2 : 5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>
        ))}
      </motion.svg>

      {/* O clarão do raio, com um segundo mais fraco logo depois. */}
      <motion.div
        className="absolute inset-0 bg-texto"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0, 0.45, 0] }}
        transition={{ duration: 0.45, times: [0, 0.08, 0.35, 0.5, 1] }}
      />

      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], x: [0, 0, -14, 12, -8, 5, 0, 0] }}
        transition={{
          opacity: { duration: ENTRADA.total, times: [0, em(ENTRADA.nome), em(ENTRADA.nome + 0.05), em(ENTRADA.saida), em(ENTRADA.saida + 0.2)] },
          x: { duration: ENTRADA.total, times: [0, em(ENTRADA.nome + 0.12), em(ENTRADA.nome + 0.16), em(ENTRADA.nome + 0.2), em(ENTRADA.nome + 0.24), em(ENTRADA.nome + 0.28), em(ENTRADA.nome + 0.32), 1] },
        }}
      >
        <motion.p
          className="text-xl font-bold tracking-[0.3em] text-primaria uppercase"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: ENTRADA.nome + 0.15, duration: 0.25 }}
        >
          {detalhe}
        </motion.p>
        <motion.h2
          className="max-w-[90vw] font-titulo text-[clamp(3.5rem,11vw,10rem)] leading-[0.9] tracking-wide text-texto uppercase"
          initial={{ scale: 2.4 }}
          animate={{ scale: 1 }}
          transition={{ delay: ENTRADA.nome, type: "spring", stiffness: 520, damping: 22 }}
        >
          {titulo}
        </motion.h2>
        {artista && (
          <motion.p
            className="text-2xl font-bold text-texto-suave"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: ENTRADA.nome + 0.2, duration: 0.25 }}
          >
            {artista}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
