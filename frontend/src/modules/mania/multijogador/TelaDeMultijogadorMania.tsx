import { useMemo, useState } from "react";
import { tocarEfeito } from "@/modules/audio";
import { CLASSE_DA_CAPA_DA_ESCOLHA, ListaDeEscolhaDaSala, LobbyDaSala, ProcurarSala, TelaDaSala, ehClienteWebDaSala } from "@/modules/multiplayer";
import { BotaoDeModificadores } from "@/modules/selecao";
import { formatarDuracao } from "@/shared/lib/formatar";
import { cn } from "@/shared/lib/utils";
import { avisar } from "@/shared/ui/avisos";
import { Input } from "@/shared/ui/input";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { formatarEstrelas } from "../beatmaps/dificuldades";
import { CapaDoConjunto } from "../selecao/CapaDoConjunto";
import { siglasDosMods } from "../gameplay/mods";
import { SeletorDeMods } from "../selecao/SeletorDeMods";
import { acharNaBiblioteca, podeJogarOnline, type DependenciasDoMapa } from "./mapaNaRede";
import type { EstadoDaSalaDoMania, PerfilDoMania } from "./protocolo";
import {
  comecar,
  criarSalaOnline,
  entrarNaSala,
  entrarNaSalaOnline,
  enviarChat,
  escolherMapa,
  escolherMods,
  expulsar,
  marcarPronto,
  passarLideranca,
  procurarSalasOnline,
  sairDaSala,
  temModoOnline,
  useConexao,
} from "./sala";
import { useMapaDaSala } from "./useMapaDaSala";

/** Uma lista com todas as dificuldades do jogador pesaria; a busca acha o resto. */
const MAXIMO_NA_LISTA = 150;

interface Props {
  perfil: PerfilDoMania;
  conjuntos: ConjuntoSalvo[] | null;
  volumeDosEfeitos: number;
  /** Como o convidado consegue o mapa que falta. */
  dependencias: Omit<DependenciasDoMapa, "conjuntos" | "endereco">;
  /** O .osz guardado, que o host da LAN compartilha. */
  lerOsz: (id: string) => Promise<Blob | undefined>;
  aoVoltar: () => void;
  aoBuscarMapas: () => void;
  aoConvidarAmigos?: () => void;
}

export function TelaDeMultijogadorMania({ perfil, conjuntos, volumeDosEfeitos, dependencias, lerOsz, aoVoltar, aoBuscarMapas, aoConvidarAmigos }: Props) {
  const { sala, info, erro, online, codigo, endereco } = useConexao();

  return (
    <TelaDaSala
      naSala={!!sala}
      conectando={sala?.status === "conectando"}
      erro={erro}
      aoVoltar={aoVoltar}
      aoSair={() => sairDaSala()}
      aoBaixar={aoBuscarMapas}
      rotuloDoBaixar="Buscar mapas"
      aoConvidarAmigos={online ? aoConvidarAmigos : undefined}
      busca={
        <ProcurarSala
          volumeDosEfeitos={volumeDosEfeitos}
          retrato={
            <>
              <p className="text-xl font-black">{perfil.nome}</p>
              {perfil.nivel && <p className="font-titulo text-base text-destaque">Nv {perfil.nivel}</p>}
            </>
          }
          acoes={{
            ehClienteWebDaSala: () => ehClienteWebDaSala(),
            temModoOnline: () => temModoOnline(),
            procurarSalasOnline: () => procurarSalasOnline(),
            criarSalaOnline: (publica) => criarSalaOnline(perfil, publica),
            entrarNaSalaOnline: (texto) => entrarNaSalaOnline(texto, perfil),
            entrarNaSalaDoCelular: () => entrarNaSala(location.origin, perfil),
          }}
        />
      }
      lobby={
        sala && (
          <LobbyDoMania
            sala={sala}
            enderecoDoCelular={info && `${info.endereco}/?modo=mania`}
            codigo={codigo}
            online={!!online}
            conjuntos={conjuntos ?? []}
            dependencias={{ ...dependencias, conjuntos: conjuntos ?? [], endereco }}
            lerOsz={lerOsz}
            volumeDosEfeitos={volumeDosEfeitos}
          />
        )
      }
    />
  );
}

interface PropsDoLobby {
  sala: EstadoDaSalaDoMania;
  enderecoDoCelular?: string;
  codigo?: string;
  online: boolean;
  conjuntos: ConjuntoSalvo[];
  dependencias: DependenciasDoMapa;
  lerOsz: (id: string) => Promise<Blob | undefined>;
  volumeDosEfeitos: number;
}

