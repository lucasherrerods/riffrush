import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Dices, Heart, Loader2 } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { LobbyDaSala } from "@/modules/multiplayer";
import { Avatar } from "@/modules/rock/character";
import { carregarFavoritas } from "@/modules/rock/library";
import { useSeguirMusica } from "@/modules/rock/player";
import { DIFICULDADES, INSTRUMENTOS, dificuldadesDaMusica, instrumentosDaMusica, type Dificuldade, type Instrumento, type Musica } from "@/modules/rock/songs";
import { cn } from "@/shared/lib/utils";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import type { EstadoDaSala, PersonagemNaSala } from "../protocolo";
import { comecar, enviarChat, escolher, expulsar, marcarPronto, passarLideranca, type InfoDaSala } from "../sala";
import { useMusicaDaSala } from "../useMusicaDaSala";

interface Props {
  sala: EstadoDaSala;
  info?: InfoDaSala;
  /** Sala online: o código que os amigos digitam. */
  codigo?: string;
  /** Endereço do host, de onde o convidado baixa a música importada na LAN. */
  endereco: string;
  musicas: Musica[];
  volumeDosEfeitos: number;
  /** Sorteia e baixa um chart oficial com essa dificuldade e instrumento; sem ele, o botão não aparece. */
  sortearAleatoria?: (dificuldade: Dificuldade, instrumento: Instrumento) => Promise<Musica>;
}

