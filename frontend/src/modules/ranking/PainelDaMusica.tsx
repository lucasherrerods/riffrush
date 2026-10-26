import { useState } from "react";
import { ArrowLeft, Download, Music, Play } from "lucide-react";
import { DIFICULDADES, INSTRUMENTOS, type Dificuldade, type Instrumento } from "@/modules/songs";
import { Button } from "@/shared/ui/button";
import { CampoDeSelecao } from "@/shared/ui/CampoDeSelecao";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import type { ApiDoRanking, MusicaNoRanking, OrdemDoRanking } from "./api";
import { PainelDeRanking } from "./PainelDeRanking";

const ORDENS: { id: OrdemDoRanking; rotulo: string }[] = [
  { id: "precisao", rotulo: "Precisão" },
  { id: "pontos", rotulo: "Pontos" },
];

interface Props {
  musica: MusicaNoRanking;
  nome: string;
  aoVoltar: () => void;
  /** Só música do Encore tem de onde baixar. */
  aoBaixar?: () => void;
  /** Só música da biblioteca tem áudio para a prévia. */
  aoOuvir?: () => void;
  aoAbrirPartida?: (partidaId: string) => void;
  api?: Pick<ApiDoRanking, "buscar">;
}

/** O ranking de uma música do leaderboard, com a dificuldade, o instrumento e a ordem escolhidos. */
export function PainelDaMusica({ musica, nome, aoVoltar, aoBaixar, aoOuvir, aoAbrirPartida, api }: Props) {
  // Abre onde está o recorde: é onde a disputa é mais interessante.
  const [dificuldade, setDificuldade] = useState<Dificuldade>(musica.recorde?.dificuldade ?? "expert");
  const [instrumento, setInstrumento] = useState<Instrumento>("guitarra");
  const [ordem, setOrdem] = useState<OrdemDoRanking>("precisao");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar às músicas">
          <ArrowLeft />
        </Button>
        {musica.capa ? <img src={musica.capa} alt="" referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-sm" /> : <Music className="size-12 shrink-0 text-texto-suave opacity-70" aria-hidden />}
        <h2 className="min-w-0 flex-1 truncate font-titulo text-2xl">{nome}</h2>
        {aoOuvir && (
          <Button variant="outline" onClick={aoOuvir}>
            <Play className="opacity-70" /> Ouvir prévia
          </Button>
        )}
        {aoBaixar && (
          <Button variant="outline" onClick={aoBaixar}>
            <Download className="opacity-70" /> Baixar
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <CampoDeSelecao titulo="Dificuldade" opcoes={DIFICULDADES} valor={dificuldade} aoEscolher={setDificuldade} />
        <CampoDeSelecao titulo="Instrumento" opcoes={INSTRUMENTOS} valor={instrumento} aoEscolher={setInstrumento} />
        <GrupoDeOpcoes titulo="Ordenar por" opcoes={ORDENS} valor={ordem} aoEscolher={setOrdem} />
      </div>

      <PainelDeRanking musicaId={musica.musica_id} dificuldade={dificuldade} instrumento={instrumento} ordem={ordem} aoAbrirPartida={aoAbrirPartida} api={api} />
    </div>
  );
}
