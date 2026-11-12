import { GanhoDeXp, type RegistroDaPartida } from "@/modules/conta";
import { BarraDeDesvio, CartaoDeResultado, GraficoDaPrecisao } from "@/modules/resultado";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { NOMES_DOS_JULGAMENTOS } from "./desenhar";
import { comoPorcentagem, curvaDaPrecisao, histogramaDosDesvios, resumoDosDesvios } from "./estatisticas";
import { siglasDosMods } from "./mods";
import type { ResultadoDoMania } from "./TelaDeJogoMania";

const PONTOS_DA_CURVA = 80;
const FAIXAS_DO_DESVIO = 41;

interface Props {
  titulo: string;
  dificuldade: string;
  resultado: ResultadoDoMania;
  aoJogarDeNovo: () => void;
  aoVoltar: () => void;
  /** Com a conta conectada: o XP da partida (ou a espera por ele). */
  xp?: RegistroDaPartida;
  valeXp?: boolean;
}

export function ResultadoDoMania({ titulo, dificuldade, resultado, aoJogarDeNovo, aoVoltar, xp, valeXp = false }: Props) {
  const mods = siglasDosMods(resultado.mods);
  const { julgamentos, desvios } = resultado.estatisticas;
  const { media, ur } = resumoDosDesvios(desvios);
  // Os mesmos atalhos do resultado do Rock.
  useTeclado((evento) => {
    if (evento.code === "Enter" || evento.code === "Escape") {
      evento.preventDefault();
      aoVoltar();
    } else if (evento.code === "KeyR") aoJogarDeNovo();
  });
  return (
    <CartaoDeResultado
      titulo={titulo}
      subtitulo={`${dificuldade}${mods.length > 0 ? ` · ${mods.join(" ")}` : ""}`}
      precisao={resultado.precisao}
      destaques={resultado.derrota && <p className="font-bold text-perigo">Você perdeu a música.</p>}
      numeros={[
        { rotulo: "Pontuação", valor: resultado.pontuacao.toLocaleString("pt-BR") },
        { rotulo: "Precisão", valor: comoPorcentagem(resultado.precisao) },
        { rotulo: "Maior combo", valor: resultado.maiorCombo },
      ]}
      julgamentos={NOMES_DOS_JULGAMENTOS.map((nome, i) => ({ rotulo: nome, valor: resultado.contagem[i] }))}
      extra={
        <>
          <GraficoDaPrecisao curva={curvaDaPrecisao(julgamentos, PONTOS_DA_CURVA)} />
          <BarraDeDesvio histograma={histogramaDosDesvios(desvios, resultado.janelaMs, FAIXAS_DO_DESVIO)} mediaMs={media} ur={ur} />
          {xp && <GanhoDeXp xp={xp} valeXp={valeXp} modo="mania" />}
        </>
      }
      botoes={
        <>
          <Button variant="secondary" onClick={aoVoltar}>
            Voltar
          </Button>
          <Button onClick={aoJogarDeNovo}>Jogar de novo</Button>
        </>
      }
    />
  );
}
