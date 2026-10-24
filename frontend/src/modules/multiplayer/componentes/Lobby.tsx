import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, ChevronDown, ChevronUp, Globe, Loader2, Play, Smartphone, Users } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { Avatar } from "@/modules/character";
import { useSeguirMusica } from "@/modules/player";
import { DIFICULDADES, INSTRUMENTOS, dificuldadesDaMusica, instrumentosDaMusica, type Dificuldade, type Instrumento, type Musica } from "@/modules/songs";
import { cn } from "@/shared/lib/utils";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { MAXIMO_DE_JOGADORES, type EstadoDaSala } from "../protocolo";
import { todosProntos } from "../protocolo";
import { comecar, escolher, marcarPronto, type InfoDaSala } from "../sala";
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

export function Lobby({ sala, info, codigo, endereco, musicas, volumeDosEfeitos }: Props) {
  const preparo = useMusicaDaSala(sala, musicas, endereco);
  useSeguirMusica(preparo.tipo === "pronta" ? (preparo.musica ?? null) : null);
  // Na LAN, escolher uma música importada envia o arquivo, e isso pode falhar.
  const escolherNaSala = (m: Musica, d: Dificuldade, i: Instrumento = sala.instrumento) => void escolher(m, d, i).catch((erro) => avisar.error(erro instanceof Error ? erro.message : String(erro)));
  const convidados = sala.jogadores.filter((j) => j.id !== sala.hostId);
  const prontos = convidados.filter((j) => sala.prontos.includes(j.id)).length;
  const estouPronto = sala.prontos.includes(sala.meuId);
  const [qr, setQr] = useState("");
  const [comecando, setComecando] = useState(false);
  const musica = musicas.find((m) => m.id === sala.musica.id);
  const tituloDaMusica = musica?.titulo ?? ("titulo" in sala.musica ? sala.musica.titulo : sala.musica.id);
  const posicao = musicas.findIndex((m) => m.id === sala.musica.id);
  // A lista rola sozinha até a escolhida quando ela muda pelas setas ou pela busca.
  const escolhidaNaLista = useRef<HTMLButtonElement>(null);
  useEffect(() => escolhidaNaLista.current?.scrollIntoView?.({ block: "nearest" }), [sala.musica.id]);
  const escolherVizinha = (passo: number) => {
    const vizinha = musicas[posicao + passo];
    if (!vizinha) return;
    tocarEfeito("mover", volumeDosEfeitos);
    escolherNaSala(vizinha, sala.dificuldade);
  };

  useEffect(() => {
    if (info) void QRCode.toDataURL(info.endereco, { margin: 1, width: 220 }).then(setQr);
  }, [info]);

  const darLargada = async () => {
    if (!musica) return;
    setComecando(true);
    tocarEfeito("selecionar", volumeDosEfeitos);
    try {
      await comecar(musica);
    } catch (erro) {
      avisar.error(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setComecando(false);
    }
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:grid-cols-1">
      <div className={cn("flex min-h-0 flex-col gap-4", info || codigo ? "col-span-8" : "col-span-12")}>
        <ul className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
          {Array.from({ length: MAXIMO_DE_JOGADORES }, (_, i) => {
            const jogador = sala.jogadores[i];
            return (
              <li
                key={jogador?.id ?? `vaga-${i}`}
                className={cn(
                  "chapa flex flex-col items-center p-4",
                  jogador ? "border-borda bg-superficie" : "border-dashed border-borda bg-fundo",
                )}
              >
                {jogador ? (
                  <>
                    <Avatar personagem={jogador.personagem} className="h-24 w-auto" />
                    <p className="mt-2 truncate text-base font-bold">{jogador.personagem.nome}</p>
                    <div className="flex gap-1">
                      {jogador.id === sala.hostId && <span className="rounded-full bg-ouro px-2 text-base font-bold text-fundo">Host</span>}
                      {jogador.id === sala.meuId && <span className="rounded-full bg-superficie-elevada px-2 text-base">Você</span>}
                      {sala.prontos.includes(jogador.id) && (
                        <span className="flex items-center gap-1 rounded-full bg-sucesso px-2 text-base font-bold text-fundo">
                          <Check className="size-4 opacity-70" aria-hidden /> Pronto
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 text-texto-suave">
                    <Users className="opacity-50" aria-hidden />
                    <p className="text-base">Esperando...</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Música à esquerda, dificuldade e largada à direita. A lista de músicas ocupa a altura livre e rola. */}
        <section className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] gap-6 placa p-6 max-md:grid-cols-1 max-md:grid-rows-none">
          <div className="flex min-h-0 min-w-0 flex-col gap-2">
            <p className="text-base font-semibold text-texto-suave">Música</p>
            {sala.souHost ? (
              <>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" aria-label="Música anterior" disabled={posicao <= 0} onClick={() => escolherVizinha(-1)}>
                    <ChevronUp />
                  </Button>
                  <span className="flex-1 text-center text-base text-texto-suave">
                    {posicao + 1} de {musicas.length}
                  </span>
                  <Button variant="ghost" size="icon" aria-label="Próxima música" disabled={posicao >= musicas.length - 1} onClick={() => escolherVizinha(1)}>
                    <ChevronDown />
                  </Button>
                </div>
                <div role="radiogroup" aria-label="Música" className="flex min-h-48 flex-1 flex-col gap-1 overflow-y-auto max-md:max-h-72">
                  {musicas.map((m) => {
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
                        className={cn("flex items-center gap-4 rounded-lg px-4 py-2 text-left text-base", escolhida ? "bg-primaria" : "hover:bg-superficie-elevada")}
                      >
                        <span className="flex-1 truncate font-semibold">{m.titulo}</span>
                        <span className="truncate text-texto-suave">{m.artista}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-2xl font-black">{tituloDaMusica}</p>
            )}
          </div>

          <div className="flex min-w-0 flex-col justify-end gap-4">
            {/* Só o host escolhe: todos tocam no mesmo instrumento, para a pontuação ser comparável. */}
            {sala.souHost ? (
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
            )}

            {sala.souHost ? (
              <div className="flex flex-col gap-2">
                <Button size="lg" disabled={comecando || !musica || !todosProntos(sala)} className="h-14 text-lg font-black" onClick={() => void darLargada()}>
                  {comecando ? <Loader2 className="animate-spin" /> : <Play className="fill-current opacity-70" />} Começar partida
                </Button>
                {!todosProntos(sala) && (
                  <p className="text-center text-base text-texto-suave">
                    Esperando todos ficarem prontos ({prontos} de {convidados.length})
                  </p>
                )}
              </div>
            ) : preparo.tipo === "baixando" ? (
              <p className="flex items-center justify-center gap-2 py-4 text-base text-texto-suave">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Baixando a música...
              </p>
            ) : preparo.tipo === "erro" ? (
              <p role="alert" className="py-4 text-center text-base text-texto-suave">
                {preparo.mensagem}
              </p>
            ) : estouPronto ? (
              <div className="flex flex-col gap-2">
                <p className="flex items-center justify-center gap-2 text-base text-texto-suave">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Pronto! Esperando o host começar...
                </p>
                <Button variant="outline" onClick={() => marcarPronto(false)}>
                  Cancelar pronto
                </Button>
              </div>
            ) : (
              <Button
                size="lg"
                className="h-14 text-lg font-black"
                onClick={() => {
                  tocarEfeito("selecionar", volumeDosEfeitos);
                  marcarPronto(true);
                }}
              >
                <Check className="opacity-70" /> Estou pronto
              </Button>
            )}
          </div>
        </section>
      </div>

      {codigo && (
        <section className="col-span-4 flex flex-col items-center gap-4 placa p-6 text-center">
          <Globe className="text-primaria opacity-70" aria-hidden />
          <p className="text-base font-bold">Sala online</p>
          <p className="text-base text-texto-suave">Passe o código para os amigos:</p>
          <p className="font-mono text-5xl font-bold tracking-[0.2em] text-destaque">{codigo}</p>
          <p className="text-base text-texto-suave">Eles entram em Multijogador, no campo &quot;Código da sala online&quot;.</p>
        </section>
      )}
      {info && (
        <section className="col-span-4 flex flex-col items-center gap-4 placa p-6 text-center">
          <Smartphone className="text-primaria opacity-70" aria-hidden />
          <p className="text-base font-bold">Jogar pelo celular</p>
          <p className="text-base text-texto-suave">No mesmo Wi-Fi, abra a câmera no QR code:</p>
          {qr && <img src={qr} alt="QR code da sala" className="rounded-2xl bg-texto p-2" />}
          <p className="font-mono text-lg font-bold">{info.endereco}</p>
          <p className="text-base text-texto-suave">Outros PCs com o Riff Rush acham a sala sozinhos.</p>
        </section>
      )}
    </div>
  );
}
