import { useState } from "react";
import { ArrowLeft, Music } from "lucide-react";
import { LinhaComPosicao } from "@/modules/ranking";
import { useCarregamento } from "@/shared/hooks/useCarregamento";
import { porcentagem } from "@/shared/lib/formatar";
import { Button } from "@/shared/ui/button";
import { ComCarregamento } from "@/shared/ui/ComCarregamento";
import { apiDoRanking, type MapaMaisJogado } from "./api";
import { PainelDoRankingDoMania } from "./PainelDoRankingDoMania";

interface Props {
  /** O nome do mapa na biblioteca, para quando o servidor ainda não guardou o .osu dele. */
  nomeNaBiblioteca?: (beatmapId: number) => string | undefined;
  carregar?: (sinal: AbortSignal) => Promise<MapaMaisJogado[]>;
}

const formatar = (n: number) => n.toLocaleString("pt-BR");
const plural = (n: number, um: string, varios: string) => `${formatar(n)} ${n === 1 ? um : varios}`;

export function nomeDoMapa(mapa: MapaMaisJogado, nomeNaBiblioteca?: (beatmapId: number) => string | undefined) {
  if (mapa.titulo) return mapa.dificuldade ? `${mapa.titulo} [${mapa.dificuldade}]` : mapa.titulo;
  return nomeNaBiblioteca?.(mapa.beatmap_id) ?? `Mapa ${mapa.beatmap_id}`;
}

/** A segunda aba do leaderboard no Mania: as dificuldades mais jogadas, com o ranking de cada uma ao abrir. */
export function AbaDosMapasMaisJogados({ nomeNaBiblioteca, carregar = apiDoRanking.mapasMaisJogados }: Props) {
  const { estado, tentarDeNovo } = useCarregamento(carregar);
  const [aberto, setAberto] = useState<MapaMaisJogado | null>(null);

  if (aberto)
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setAberto(null)} aria-label="Voltar aos mapas">
            <ArrowLeft />
          </Button>
          <h2 className="truncate font-titulo text-2xl tracking-wide">{nomeDoMapa(aberto, nomeNaBiblioteca)}</h2>
        </div>
        <PainelDoRankingDoMania beatmapId={aberto.beatmap_id} />
      </div>
    );

  return (
    <ComCarregamento estado={estado} tentarDeNovo={tentarDeNovo} oQue="os mapas">
      {(mapas) =>
        !mapas.length ? (
          <p className="m-auto text-base text-texto-suave">Nenhum mapa foi jogado ainda.</p>
        ) : (
          <ol aria-label="Mapas" className="sem-barra-de-rolagem rolagem-de-toque flex min-h-0 flex-1 flex-col gap-1">
            {mapas.map((m) => {
              const nome = nomeDoMapa(m, nomeNaBiblioteca);
              return (
                <LinhaComPosicao
                  key={m.beatmap_id}
                  posicao={m.posicao}
                  nome={nome}
                  avatar={null}
                  semFoto={Music}
                  minha={false}
                  aoClicar={() => setAberto(m)}
                  rotuloDoClique={`Ver o ranking de ${nome}`}
                  detalhe={
                    <>
                      {plural(m.jogadores, "jogador", "jogadores")}
                      {m.recorde && ` · ${m.recorde.nome} ${porcentagem(m.recorde.precisao)}`}
                    </>
                  }
                  valor={plural(m.partidas, "partida", "partidas")}
                />
              );
            })}
          </ol>
        )
      }
    </ComCarregamento>
  );
}
