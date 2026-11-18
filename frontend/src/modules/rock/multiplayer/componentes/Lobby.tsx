import { useState } from "react";
import { tocarEfeito } from "@/modules/audio";
import { CLASSE_DA_CAPA_DA_ESCOLHA, CartaoDaEscolha, ListaDeEscolhaDaSala, LobbyDaSala } from "@/modules/multiplayer";
import { Avatar } from "@/modules/rock/character";
import { useSeguirMusica } from "@/modules/rock/player";
import { Capa, CapaPequena, DIFICULDADES, INSTRUMENTOS, dificuldadesDaMusica, instrumentosDaMusica, type Dificuldade, type Instrumento, type Musica } from "@/modules/rock/songs";
import { avisar } from "@/shared/ui/avisos";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { Input } from "@/shared/ui/input";
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
}

/** O lobby neutro com a escolha de música, dificuldade e instrumento do Rock. */
export function Lobby({ sala, info, codigo, endereco, musicas, volumeDosEfeitos }: Props) {
  const preparo = useMusicaDaSala(sala, musicas, endereco);
  useSeguirMusica(preparo.tipo === "pronta" ? (preparo.musica ?? null) : null);
  // Na LAN, escolher uma música importada envia o arquivo, e isso pode falhar.
  const escolherNaSala = (m: Musica, d: Dificuldade, i: Instrumento = sala.instrumento) => void escolher(m, d, i).catch((erro) => avisar.error(erro instanceof Error ? erro.message : String(erro)));
  const musica = musicas.find((m) => m.id === sala.musica.id);
  const tituloDaMusica = musica?.titulo ?? ("titulo" in sala.musica ? sala.musica.titulo : sala.musica.id);
  const artistaDaMusica = musica?.artista ?? ("artista" in sala.musica ? sala.musica.artista : undefined);
  const [filtro, setFiltro] = useState("");
  const termo = filtro.trim().toLowerCase();
  const naLista = musicas.filter((m) => !termo || `${m.titulo} ${m.artista}`.toLowerCase().includes(termo));

  const escolha = (
    <>
      <p className="text-base font-semibold text-texto-suave">Música</p>
      {sala.souHost ? (
        <>
          <Input placeholder="Procurar na biblioteca" aria-label="Procurar música" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <ListaDeEscolhaDaSala
            rotulo="Música"
            grupos={naLista.map((m) => ({
              id: m.id,
              titulo: m.titulo,
              subtitulo: m.artista,
              capa: <CapaPequena capa={m.imagemDeCapa} className={CLASSE_DA_CAPA_DA_ESCOLHA} />,
              itens: dificuldadesDaMusica(m, sala.instrumento).map((d) => ({
                id: d.id,
                rotulo: d.rotulo,
                nomeAcessivel: `${m.titulo} [${d.rotulo}]`,
                escolhido: m.id === sala.musica.id && d.id === sala.dificuldade,
              })),
            }))}
            aoEscolher={(id, dificuldade) => {
              const escolhida = musicas.find((m) => m.id === id);
              if (!escolhida) return;
              tocarEfeito("mover", volumeDosEfeitos);
              escolherNaSala(escolhida, dificuldade as Dificuldade);
            }}
          />
        </>
      ) : (
        <CartaoDaEscolha
          capa={musica ? <Capa musica={musica} decorativa className="size-full" /> : <CapaPequena className="size-full" />}
          titulo={tituloDaMusica}
          subtitulo={artistaDaMusica}
          estatisticas={[
            { rotulo: "Dificuldade", valor: DIFICULDADES.find((d) => d.id === sala.dificuldade)?.rotulo },
            { rotulo: "Instrumento", valor: INSTRUMENTOS.find((i) => i.id === sala.instrumento)?.rotulo },
            ...(musica ? [{ rotulo: "BPM", valor: Math.round(musica.bpm) || undefined }, { rotulo: "Gênero", valor: musica.genero || undefined }] : []),
          ].filter((e) => e.valor !== undefined)}
        />
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
    </>
  ) : null;

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
