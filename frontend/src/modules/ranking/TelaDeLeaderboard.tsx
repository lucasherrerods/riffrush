import { useState } from "react";
import { ArrowLeft, Music, Search, Users } from "lucide-react";
import { sessaoDaConta, useConta } from "@/modules/conta";
import { DIFICULDADES, nomeDaMusica } from "@/modules/rock/songs";
import { porcentagem } from "@/shared/lib/formatar";
import { useCarregamento } from "@/shared/hooks/useCarregamento";
import { Button } from "@/shared/ui/button";
import { CampoDeSelecao } from "@/shared/ui/CampoDeSelecao";
import { Input } from "@/shared/ui/input";
import { ComCarregamento } from "@/shared/ui/ComCarregamento";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { apiDoRanking as apiPadrao, type ApiDoRanking, type MusicaNoRanking, type PosicaoNoGeral, type RespostaDoGeral } from "./api";
import { filtrarMusicas, ORDENS_DAS_MUSICAS, type FiltroDasMusicas } from "./filtros";
import { LinhaComPosicao } from "./LinhaComPosicao";
import { PainelDaMusica } from "./PainelDaMusica";
import { SeloDaNota } from "@/shared/ui/SeloDaNota";

interface Props {
  aoVoltar: () => void;
  /** O nome da música na biblioteca a partir do id do ranking. Música que não está aqui aparece pelo id. */
  tituloDaMusica: (id: string) => string | undefined;
  carregarPlayers?: (sinal: AbortSignal) => Promise<RespostaDoGeral>;
  carregarMusicas?: (sinal: AbortSignal) => Promise<MusicaNoRanking[]>;
  /** Abre a janela de baixar de uma música do Encore. Sem ela, o ranking da música não tem o botão de baixar. */
  aoAbrirMusicaDoEncore?: (md5: string) => void;
  /** Abre uma partida do ranking de uma música. */
  aoAbrirPartida?: (partidaId: string, musica: { titulo: string; artista: string }) => void;
  /** Como tocar a prévia da música com esse id do ranking. Sem áudio na biblioteca, não tem prévia. */
  previa?: (musicaId: string) => (() => void) | undefined;
  apiDoRanking?: Pick<ApiDoRanking, "buscar">;
  /** A música aberta, quando quem usa a tela quer lembrar dela (ex.: ao voltar de uma partida). Sem ela, a tela guarda sozinha. */
  musicaAberta?: MusicaNoRanking | null;
  aoAbrirMusica?: (musica: MusicaNoRanking | null) => void;
}

/** O ranking guarda as músicas do Encore como `encore:<md5>`; as outras não têm de onde baixar. */
const md5DoEncore = (id: string) => (id.startsWith("encore:") ? id.slice("encore:".length) : null);

const carregarPlayersPadrao = (sinal: AbortSignal) => apiPadrao.geral({ token: sessaoDaConta.token() ?? undefined, sinal });
const carregarMusicasPadrao = (sinal: AbortSignal) => apiPadrao.musicas({ sinal });
const nomeDaDificuldade = (id: string) => DIFICULDADES.find((d) => d.id === id)?.rotulo ?? id;
const formatar = (n: number) => n.toLocaleString("pt-BR");
const plural = (n: number, um: string, varios: string) => `${formatar(n)} ${n === 1 ? um : varios}`;
const LISTA = "sem-barra-de-rolagem flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto";

/** O leaderboard: os jogadores com mais XP numa aba e as músicas mais jogadas na outra. */
export function TelaDeLeaderboard({ aoVoltar, carregarPlayers = carregarPlayersPadrao, carregarMusicas = carregarMusicasPadrao, ...daMusica }: Props) {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] font-black tracking-[-0.02em]">Leaderboard</h1>
      </header>

      <Tabs defaultValue={daMusica.musicaAberta ? "musicas" : "players"} className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
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
          <AbaDeMusicas carregar={carregarMusicas} {...daMusica} />
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

type PropsDaAbaDeMusicas = Pick<Props, "tituloDaMusica" | "aoAbrirMusicaDoEncore" | "aoAbrirPartida" | "previa" | "apiDoRanking" | "musicaAberta" | "aoAbrirMusica"> & {
  carregar: (sinal: AbortSignal) => Promise<MusicaNoRanking[]>;
};

