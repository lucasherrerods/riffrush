import { GanhoDeXp, type RegistroDaPartida } from "@/modules/conta";
import { Button } from "@/shared/ui/button";
import { SeloDaNota } from "@/shared/ui/SeloDaNota";
import { NOMES_DOS_JULGAMENTOS } from "./desenhar";
import { siglasDosMods } from "./mods";
import type { ResultadoDoMania } from "./TelaDeJogoMania";

const porcentagem = (precisao: number) => `${(precisao * 100).toFixed(2).replace(".", ",")}%`;

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
  return (
    <main className="flex h-full items-center justify-center bg-fundo p-6 text-texto">
      <section className="flex w-full max-w-xl flex-col gap-6 rounded-lg border border-borda bg-superficie p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-titulo text-4xl tracking-wide">{titulo}</h1>
            <p className="text-texto-suave">
              {dificuldade}
              {mods.length > 0 && ` · ${mods.join(" ")}`}
            </p>
          </div>
          <SeloDaNota precisao={resultado.precisao} className="text-6xl" />
        </header>
        {resultado.derrota && <p className="font-bold text-perigo">Você perdeu a música.</p>}
        <dl className="grid grid-cols-3 gap-4">
          <div>
            <dt className="text-texto-suave">Pontuação</dt>
            <dd className="font-titulo text-3xl">{resultado.pontuacao.toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt className="text-texto-suave">Precisão</dt>
            <dd className="font-titulo text-3xl">{porcentagem(resultado.precisao)}</dd>
          </div>
          <div>
            <dt className="text-texto-suave">Maior combo</dt>
            <dd className="font-titulo text-3xl">{resultado.maiorCombo}</dd>
          </div>
        </dl>
        <dl aria-label="Julgamentos" className="grid grid-cols-6 gap-2 text-center">
          {NOMES_DOS_JULGAMENTOS.map((nome, i) => (
            <div key={nome} className="rounded-md bg-superficie-elevada py-2">
              <dt className="text-sm text-texto-suave">{nome}</dt>
              <dd className="font-titulo text-2xl">{resultado.contagem[i]}</dd>
            </div>
          ))}
        </dl>
        {xp && <GanhoDeXp xp={xp} valeXp={valeXp} modo="mania" />}
        <div className="flex justify-end gap-4">
          <Button variant="secondary" onClick={aoVoltar}>
            Voltar
          </Button>
          <Button onClick={aoJogarDeNovo}>Jogar de novo</Button>
        </div>
      </section>
    </main>
  );
}
