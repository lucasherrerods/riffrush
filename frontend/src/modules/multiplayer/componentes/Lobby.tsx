import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, ChevronDown, ChevronUp, Crown, Globe, Loader2, Play, Smartphone, Users } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { Avatar } from "@/modules/rock/character";
import { PainelDeChat } from "@/modules/chat";
import { useSeguirMusica } from "@/modules/rock/player";
import { DIFICULDADES, INSTRUMENTOS, dificuldadesDaMusica, instrumentosDaMusica, type Dificuldade, type Instrumento, type Musica } from "@/modules/rock/songs";
import { cn } from "@/shared/lib/utils";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { MAXIMO_DE_JOGADORES, type EstadoDaSala } from "../protocolo";
import { todosProntos } from "../protocolo";
import { IconeDeChute } from "./IconeDeChute";
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
  const [novoLider, setNovoLider] = useState<{ id: number; nome: string } | null>(null);
  const musica = musicas.find((m) => m.id === sala.musica.id);
  const tituloDaMusica = musica?.titulo ?? ("titulo" in sala.musica ? sala.musica.titulo : sala.musica.id);
  const posicao = musicas.findIndex((m) => m.id === sala.musica.id);
  // A lista rola sozinha até a escolhida quando ela muda pelas setas ou pela busca.
  const escolhidaNaLista = useRef<HTMLButtonElement>(null);
  // Com chaves: no Chrome o scrollIntoView devolve uma Promise, e um efeito só pode devolver a função de limpeza.
  useEffect(() => {
    escolhidaNaLista.current?.scrollIntoView?.({ block: "nearest" });
  }, [sala.musica.id]);
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
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:flex-none max-md:grid-cols-1 max-md:gap-2">
      <div className="col-span-8 flex min-h-0 flex-col gap-4 max-md:col-span-1 max-md:min-h-fit max-md:gap-2">
        <ul className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-md:gap-2">
          {Array.from({ length: MAXIMO_DE_JOGADORES }, (_, i) => {
            const jogador = sala.jogadores[i];
            return (
              <li
                key={jogador?.id ?? `vaga-${i}`}
                className={cn(
                  "chapa relative flex flex-col items-center p-4 max-md:items-start max-md:p-2",
                  jogador ? "border-borda bg-superficie" : "border-dashed border-borda bg-fundo",
                )}
              >
                {jogador ? (
                  <>
                    {sala.souHost && jogador.id !== sala.meuId && (
                      <div className="absolute top-2 right-2 flex flex-col max-md:top-1 max-md:right-1">
                        {/* Só no online: na LAN a sala e a música importada moram no PC de quem criou. */}
                        {codigo && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Passar a liderança para ${jogador.personagem.nome}`}
                            className="size-12 text-ouro max-md:size-7"
                            onClick={() => setNovoLider({ id: jogador.id, nome: jogador.personagem.nome })}
                          >
                            <Crown className="size-8 max-md:size-5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Expulsar ${jogador.personagem.nome}`}
                          className="size-12 text-texto-suave hover:text-perigo max-md:size-7"
                          onClick={() => expulsar(jogador.id)}
                        >
                          <IconeDeChute className="size-8 max-md:size-5" />
                        </Button>
                      </div>
                    )}
                    <Avatar personagem={jogador.personagem} className="h-24 w-auto max-md:hidden" />
                    <p className={cn("mt-2 max-w-full truncate text-base font-bold max-md:mt-0 max-md:text-sm", sala.souHost && jogador.id !== sala.meuId && "max-md:pr-8")}>{jogador.personagem.nome}</p>
                    {jogador.personagem.nivel && <p className="font-titulo text-base leading-none text-destaque max-md:text-sm">Nv {jogador.personagem.nivel}</p>}
                    <div className="flex flex-wrap gap-1 max-md:mt-1">
                      {jogador.id === sala.hostId && <span className="rounded-full bg-ouro px-2 text-base font-bold text-fundo max-md:text-xs">Host</span>}
                      {jogador.id === sala.meuId && <span className="rounded-full bg-superficie-elevada px-2 text-base max-md:text-xs">Você</span>}
                      {sala.prontos.includes(jogador.id) && (
                        <span className="flex items-center gap-1 rounded-full bg-sucesso px-2 text-base font-bold text-fundo max-md:text-xs">
                          <Check className="size-4 opacity-70" aria-hidden /> Pronto
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex h-32 w-full flex-col items-center justify-center gap-2 text-texto-suave max-md:h-14 max-md:gap-1">
                    <Users className="opacity-50" aria-hidden />
                    <p className="text-base max-md:text-sm">Esperando...</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Música à esquerda, dificuldade e largada à direita. A lista de músicas ocupa a altura livre e rola. */}
        <section className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] gap-6 placa p-6 max-md:flex-none max-md:grid-cols-1 max-md:grid-rows-none max-md:gap-3 max-md:p-3">
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
                <div role="radiogroup" aria-label="Música" className="rolagem-de-toque flex min-h-48 flex-1 flex-col gap-1 max-md:h-48 max-md:min-h-0 max-md:flex-none">
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
          </div>

          <div className="flex min-w-0 flex-col justify-end gap-4 max-md:gap-3">
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
                <Button size="lg" disabled={comecando || !musica || !todosProntos(sala)} className="h-14 text-lg font-black max-md:h-10 max-md:text-base" onClick={() => void darLargada()}>
                  {comecando ? <Loader2 className="animate-spin" /> : <Play className="fill-current opacity-70" />} Começar partida
                </Button>
                {!todosProntos(sala) && (
                  <p className="text-center text-base text-texto-suave max-md:text-sm">
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
                className="h-14 text-lg font-black max-md:h-10 max-md:text-base"
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

      {/* O código ou o QR em cima, o chat da sala ocupando o resto da coluna. */}
      <div className="col-span-4 flex min-h-0 flex-col gap-6 max-md:col-span-1 max-md:gap-2">
        {codigo && (
          <section className="flex shrink-0 flex-col items-center gap-4 placa p-6 text-center max-md:gap-1 max-md:p-3">
            <Globe className="text-primaria opacity-70 max-md:hidden" aria-hidden />
            <p className="text-base font-bold">Sala online</p>
            <p className="text-base text-texto-suave max-md:text-sm">Passe o código para os amigos:</p>
            <p className="font-mono text-5xl font-bold tracking-[0.2em] text-destaque max-md:text-3xl">{codigo}</p>
            <p className="text-base text-texto-suave max-md:text-xs">Eles entram em Multijogador, no campo &quot;Código da sala online&quot;.</p>
          </section>
        )}
        {info && (
          <section className="flex shrink-0 flex-col items-center gap-4 placa p-6 text-center">
            <Smartphone className="text-primaria opacity-70" aria-hidden />
            <p className="text-base font-bold">Jogar pelo celular</p>
            <p className="text-base text-texto-suave">No mesmo Wi-Fi, abra a câmera no QR code:</p>
            {qr && <img src={qr} alt="QR code da sala" className="rounded-2xl bg-texto p-2" />}
            <p className="font-mono text-lg font-bold">{info.endereco}</p>
            <p className="text-base text-texto-suave">Outros PCs com o Riff Rush acham a sala sozinhos.</p>
          </section>
        )}
        <PainelDeChat
          titulo="Chat da sala"
          className="min-h-48 flex-1"
          mensagens={sala.chat.map((m) => ({ id: String(m.n), autor: m.autor, texto: m.texto, minha: m.de === sala.meuId }))}
          aoEnviar={enviarChat}
          aviso={
            codigo
              ? "Quem entrar na sala lê o chat. Não passe dados pessoais."
              : "Na rede local, quem estiver no mesmo Wi-Fi consegue ler o chat. Não passe dados pessoais."
          }
        />
      </div>
      <Dialog open={!!novoLider} onOpenChange={(aberto) => !aberto && setNovoLider(null)}>
        <DialogContent>
          <DialogTitle>Passar a liderança para {novoLider?.nome}?</DialogTitle>
          <DialogDescription>Quem lidera escolhe a música e dá a largada. Você continua na sala como convidado.</DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (novoLider) passarLideranca(novoLider.id);
                setNovoLider(null);
              }}
            >
              <Crown className="text-ouro" /> Passar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