function AbaDeMusicas({ carregar, tituloDaMusica, aoAbrirMusicaDoEncore, aoAbrirPartida, previa, apiDoRanking, musicaAberta, aoAbrirMusica }: PropsDaAbaDeMusicas) {
  const { estado, tentarDeNovo } = useCarregamento(carregar);
  const [filtro, setFiltro] = useState<FiltroDasMusicas>({ busca: "", ordem: "partidas" });
  const [abertaAqui, setAbertaAqui] = useState<MusicaNoRanking | null>(null);
  const aberta = musicaAberta !== undefined ? musicaAberta : abertaAqui;
  const setAberta = (musica: MusicaNoRanking | null) => (aoAbrirMusica ? aoAbrirMusica(musica) : setAbertaAqui(musica));
  const nome = (m: MusicaNoRanking) => nomeDaMusica(m, tituloDaMusica);

  if (aberta) {
    const md5 = md5DoEncore(aberta.musica_id);
    // Música que já está na biblioteca não precisa ser baixada de novo.
    const jaBaixada = tituloDaMusica(aberta.musica_id) !== undefined;
    return (
      <PainelDaMusica
        musica={aberta}
        nome={nome(aberta)}
        aoVoltar={() => setAberta(null)}
        aoBaixar={md5 && !jaBaixada && aoAbrirMusicaDoEncore ? () => aoAbrirMusicaDoEncore(md5) : undefined}
        aoOuvir={previa?.(aberta.musica_id)}
        aoAbrirPartida={aoAbrirPartida && ((id) => aoAbrirPartida(id, { titulo: aberta.titulo ?? nome(aberta), artista: aberta.artista ?? "" }))}
        api={apiDoRanking}
      />
    );
  }

  return (
    <ComCarregamento estado={estado} tentarDeNovo={tentarDeNovo} oQue="as músicas">
      {(musicas) => {
        if (!musicas.length) return <p className="m-auto text-base text-texto-suave">Nenhuma música foi jogada ainda.</p>;
        const filtradas = filtrarMusicas(musicas, filtro, nome);
        return (
          <>
            <div className="flex flex-wrap items-end gap-4 px-2">
              <div className="relative min-w-48 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave opacity-70" aria-hidden />
                <Input
                  type="search"
                  aria-label="Buscar música"
                  placeholder="Buscar por música ou banda"
                  value={filtro.busca}
                  onChange={(e) => setFiltro({ ...filtro, busca: e.target.value })}
                  className="h-10 border-borda bg-superficie pl-10 text-base"
                />
              </div>
              <CampoDeSelecao titulo="Ordenar por" opcoes={ORDENS_DAS_MUSICAS} valor={filtro.ordem} aoEscolher={(ordem) => setFiltro({ ...filtro, ordem })} />
            </div>
            {filtradas.length ? (
              <ol aria-label="Músicas" className={LISTA}>
                {filtradas.map((m, i) => {
                  const nomeDaLinha = nome(m);
                  return (
                    <LinhaComPosicao
                      key={m.musica_id}
                      // Com outra ordem ou busca, a posição é a da lista que aparece.
                      posicao={filtro.ordem === "partidas" && !filtro.busca.trim() ? m.posicao : i + 1}
                      nome={nomeDaLinha}
                      aoClicar={() => setAberta(m)}
                      rotuloDoClique={`Ver o ranking de ${nomeDaLinha}`}
                      avatar={m.capa ?? null}
                      semFoto={Music}
                      minha={false}
                      selo={m.recorde && <SeloDaNota precisao={m.recorde.precisao} />}
                      detalhe={
                        <>
                          {plural(m.jogadores, "jogador", "jogadores")}
                          {m.recorde && ` · ${m.recorde.nome} ${porcentagem(m.recorde.precisao)} no ${nomeDaDificuldade(m.recorde.dificuldade)}`}
                        </>
                      }
                      valor={plural(m.partidas, "partida", "partidas")}
                    />
                  );
                })}
              </ol>
            ) : (
              <p className="m-auto text-base text-texto-suave">Nenhuma música com esse nome.</p>
            )}
          </>
        );
      }}
    </ComCarregamento>
  );
}