/** O lobby neutro com a escolha de música, dificuldade e instrumento do Rock. */
export function Lobby({ sala, info, codigo, endereco, musicas, volumeDosEfeitos, sortearAleatoria }: Props) {
  const preparo = useMusicaDaSala(sala, musicas, endereco);
  useSeguirMusica(preparo.tipo === "pronta" ? (preparo.musica ?? null) : null);
  // Na LAN, escolher uma música importada envia o arquivo, e isso pode falhar.
  const escolherNaSala = (m: Musica, d: Dificuldade, i: Instrumento = sala.instrumento) => void escolher(m, d, i).catch((erro) => avisar.error(erro instanceof Error ? erro.message : String(erro)));
  const musica = musicas.find((m) => m.id === sala.musica.id);
  const tituloDaMusica = musica?.titulo ?? ("titulo" in sala.musica ? sala.musica.titulo : sala.musica.id);
  const [favoritas] = useState(carregarFavoritas);
  const [soFavoritas, setSoFavoritas] = useState(false);
  const naLista = soFavoritas ? musicas.filter((m) => favoritas.has(m.id)) : musicas;
  const posicao = naLista.findIndex((m) => m.id === sala.musica.id);
  // A lista rola sozinha até a escolhida quando ela muda pelas setas ou pela busca.
  const escolhidaNaLista = useRef<HTMLButtonElement>(null);
  // Com chaves: no Chrome o scrollIntoView devolve uma Promise, e um efeito só pode devolver a função de limpeza.
  useEffect(() => {
    escolhidaNaLista.current?.scrollIntoView?.({ block: "nearest" });
  }, [sala.musica.id]);
  const escolherVizinha = (passo: number) => {
    const vizinha = naLista[posicao + passo];
    if (!vizinha) return;
    tocarEfeito("mover", volumeDosEfeitos);
    escolherNaSala(vizinha, sala.dificuldade);
  };
  const [sorteando, setSorteando] = useState(false);
  const sortear = async () => {
    if (!sortearAleatoria) return;
    setSorteando(true);
    try {
      const sorteada = await sortearAleatoria(sala.dificuldade, sala.instrumento);
      tocarEfeito("selecionar", volumeDosEfeitos);
      escolherNaSala(sorteada, sala.dificuldade);
    } catch (erro) {
      avisar.error(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setSorteando(false);
    }
  };

  const escolha = (
    <>
      <p className="text-base font-semibold text-texto-suave">Música</p>
      {sala.souHost ? (
        <>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Música anterior" disabled={posicao <= 0} onClick={() => escolherVizinha(-1)}>
              <ChevronUp />
            </Button>
            <span className="flex-1 text-center text-base text-texto-suave">
              {posicao + 1} de {naLista.length}
            </span>
            <Button variant="ghost" size="icon" aria-label="Próxima música" disabled={posicao >= naLista.length - 1} onClick={() => escolherVizinha(1)}>
              <ChevronDown />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={soFavoritas ? "default" : "outline"} size="sm" aria-pressed={soFavoritas} onClick={() => setSoFavoritas(!soFavoritas)}>
              <Heart className={cn(soFavoritas ? "fill-current" : "opacity-70")} /> Favoritos
            </Button>
            {sortearAleatoria && (
              <Button variant="outline" size="sm" disabled={sorteando} onClick={() => void sortear()} aria-label="Aleatória">
                {sorteando ? <Loader2 className="animate-spin opacity-70" /> : <Dices className="opacity-70" />} Aleatória
              </Button>
            )}
          </div>
          {soFavoritas && !naLista.length && <p className="text-sm text-texto-suave">Nenhuma música favorita ainda. Favorite no catálogo.</p>}
          <div role="radiogroup" aria-label="Música" className="rolagem-de-toque flex min-h-48 flex-1 flex-col gap-1 max-md:max-h-48 max-md:min-h-0 max-md:flex-none max-md:overscroll-auto">
            {naLista.map((m) => {
              const escolhida = m.id === sala.musica.id;
              return (
                <button
                  key={m.id}
                  ref={escolhida ? escolhidaNaLista : undefined}
                  role="radio"
                  aria-checked={escolhida}
                  aria-label={`${m.titulo} - ${m.artista}`}
                  onClick={() => {
                    tocarEfeito("mover", volumeDosEfeitos);
                    escolherNaSala(m, sala.dificuldade);
                  }}
                  className={cn("flex items-center gap-4 rounded-lg px-4 py-2 text-left text-base max-md:gap-2 max-md:px-2 max-md:py-1.5 max-md:text-sm", escolhida ? "bg-primaria" : "hover:bg-superficie-hover")}
                >
                  <span className="flex-1 truncate font-semibold">{m.titulo}</span>
                  <span className="truncate text-texto-suave">{m.artista}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-2xl font-black max-md:text-lg">{tituloDaMusica}</p>
      )}
    </>
  );

  // Só o host escolhe: todos tocam no mesmo instrumento, para a pontuação ser comparável.
  const opcoes = sala.souHost ? (
    <>
      {musica && instrumentosDaMusica(musica).length > 1 && (
        <GrupoDeOpcoes
          titulo="Instrumento"
          opcoes={instrumentosDaMusica(musica).map((i) => ({ id: i.id, rotulo: i.rotulo }))}
          valor={sala.instrumento}
          aoEscolher={(instrumento) => escolherNaSala(musica, sala.dificuldade, instrumento)}
        />
      )}
      <GrupoDeOpcoes
        titulo="Dificuldade"
        opcoes={(musica ? dificuldadesDaMusica(musica, sala.instrumento) : DIFICULDADES).map((d) => ({ id: d.id, rotulo: d.rotulo }))}
        valor={sala.dificuldade}
        aoEscolher={(dificuldade) => musica && escolherNaSala(musica, dificuldade)}
      />
    </>
  ) : (
    <p className="text-base text-texto-suave">
      {sala.instrumento !== "guitarra" && <>Instrumento: {INSTRUMENTOS.find((i) => i.id === sala.instrumento)?.rotulo} · </>}
      Dificuldade: {DIFICULDADES.find((d) => d.id === sala.dificuldade)?.rotulo}
    </p>
  );

  return (
    <LobbyDaSala
      sala={sala}
      avatar={(jogador) => <Avatar personagem={jogador.personagem as PersonagemNaSala} className="h-24 w-auto max-md:hidden" />}
      codigo={codigo}
      enderecoDoCelular={info?.endereco}
      escolha={escolha}
      opcoes={opcoes}
      preparo={preparo}
      podeComecar={!!musica}
      volumeDosEfeitos={volumeDosEfeitos}
      aoComecar={async () => {
        if (musica) await comecar(musica);
      }}
      aoPronto={(pronto) => marcarPronto(pronto)}
      aoExpulsar={(id) => expulsar(id)}
      aoPassarLideranca={(id) => passarLideranca(id)}
      aoEnviarChat={(texto) => enviarChat(texto)}
    />
  );
}