/** O lobby neutro com a escolha de mapa e mods do Mania. */
function LobbyDoMania({ sala, enderecoDoCelular, codigo, online, conjuntos, dependencias, lerOsz, volumeDosEfeitos }: PropsDoLobby) {
  const { preparo } = useMapaDaSala(sala.mapa, sala.souHost, dependencias);
  const [filtro, setFiltro] = useState("");
  const grupos = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    let restantes = MAXIMO_NA_LISTA;
    return conjuntos
      .filter((c) => !online || podeJogarOnline(c))
      .map((conjunto) => {
        const titulo = conjunto.tituloUnicode || conjunto.titulo;
        const dificuldades = conjunto.mapas.filter((d) => !termo || `${titulo} [${d.dificuldade}] ${conjunto.artista}`.toLowerCase().includes(termo)).slice(0, Math.max(restantes, 0));
        restantes -= dificuldades.length;
        return { conjunto, titulo, dificuldades };
      })
      .filter((g) => g.dificuldades.length > 0);
  }, [conjuntos, online, filtro]);

  const escolherNaSala = (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva) => {
    tocarEfeito("mover", volumeDosEfeitos);
    escolherMapa(conjunto, dificuldade, sala.mods, lerOsz).catch((e) => avisar.error(e instanceof Error ? e.message : String(e)));
  };

  const mods = siglasDosMods(sala.mods);
  const instalado = !!sala.mapa && !!acharNaBiblioteca(sala.mapa, conjuntos);
  const nomeDoMapa = sala.mapa ? `${sala.mapa.titulo} [${sala.mapa.dificuldade}]` : "O host ainda não escolheu o mapa.";

  const escolha = (
    <>
      <p className="text-base font-semibold text-texto-suave">Mapa</p>
      {sala.souHost ? (
        <>
          <Input placeholder="Procurar na biblioteca" aria-label="Procurar mapa" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          {!grupos.length && <p className="text-sm text-texto-suave">{online ? "Nenhum mapa do osu! na biblioteca. Baixe pela busca." : "Nenhum mapa na biblioteca."}</p>}
          <ListaDeEscolhaDaSala
            rotulo="Mapa"
            grupos={grupos.map(({ conjunto, titulo, dificuldades }) => ({
              id: conjunto.id,
              titulo,
              subtitulo: conjunto.artistaUnicode || conjunto.artista,
              capa: <CapaDoConjunto conjunto={conjunto} className={CLASSE_DA_CAPA_DA_ESCOLHA} />,
              duracao: formatarDuracao(Math.max(...conjunto.mapas.map((m) => m.duracaoMs ?? 0))),
              itens: dificuldades.map((d) => {
                const estrelas = conjunto.estrelas?.[d.hash];
                return {
                  id: d.hash,
                  rotulo: d.dificuldade,
                  nomeAcessivel: `${titulo} [${d.dificuldade}]`,
                  escolhido: d.hash === sala.mapa?.hash,
                  detalhe: (
                    <>
                      {estrelas !== undefined && <span className="font-mono text-texto-suave">{formatarEstrelas(estrelas)}</span>}
                      <span className="text-texto-suave">{d.teclas}K</span>
                    </>
                  ),
                };
              }),
            }))}
            aoEscolher={(idDoConjunto, hash) => {
              const conjunto = conjuntos.find((c) => c.id === idDoConjunto);
              const dificuldade = conjunto?.mapas.find((m) => m.hash === hash);
              if (conjunto && dificuldade) escolherNaSala(conjunto, dificuldade);
            }}
          />
        </>
      ) : (
        <>
          <p className="text-2xl font-black max-md:text-lg">{nomeDoMapa}</p>
          {sala.mapa && <p className={cn("text-base font-semibold", instalado ? "text-sucesso" : "text-texto-suave")}>{instalado ? "Instalado" : "Ainda não instalado"}</p>}
        </>
      )}
    </>
  );

  return (
    <LobbyDaSala
      sala={sala}
      codigo={codigo}
      enderecoDoCelular={enderecoDoCelular}
      escolha={escolha}
      opcoes={
        sala.souHost ? (
          <div className="flex items-center gap-4">
            <BotaoDeModificadores ligados={mods.length}>
              <SeletorDeMods mods={sala.mods} aoMudar={escolherMods} />
            </BotaoDeModificadores>
            {mods.length > 0 && <p className="text-base text-texto-suave">Mods: {mods.join(" ")}</p>}
          </div>
        ) : (
          <p className="text-base text-texto-suave">{sala.mapa && `${sala.mapa.teclas}K`}{mods.length > 0 && ` · Mods: ${mods.join(" ")}`}</p>
        )
      }
      preparo={preparo}
      rotuloDoDownload="Baixando o mapa..."
      podeComecar={!!sala.mapa}
      volumeDosEfeitos={volumeDosEfeitos}
      aoComecar={async () => comecar()}
      aoPronto={(pronto) => marcarPronto(pronto)}
      aoExpulsar={(id) => expulsar(id)}
      aoPassarLideranca={(id) => passarLideranca(id)}
      aoEnviarChat={(texto) => enviarChat(texto)}
    />
  );
}
