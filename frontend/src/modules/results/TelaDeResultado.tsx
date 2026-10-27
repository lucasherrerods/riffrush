import { useEffect, useState } from "react";
import { animate, motion } from "framer-motion";
import { ListMusic, RotateCcw, Star, Trophy } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { rotuloDoComando, useDispositivo } from "@/modules/gamepad";
import { corDaPrecisao, type Resultado } from "@/modules/gameplay";
import { DIFICULDADES } from "@/modules/songs";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";
import { SeloDaNota } from "@/shared/ui/SeloDaNota";
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
  const estrelas = estrelasDoResultado(resultado);
  const precisao = resultado.precisao ?? (resultado.total ? resultado.acertos / resultado.total : 0);
  const fullCombo = resultado.total > 0 && resultado.acertos === resultado.total;

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
    if (evento.code === "Enter" || evento.code === "Escape") aoContinuar();
    else if (evento.code === "KeyR" && podeRepetir) aoRepetir();
  });

  const estatisticas = [
    { rotulo: "Notas acertadas", valor: `${resultado.acertos} / ${resultado.total}` },
    { rotulo: "Maior sequência", valor: resultado.maiorSequencia === null ? "—" : String(resultado.maiorSequencia) },
    { rotulo: "Dificuldade", valor: DIFICULDADES.find((d) => d.id === resultado.dificuldade)?.rotulo ?? "" },
  ];
  const julgamentos = resultado.julgamentos && [
    { rotulo: "Perfeito", valor: resultado.julgamentos.perfeito },
    { rotulo: "Ótimo", valor: resultado.julgamentos.otimo },
    { rotulo: "Bom", valor: resultado.julgamentos.bom },
    { rotulo: "Erro", valor: resultado.total - resultado.acertos },
  ];

  return (
    // Com a sala cheia o placar não cabe: a tela rola e os botões ficam presos embaixo, sem fundo, para não esconder nada.
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex shrink-0 grow flex-col items-center px-8 pt-6 max-md:px-4 max-md:pt-4">
        <div className="my-auto flex w-full flex-col items-center gap-5">
          <div className="text-center">
            <p className="text-sm font-semibold tracking-[0.3em] text-texto-suave">RESULTADO</p>
            <h1 className="mt-1 text-4xl leading-[1.1] max-md:text-3xl font-black tracking-[-0.02em]">{titulo}</h1>
            <p className="mt-1 text-sm text-texto-suave">{artista}</p>
            {jogador && (
              <p className="mt-3 flex items-center justify-center gap-2 text-sm font-bold">
                {jogador.avatar && <img src={jogador.avatar} alt="" referrerPolicy="no-referrer" className="size-8 rounded-sm" />}
                Partida de {jogador.nome}
              </p>
            )}
          </div>

          <div role="img" aria-label={`${estrelas} de 5 estrelas`} className="flex gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.4 + i * 0.15, type: "spring", stiffness: 200 }}
              >
                <Star className={i < estrelas ? "size-10 fill-ouro text-ouro" : "size-10 text-borda"} />
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-6">
              <SeloDaNota precisao={precisao} className="text-7xl max-md:text-5xl" />
              <p aria-label={`${formatar(resultado.pontos)} pontos`} className="font-mono text-6xl font-black tabular-nums max-md:text-5xl">
                {formatar(pontosNaTela)}
              </p>
            </div>
            <p className="text-sm font-bold tracking-[0.2em] text-texto-suave">
              PRECISÃO{" "}
              <span aria-label="Precisão" className={cn("font-titulo text-3xl tracking-normal tabular-nums", corDaPrecisao(precisao))}>
                {(precisao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
              </span>
            </p>
            {(recordeNovo || fullCombo) && (
              <div className="flex gap-2">
                {recordeNovo && (
                  <span className="flex items-center gap-2 rounded-full bg-destaque px-4 py-2 text-base font-black text-fundo">
                    <Trophy className="size-4 opacity-70" /> Novo recorde
                  </span>
                )}
                {fullCombo && <span className="rounded-full bg-primaria px-4 py-2 text-base font-black">Full combo!</span>}
              </div>
            )}
          </div>

          {extra}

          <dl className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
            {estatisticas.map((e) => (
              <div key={e.rotulo} className="chapa w-36 px-3 py-2 text-center">
                <dd className="text-xl font-black">{e.valor}</dd>
                <dt className="text-sm text-texto-suave">{e.rotulo}</dt>
              </div>
            ))}
          </dl>

          {julgamentos && (
            <dl className="flex gap-6">
              {julgamentos.map((j) => (
                <div key={j.rotulo} className="text-center">
                  <dd className="font-titulo text-2xl tabular-nums">{j.valor}</dd>
                  <dt className="text-sm text-texto-suave">{j.rotulo}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="pointer-events-none sticky bottom-0 flex justify-center gap-4 px-8 pt-4 pb-6 max-md:px-4 max-md:pb-4 [&>*]:pointer-events-auto">
        {podeRepetir && (
          <Button size="lg" variant="outline" onClick={aoRepetir}>
            <RotateCcw className="opacity-70" /> Tocar de novo{dispositivo === "teclado" && " (R)"}
          </Button>
        )}
        <Button size="lg" onClick={aoContinuar}>
          <ListMusic className="opacity-70" /> {rotuloDeContinuar ?? "Escolher outra"} ({rotuloDoComando("confirmar", dispositivo)})
        </Button>
      </div>
    </div>
  );
}
