import { ArrowLeft, Music, Users } from "lucide-react";
import { sessaoDaConta, useConta } from "@/modules/conta";
import { nomeDaMusica } from "@/modules/songs";
import { useCarregamento } from "@/shared/hooks/useCarregamento";
import { Button } from "@/shared/ui/button";
import { ComCarregamento } from "@/shared/ui/ComCarregamento";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { apiDoRanking, type MusicaNoRanking, type PosicaoNoGeral, type RespostaDoGeral } from "./api";
import { LinhaComPosicao } from "./LinhaComPosicao";

interface Props {
  aoVoltar: () => void;
  /** O nome da música na biblioteca a partir do id do ranking. Música que não está aqui aparece pelo id. */
  tituloDaMusica: (id: string) => string | undefined;
  carregarPlayers?: (sinal: AbortSignal) => Promise<RespostaDoGeral>;
  carregarMusicas?: (sinal: AbortSignal) => Promise<MusicaNoRanking[]>;
  /** Abre a janela de baixar de uma música do Encore. Sem ela, as músicas não são clicáveis. */
  aoAbrirMusicaDoEncore?: (md5: string) => void;
}

/** O ranking guarda as músicas do Encore como `encore:<md5>`; as outras não têm de onde baixar. */
const md5DoEncore = (id: string) => (id.startsWith("encore:") ? id.slice("encore:".length) : null);

const carregarPlayersPadrao = (sinal: AbortSignal) => apiDoRanking.geral({ token: sessaoDaConta.token() ?? undefined, sinal });
const carregarMusicasPadrao = (sinal: AbortSignal) => apiDoRanking.musicas({ sinal });
const formatar = (n: number) => n.toLocaleString("pt-BR");
const plural = (n: number, um: string, varios: string) => `${formatar(n)} ${n === 1 ? um : varios}`;
const LISTA = "sem-barra-de-rolagem flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto";

/** O leaderboard: os jogadores com mais XP numa aba e as músicas mais jogadas na outra. */
export function TelaDeLeaderboard({ aoVoltar, tituloDaMusica, carregarPlayers = carregarPlayersPadrao, carregarMusicas = carregarMusicasPadrao, aoAbrirMusicaDoEncore }: Props) {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] font-black tracking-[-0.02em]">Leaderboard</h1>
      </header>

      <Tabs defaultValue="players" className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="players">
            <Users className="opacity-70" /> Players
          </TabsTrigger>
          <TabsTrigger value="musicas">
            <Music className="opacity-70" /> Músicas
          </TabsTrigger>
        </TabsList>
        {/* Cada aba só monta (e só pede à API) quando é aberta. */}
        <TabsContent value="players" className="mt-2 flex min-h-0 flex-1 flex-col gap-2 placa p-4">
          <AbaDePlayers carregar={carregarPlayers} />
        </TabsContent>
        <TabsContent value="musicas" className="mt-2 flex min-h-0 flex-1 flex-col gap-2 placa p-4">
          <AbaDeMusicas carregar={carregarMusicas} tituloDaMusica={tituloDaMusica} aoAbrir={aoAbrirMusicaDoEncore} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AbaDePlayers({ carregar }: { carregar: (sinal: AbortSignal) => Promise<RespostaDoGeral> }) {
  // Entrar ou sair da conta muda a linha pessoal.
  const contaId = useConta().conta?.id ?? null;
  const { estado, tentarDeNovo } = useCarregamento(carregar, contaId);
  return (
    <ComCarregamento estado={estado} tentarDeNovo={tentarDeNovo} oQue="o leaderboard">
      {({ top, meu, jogadores }) =>
        !top.length ? (
          <p className="m-auto text-base text-texto-suave">Ninguém ganhou XP ainda. Jogue uma música para abrir o placar!</p>
        ) : (
          <>
            <p className="px-2 text-base text-texto-suave">
              Jogadores com mais XP
            </p>
            <ol aria-label="Players" className={LISTA}>
              {top.map((linha) => (
                <LinhaDoPlayer key={linha.posicao} linha={linha} minha={!!meu && meu.posicao === linha.posicao} />
              ))}
            </ol>
            {meu && meu.posicao > top.length && (
              <section aria-label="Sua posição" className="flex flex-col gap-1">
                <p className="px-2 text-base text-texto-suave">
                  Sua posição (#{formatar(meu.posicao)} de {formatar(jogadores)})
                </p>
                <ol>
                  <LinhaDoPlayer linha={meu} minha />
                </ol>
              </section>
            )}
          </>
        )
      }
    </ComCarregamento>
  );
}

function LinhaDoPlayer({ linha, minha }: { linha: PosicaoNoGeral; minha: boolean }) {
  return (
    <LinhaComPosicao
      posicao={linha.posicao}
      nome={linha.nome}
      avatar={linha.avatar}
      minha={minha}
      detalhe={<span className="font-titulo text-destaque">Nv {linha.nivel.nivel}</span>}
      valor={`${formatar(linha.xp_total)} XP`}
    />
  );
}

function AbaDeMusicas({ carregar, tituloDaMusica, aoAbrir }: { carregar: (sinal: AbortSignal) => Promise<MusicaNoRanking[]>; tituloDaMusica: Props["tituloDaMusica"]; aoAbrir?: (md5: string) => void }) {
  const { estado, tentarDeNovo } = useCarregamento(carregar);
  return (
    <ComCarregamento estado={estado} tentarDeNovo={tentarDeNovo} oQue="as músicas">
      {(musicas) =>
        !musicas.length ? (
          <p className="m-auto text-base text-texto-suave">Nenhuma música foi jogada ainda.</p>
        ) : (
          <>
            <p className="px-2 text-base text-texto-suave">As músicas com mais partidas, somando todos os jogadores</p>
            <ol aria-label="Músicas" className={LISTA}>
              {musicas.map((m) => {
                const md5 = md5DoEncore(m.musica_id);
                const nome = nomeDaMusica(m, tituloDaMusica);
                return (
                <LinhaComPosicao
                  key={m.musica_id}
                  posicao={m.posicao}
                  nome={nome}
                  aoClicar={md5 && aoAbrir ? () => aoAbrir(md5) : undefined}
                  rotuloDoClique={`Baixar ${nome}`}
                  avatar={m.capa ?? null}
                  semFoto={Music}
                  minha={false}
                  detalhe={plural(m.jogadores, "jogador", "jogadores")}
                  valor={plural(m.partidas, "partida", "partidas")}
                />
                );
              })}
            </ol>
          </>
        )
      }
    </ComCarregamento>
  );
}
