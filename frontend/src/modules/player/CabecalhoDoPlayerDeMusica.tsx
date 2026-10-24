import { useRef, useState } from "react";
import { Loader2, Music, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Slider } from "@/shared/ui/slider";
import { formatarTempo } from "./fila";
import { playerDeMusica } from "./playerDeMusica";
import { usePlayerDeMusica, usePosicaoDaMusica } from "./usePlayerDeMusica";
import { volumeAoAlternarMudo } from "./volume";

interface Props {
  volume: number;
  aoMudarVolume: (volume: number) => void;
  /** Fica no canto direito (a conta, por exemplo). */
  children?: React.ReactNode;
}

/** O player no topo das telas: mostra a música que está tocando e deixa pausar, pular, escolher o trecho e o volume. */
export function CabecalhoDoPlayerDeMusica({ volume, aoMudarVolume, children }: Props) {
  const { musica, tocando, carregando, duracao } = usePlayerDeMusica();
  const posicao = usePosicaoDaMusica(tocando);
  // Enquanto arrasta, o slider mostra o ponto escolhido; a música só pula ao soltar.
  const [arrastando, setArrastando] = useState<number | null>(null);
  const tempo = arrastando ?? posicao;
  const ultimoAudivel = useRef(volume);
  if (volume > 0) ultimoAudivel.current = volume;

  return (
    <header className="relative z-10 flex items-center gap-4 border-b border-borda bg-superficie px-4 py-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Música anterior" onClick={() => playerDeMusica.anterior()}>
          <SkipBack />
        </Button>
        <Button variant="ghost" size="icon" aria-label={tocando ? "Pausar" : "Tocar"} disabled={!musica || carregando} onClick={() => playerDeMusica.alternar()}>
          {carregando ? <Loader2 className="animate-spin" /> : tocando ? <Pause /> : <Play />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Próxima música" onClick={() => playerDeMusica.proxima()}>
          <SkipForward />
        </Button>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:w-64">
        <Music className="size-4 shrink-0 text-texto-suave" />
        <span className="truncate text-base font-bold">{musica ? `${musica.titulo}${musica.artista ? ` — ${musica.artista}` : ""}` : "Nenhuma música"}</span>
      </div>
      <div className="hidden max-w-md flex-1 items-center gap-2 sm:flex">
        <span className="w-12 text-right font-mono text-sm tabular-nums text-texto-suave">{formatarTempo(tempo)}</span>
        <Slider
          aria-label="Tempo da música"
          min={0}
          max={Math.max(duracao, 1)}
          step={1}
          value={[tempo]}
          disabled={!duracao}
          onValueChange={([valor]) => setArrastando(valor)}
          onValueCommit={([valor]) => {
            playerDeMusica.irPara(valor);
            setArrastando(null);
          }}
        />
        <span className="w-12 font-mono text-sm tabular-nums text-texto-suave">{formatarTempo(duracao)}</span>
      </div>
      <div className="flex items-center gap-1 max-sm:ml-auto">
        <Button
          variant="ghost"
          size="icon"
          aria-label={volume > 0 ? "Mutar" : "Tirar do mudo"}
          onClick={() => aoMudarVolume(volumeAoAlternarMudo(volume, ultimoAudivel.current))}
        >
          {volume > 0 ? <Volume2 /> : <VolumeX />}
        </Button>
        <Slider
          aria-label="Volume do player"
          className="w-24 max-sm:w-16"
          min={0}
          max={1}
          step={0.05}
          value={[volume]}
          onValueChange={([valor]) => aoMudarVolume(valor)}
        />
      </div>
      {children && <div className="ml-auto flex items-center">{children}</div>}
    </header>
  );
}
