import { useMemo, useState } from "react";
import { tocarEfeito } from "@/modules/audio";
import { LobbyDaSala, ProcurarSala, TelaDaSala, ehClienteWebDaSala } from "@/modules/multiplayer";
import { cn } from "@/shared/lib/utils";
import { avisar } from "@/shared/ui/avisos";
import { Input } from "@/shared/ui/input";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { siglasDosMods } from "../gameplay/mods";
import { SeletorDeMods } from "../selecao/SeletorDeMods";
import { podeJogarOnline, type DependenciasDoMapa } from "./mapaNaRede";
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
  const opcoes = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    return conjuntos
      .filter((c) => !online || podeJogarOnline(c))
      .flatMap((conjunto) => conjunto.mapas.map((dificuldade) => ({ conjunto, dificuldade, nome: `${conjunto.tituloUnicode || conjunto.titulo} [${dificuldade.dificuldade}]` })))
      .filter((o) => !termo || `${o.nome} ${o.conjunto.artista}`.toLowerCase().includes(termo))
      .slice(0, MAXIMO_NA_LISTA);
  }, [conjuntos, online, filtro]);

  const escolherNaSala = (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva) => {
    tocarEfeito("mover", volumeDosEfeitos);
    escolherMapa(conjunto, dificuldade, sala.mods, lerOsz).catch((e) => avisar.error(e instanceof Error ? e.message : String(e)));
  };

  const mods = siglasDosMods(sala.mods);
  const nomeDoMapa = sala.mapa ? `${sala.mapa.titulo} [${sala.mapa.dificuldade}]` : "O host ainda não escolheu o mapa.";

  const escolha = (
    <>
      <p className="text-base font-semibold text-texto-suave">Mapa</p>
      {sala.souHost ? (
        <>
          <Input placeholder="Procurar na biblioteca" aria-label="Procurar mapa" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          {!opcoes.length && <p className="text-sm text-texto-suave">{online ? "Nenhum mapa do osu! na biblioteca. Baixe pela busca." : "Nenhum mapa na biblioteca."}</p>}
          <div role="radiogroup" aria-label="Mapa" className="rolagem-de-toque flex min-h-48 flex-1 flex-col gap-1 max-md:max-h-48 max-md:min-h-0 max-md:flex-none">
            {opcoes.map(({ conjunto, dificuldade, nome }) => {
              const escolhido = dificuldade.hash === sala.mapa?.hash;
              return (
                <button
                  key={`${conjunto.id}:${dificuldade.hash}`}
                  role="radio"
                  aria-checked={escolhido}
                  aria-label={nome}
                  onClick={() => escolherNaSala(conjunto, dificuldade)}
                  className={cn("flex items-center gap-4 rounded-lg px-4 py-2 text-left text-base max-md:gap-2 max-md:px-2 max-md:py-1.5 max-md:text-sm", escolhido ? "bg-primaria" : "hover:bg-superficie-hover")}
                >
                  <span className="flex-1 truncate font-semibold">{nome}</span>
                  <span className="text-texto-suave">{dificuldade.teclas}K</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-2xl font-black max-md:text-lg">{nomeDoMapa}</p>
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
          <SeletorDeMods mods={sala.mods} aoMudar={escolherMods} />
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
