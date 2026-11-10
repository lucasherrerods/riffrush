import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { useEffect, useState } from "react";
import { animate, motion } from "framer-motion";
import { ListMusic, RotateCcw, Star, Trophy } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { rotuloDoComando, useDispositivo } from "@/modules/gamepad";
import { corDaPrecisao, estiloDoJulgamento, JULGAMENTOS, type Resultado } from "@/modules/rock/gameplay";
import { DIFICULDADES } from "@/modules/rock/songs";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { CartaoDeResultado } from "@/modules/resultado";
import { Button } from "@/shared/ui/button";
import { estrelasDoResultado } from "./recordes";

interface Props {
  titulo: string;
  artista: string;
  /** A sequência fica nula em partidas antigas vindas do ranking. */
  resultado: Omit<Resultado, "maiorSequencia"> & { maiorSequencia: number | null };
  /** Partida de outra pessoa, aberta pelo ranking. */
  jogador?: { nome: string; avatar: string | null };
  recordeNovo: boolean;
  volumeDosEfeitos: number;
  aoRepetir: () => void;
  aoContinuar: () => void;
  /** Em rede: o placar da sala aparece aqui e o botão volta para a sala, sem "tocar de novo". */
  extra?: React.ReactNode;
  rotuloDeContinuar?: string;
}

const DURACAO_DA_CONTAGEM = 1.6;
const formatar = (n: number) => n.toLocaleString("pt-BR");

export function TelaDeResultado(props: Props) {
  const { titulo, artista, resultado, jogador, recordeNovo, volumeDosEfeitos, aoRepetir, aoContinuar, extra, rotuloDeContinuar } = props;
  const podeRepetir = rotuloDeContinuar === undefined;
  const [pontosNaTela, setPontosNaTela] = useState(0);
  const dispositivo = useDispositivo();
  // No celular não há teclado: os botões não mostram atalhos.
  const estreita = useTelaEstreita();
  const estrelas = estrelasDoResultado(resultado);
  const precisao = resultado.precisao ?? (resultado.total ? resultado.acertos / resultado.total : 0);
  const fullCombo = resultado.fullCombo ?? (resultado.total > 0 && resultado.acertos === resultado.total);

  useEffect(() => {
    const contagem = animate(0, resultado.pontos, {
      duration: DURACAO_DA_CONTAGEM,
      ease: "easeOut",
      onUpdate: (v) => setPontosNaTela(Math.round(v)),
    });
    const sons = Array.from({ length: estrelas }, (_, i) => setTimeout(() => tocarEfeito("selecionar", volumeDosEfeitos), (0.4 + i * 0.15) * 1000));
    return () => {
      contagem.stop();
      sons.forEach(clearTimeout);
    };
  }, [resultado.pontos, estrelas, volumeDosEfeitos]);

  useTeclado((evento) => {
    if (evento.code === "Enter" || evento.code === "Escape") {
      evento.preventDefault();
      aoContinuar();
    }
    else if (evento.code === "KeyR" && podeRepetir) aoRepetir();
  });

  const dificuldade = DIFICULDADES.find((d) => d.id === resultado.dificuldade)?.rotulo ?? "";
  const julgamentos = resultado.julgamentos && [
    ...JULGAMENTOS.map((j) => ({ rotulo: estiloDoJulgamento(j).texto, valor: resultado.julgamentos?.[j] ?? 0 })),
    { rotulo: "Miss", valor: resultado.total - resultado.acertos },
  ];

  return (
    <CartaoDeResultado
      titulo={titulo}
      subtitulo={
        <>
          {artista} · <span>{dificuldade}</span>
        </>
      }
      precisao={precisao}
      autor={
        jogador && (
          <p className="mt-2 flex items-center gap-2 text-sm font-bold">
            {jogador.avatar && <img src={jogador.avatar} alt="" referrerPolicy="no-referrer" className="size-8 rounded-sm" />}
            Partida de {jogador.nome}
          </p>
        )
      }
      destaques={
        <div className="flex flex-wrap items-center gap-4">
          <div role="img" aria-label={`${estrelas} de 5 estrelas`} className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <motion.div key={i} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.4 + i * 0.15, type: "spring", stiffness: 200 }}>
                <Star className={i < estrelas ? "size-8 fill-ouro text-ouro" : "size-8 text-borda"} />
              </motion.div>
            ))}
          </div>
          {recordeNovo && (
            <span className="flex items-center gap-2 rounded-full bg-destaque px-4 py-1 text-base font-black text-fundo">
              <Trophy className="size-4 opacity-70" /> Novo recorde
            </span>
          )}
          {fullCombo && <span className="rounded-full bg-primaria px-4 py-1 text-base font-black">Full combo!</span>}
        </div>
      }
      numeros={[
        { rotulo: "Pontuação", valor: formatar(pontosNaTela), rotuloDoValor: `${formatar(resultado.pontos)} pontos` },
        {
          rotulo: "Precisão",
          valor: (
            <span aria-label="Precisão" className={corDaPrecisao(precisao)}>{(precisao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
            </span>
          ),
        },
        { rotulo: "Maior sequência", valor: resultado.maiorSequencia === null ? "—" : String(resultado.maiorSequencia) },
        { rotulo: "Notas acertadas", valor: `${resultado.acertos} / ${resultado.total}` },
      ]}
      julgamentos={julgamentos}
      extra={extra}
      botoes={
        <>
          {podeRepetir && (
            <Button variant="secondary" onClick={aoRepetir}>
              <RotateCcw className="opacity-70" /> Tocar de novo{dispositivo === "teclado" && !estreita && " (R)"}
            </Button>
          )}
          <Button onClick={aoContinuar}>
            <ListMusic className="opacity-70" /> {rotuloDeContinuar ?? "Escolher outra"}
            {!estreita && ` (${rotuloDoComando("confirmar", dispositivo)})`}
          </Button>
        </>
      }
    />
  );
}
