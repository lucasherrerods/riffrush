import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { CORES_DAS_PISTAS, COR_DA_ABERTA, COR_DA_ESTRELA } from "@/modules/rock/gameplay";
import { ABERTA, estadoNoInstante, type NotaNaTela, type Roteiro } from "./roteiro";

const LARGURA = 300;
const ALTURA = 340;
const TOPO = 16;
/** A linha de acerto, onde ficam os trastes. */
const LINHA = 270;
const MARGEM = 30;
const LARGURA_DA_PISTA = (LARGURA - MARGEM * 2) / 5;
const RAIO = 15;

const centro = (pista: number) => MARGEM + LARGURA_DA_PISTA * (pista + 0.5);
const alturaNa = (posicao: number) => TOPO + (LINHA - TOPO) * posicao;
const corDa = (nota: { pista: number; estrela?: boolean }) => (nota.estrela ? COR_DA_ESTRELA : nota.pista === ABERTA ? COR_DA_ABERTA : CORES_DAS_PISTAS[nota.pista]);

function Nota({ nota }: { nota: NotaNaTela }) {
  const y = alturaNa(nota.posicao);
  const cor = corDa(nota);
  const apagada = nota.passou && nota.resultado === "erro";
  const cauda = nota.cauda > 0 && (
    <rect
      x={(nota.pista === ABERTA ? LARGURA / 2 : centro(nota.pista)) - 4}
      y={y - (LINHA - TOPO) * nota.cauda}
      width={8}
      height={(LINHA - TOPO) * nota.cauda}
      rx={4}
      fill={cor}
      opacity={0.6}
    />
  );
  if (nota.pista === ABERTA)
    return (
      <g opacity={apagada ? 0.3 : 1}>
        {cauda}
        <rect x={MARGEM + 4} y={y - 7} width={LARGURA - MARGEM * 2 - 8} height={14} rx={7} fill={cor} stroke={nota.tipo ? "var(--cor-texto)" : "none"} strokeWidth={3} />
      </g>
    );
  const x = centro(nota.pista);
  return (
    <g opacity={apagada ? 0.3 : 1}>
      {cauda}
      {/* O HOPO tem o contorno claro; o tap, o centro vazado. */}
      <circle cx={x} cy={y} r={RAIO} fill={nota.tipo === "tap" ? "var(--cor-fundo)" : cor} stroke={nota.tipo ? "var(--cor-texto)" : cor} strokeWidth={nota.tipo ? 4 : 2} />
      {nota.tipo === "tap" && <circle cx={x} cy={y} r={RAIO - 6} fill={cor} />}
      {!nota.tipo && <circle cx={x} cy={y} r={RAIO - 7} fill="var(--cor-texto)" opacity={0.35} />}
    </g>
  );
}

interface Props {
  roteiro: Roteiro;
  /** Um nome para os leitores de tela, já que a animação é só visual. */
  rotulo: string;
}

/** A pista em miniatura de um tutorial: repete o roteiro em laço, com as legendas no ritmo. */
export function DemonstracaoDaPista({ roteiro, rotulo }: Props) {
  const semMovimento = useReducedMotion();
  // Sem movimento, a pista para no meio do roteiro, onde as notas já estão chegando, e as legendas aparecem todas.
  const [tempo, setTempo] = useState(() => roteiro.legendas[0]?.ate ?? roteiro.duracao / 2);
  useEffect(() => {
    if (semMovimento) return;
    const inicio = performance.now();
    let quadro = requestAnimationFrame(function passo(agora) {
      setTempo(((agora - inicio) / 1000) % roteiro.duracao);
      quadro = requestAnimationFrame(passo);
    });
    return () => cancelAnimationFrame(quadro);
  }, [roteiro, semMovimento]);

  const estado = estadoNoInstante(roteiro, tempo);
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${LARGURA} ${roteiro.comPalheta ? ALTURA : LINHA + 30}`} role="img" aria-label={rotulo} className="max-h-[45dvh] w-full max-w-72">
        <rect x={MARGEM} y={0} width={LARGURA - MARGEM * 2} height={LINHA + 22} rx={8} fill={estado.estrelaAtiva ? COR_DA_ESTRELA : "var(--cor-fundo)"} opacity={estado.estrelaAtiva ? 0.18 : 1} />
        {[1, 2, 3, 4].map((i) => (
          <line key={i} x1={MARGEM + LARGURA_DA_PISTA * i} x2={MARGEM + LARGURA_DA_PISTA * i} y1={0} y2={LINHA + 22} stroke="var(--cor-borda)" strokeWidth={1} />
        ))}
        <line x1={MARGEM} x2={LARGURA - MARGEM} y1={LINHA} y2={LINHA} stroke="var(--cor-texto)" strokeWidth={2} opacity={0.5} />

        {estado.notas.map((nota, i) => (
          <Nota key={`${nota.tempo}-${nota.pista}-${i}`} nota={nota} />
        ))}

        {/* Os trastes na linha: acesos quando apertados. */}
        {CORES_DAS_PISTAS.map((cor, pista) => {
          const apertado = estado.apertados.has(pista);
          return <circle key={cor} cx={centro(pista)} cy={LINHA} r={apertado ? RAIO + 2 : RAIO - 2} fill={apertado ? cor : "var(--cor-fundo)"} stroke={cor} strokeWidth={3} />;
        })}

        {estado.retornos.map((r, i) =>
          r.tipo === "acerto" ? (
            <circle
              key={i}
              cx={r.pista === ABERTA ? LARGURA / 2 : centro(r.pista)}
              cy={LINHA}
              r={RAIO + 10 * (1 - r.forca)}
              fill="none"
              stroke={r.pista === ABERTA ? COR_DA_ABERTA : CORES_DAS_PISTAS[r.pista]}
              strokeWidth={3}
              opacity={r.forca}
            />
          ) : (
            <text key={i} x={centro(r.pista)} y={LINHA - 26} textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--cor-perigo)" opacity={r.forca}>
              ×
            </text>
          ),
        )}

        <text x={LARGURA - MARGEM - 6} y={TOPO + 14} textAnchor="end" fontSize={16} fontWeight={700} fill={estado.emVao ? "var(--cor-perigo)" : "var(--cor-texto)"}>
          {estado.sequencia}
        </text>

        {roteiro.comPalheta && (
          <g aria-hidden>
            <rect x={LARGURA / 2 - 50} y={LINHA + 34} width={100} height={18} rx={9} fill={estado.palhetando ? (estado.emVao ? "var(--cor-perigo)" : "var(--cor-texto)") : "var(--cor-superficie-elevada)"} stroke="var(--cor-borda)" strokeWidth={2} />
            <text x={LARGURA / 2} y={LINHA + 66} textAnchor="middle" fontSize={11} fill="var(--cor-texto-suave)">
              palheta
            </text>
          </g>
        )}
      </svg>
      <figcaption aria-live="off" className="min-h-6 text-center text-base text-texto">
        {semMovimento ? roteiro.legendas.map((l) => l.texto).join(" ") : (estado.legenda ?? " ")}
      </figcaption>
    </figure>
  );
}
