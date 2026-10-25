import { TelaDeResultado } from "@/modules/results";
import { useCarregamento } from "@/shared/hooks/useCarregamento";
import { ComCarregamento } from "@/shared/ui/ComCarregamento";
import { apiDoRanking, type ApiDoRanking, type PartidaDoRanking } from "./api";

interface Props {
  partidaId: string;
  titulo: string;
  artista: string;
  aoVoltar: () => void;
  api?: Pick<ApiDoRanking, "partida">;
}

/** A tela de resultado de uma partida do ranking, como quem jogou viu ao terminar. */
export function TelaDePartidaDoRanking({ partidaId, titulo, artista, aoVoltar, api = apiDoRanking }: Props) {
  const { estado, tentarDeNovo } = useCarregamento((sinal) => api.partida(partidaId, { sinal }), partidaId);
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
