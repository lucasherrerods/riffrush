import { useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { TelaDeResultado } from "@/modules/results";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { useCarregamento } from "@/shared/hooks/useCarregamento";
import { ComCarregamento } from "@/shared/ui/ComCarregamento";
import { apiDoRanking, type ApiDoRanking, type PartidaDoRanking } from "./api";

interface Props {
  partidaId: string;
  titulo: string;
  artista: string;
  aoVoltar: () => void;
  /** Recebe o replay baixado para tocar a partida de novo. */
  aoAssistir: (replay: Uint8Array, partida: PartidaDoRanking) => void;
  api?: Pick<ApiDoRanking, "partida" | "replay">;
}

/** A tela de resultado de uma partida do ranking, como quem jogou viu ao terminar. */
export function TelaDePartidaDoRanking({ partidaId, titulo, artista, aoVoltar, aoAssistir, api = apiDoRanking }: Props) {
  const { estado, tentarDeNovo } = useCarregamento((sinal) => api.partida(partidaId, { sinal }), partidaId);
  const [baixando, setBaixando] = useState(false);
  const assistir = (partida: PartidaDoRanking) => {
    setBaixando(true);
    api
      .replay(partida.id)
      .then((replay) => aoAssistir(replay, partida))
      .catch(() => avisar.error("Não deu para baixar o replay agora."))
      .finally(() => setBaixando(false));
  };
  return (
    <div className="flex h-full flex-col">
      <ComCarregamento estado={estado} tentarDeNovo={tentarDeNovo} oQue="a partida">
        {(partida) => (
          <TelaDeResultado
            titulo={titulo}
            artista={artista}
            resultado={comoResultado(partida)}
            jogador={{ nome: partida.nome, avatar: partida.avatar }}
            recordeNovo={false}
            volumeDosEfeitos={0}
            aoRepetir={aoVoltar}
            aoContinuar={aoVoltar}
            rotuloDeContinuar="Voltar"
            extra={
              partida.tem_replay && (
                <Button size="lg" variant="outline" disabled={baixando} onClick={() => assistir(partida)}>
                  {baixando ? <Loader2 className="animate-spin opacity-70" /> : <PlayCircle className="opacity-70" />} Assistir replay
                </Button>
              )
            }
          />
        )}
      </ComCarregamento>
    </div>
  );
}

function comoResultado(p: PartidaDoRanking) {
  return {
    musicaId: p.musica_id,
    dificuldade: p.dificuldade,
    instrumento: p.instrumento,
    pontos: p.pontos,
    acertos: p.acertos,
    total: p.total,
    maiorSequencia: p.maior_sequencia,
    derrota: p.derrota,
    fantasma: p.fantasma,
  };
}
