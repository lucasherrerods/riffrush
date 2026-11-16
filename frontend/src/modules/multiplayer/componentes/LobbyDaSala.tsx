import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { Check, Crown, Globe, Loader2, Play, Smartphone, Users } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { PainelDeChat } from "@/modules/chat";
import { cn } from "@/shared/lib/utils";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";
import { MAXIMO_DE_JOGADORES, todosProntos, type Jogador, type MensagemDoChatDaSala } from "../sala/protocolo";
import { IconeDeChute } from "./IconeDeChute";

/** Pronta sem nada só no host, no instante antes de achar a escolha na biblioteca. */
export type PreparoDaEscolha = { tipo: "baixando" } | { tipo: "pronta" } | { tipo: "erro"; mensagem: string };

export interface PropsDoLobby {
  sala: { souHost: boolean; meuId: number; hostId: number; jogadores: Jogador[]; prontos: number[]; chat: MensagemDoChatDaSala[] };
  /** O retrato de cada jogador no modo (o personagem do Rock). */
  avatar?: (jogador: Jogador) => ReactNode;
  /** Sala online: o código que os amigos digitam. */
  codigo?: string;
  /** Só para o host da LAN: o endereço que o celular abre pelo QR code. */
  enderecoDoCelular?: string;
  /** O que o host escolhe (a música, o mapa): a lista para o host, o nome para os convidados. */
  escolha: ReactNode;
  /** As opções da escolha, ao lado da largada (dificuldade, instrumento, mods). */
  opcoes?: ReactNode;
  /** Se o convidado já tem a escolha do host para dar pronto. */
  preparo: PreparoDaEscolha;
  rotuloDoDownload?: string;
  /** O host já tem o que escolheu e pode largar. */
  podeComecar: boolean;
  volumeDosEfeitos: number;
  aoComecar: () => Promise<void>;
  aoPronto: (pronto: boolean) => void;
  aoExpulsar: (id: number) => void;
  aoPassarLideranca: (id: number) => void;
  aoEnviarChat: (texto: string) => boolean;
}

/** O lobby de uma sala, igual nos dois modos: as vagas, o pronto, a largada, o código ou o QR e o chat. */
export function LobbyDaSala({
  sala,
  avatar,
  codigo,
  enderecoDoCelular,
  escolha,
  opcoes,
  preparo,
  rotuloDoDownload = "Baixando a música...",
  podeComecar,
  volumeDosEfeitos,
  aoComecar,
  aoPronto,
  aoExpulsar,
  aoPassarLideranca,
  aoEnviarChat,
}: PropsDoLobby) {
  const convidados = sala.jogadores.filter((j) => j.id !== sala.hostId);
  const prontos = convidados.filter((j) => sala.prontos.includes(j.id)).length;
  const estouPronto = sala.prontos.includes(sala.meuId);
  const todos = todosProntos(sala);
  const [qr, setQr] = useState("");
  const [comecando, setComecando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{ tipo: "lideranca" | "expulsar"; id: number; nome: string } | null>(null);

  useEffect(() => {
    if (enderecoDoCelular) void QRCode.toDataURL(enderecoDoCelular, { margin: 1, width: 220 }).then(setQr);
  }, [enderecoDoCelular]);

  const darLargada = async () => {
    setComecando(true);
    tocarEfeito("selecionar", volumeDosEfeitos);
    try {
      await aoComecar();
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
                    {avatar?.(jogador)}
                    <p className="mt-2 max-w-full truncate text-base font-bold max-md:mt-0 max-md:text-sm">{jogador.personagem.nome}</p>
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
                    {sala.souHost && jogador.id !== sala.meuId && (
                      <div className="mt-auto flex w-full gap-2 pt-3 max-md:flex-col max-md:gap-1 max-md:pt-2">
                        {/* Só no online: na LAN a sala e o arquivo compartilhado moram no PC de quem criou. */}
                        {codigo && (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Passar a liderança para ${jogador.personagem.nome}`}
                            className="flex-1"
                            onClick={() => setConfirmacao({ tipo: "lideranca", id: jogador.id, nome: jogador.personagem.nome })}
                          >
                            <Crown className="text-ouro" /> Tornar host
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Expulsar ${jogador.personagem.nome}`}
                          className="flex-1 border-perigo/60 text-perigo hover:bg-perigo/10 hover:text-perigo"
                          onClick={() => setConfirmacao({ tipo: "expulsar", id: jogador.id, nome: jogador.personagem.nome })}
                        >
                          <IconeDeChute /> Expulsar
                        </Button>
                      </div>
                    )}
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

        {/* A escolha à esquerda, as opções e a largada à direita. A lista ocupa a altura livre e rola. */}
        <section className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] gap-6 placa p-6 max-md:flex-none max-md:grid-cols-1 max-md:grid-rows-none max-md:gap-3 max-md:p-3">
          <div className="flex min-h-0 min-w-0 flex-col gap-2">{escolha}</div>

          <div className="flex min-w-0 flex-col justify-end gap-4 max-md:gap-3">
            {opcoes}
            {sala.souHost ? (
              <div className="flex flex-col gap-2">
                <Button size="lg" disabled={comecando || !podeComecar || !todos} className="h-14 text-lg font-black max-md:h-10 max-md:text-base" onClick={() => void darLargada()}>
                  {comecando ? <Loader2 className="animate-spin" /> : <Play className="fill-current opacity-70" />} Começar partida
                </Button>
                {!todos && (
                  <p className="text-center text-base text-texto-suave max-md:text-sm">
                    Esperando todos ficarem prontos ({prontos} de {convidados.length})
                  </p>
                )}
              </div>
            ) : preparo.tipo === "baixando" ? (
              <p className="flex items-center justify-center gap-2 py-4 text-base text-texto-suave">
                <Loader2 className="size-4 animate-spin" aria-hidden /> {rotuloDoDownload}
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
                <Button variant="outline" onClick={() => aoPronto(false)}>
                  Cancelar pronto
                </Button>
              </div>
            ) : (
              <Button
                size="lg"
                className="h-14 text-lg font-black max-md:h-10 max-md:text-base"
                onClick={() => {
                  tocarEfeito("selecionar", volumeDosEfeitos);
                  aoPronto(true);
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
        {enderecoDoCelular && (
          <section className="flex shrink-0 flex-col items-center gap-4 placa p-6 text-center">
            <Smartphone className="text-primaria opacity-70" aria-hidden />
            <p className="text-base font-bold">Jogar pelo celular</p>
            <p className="text-base text-texto-suave">No mesmo Wi-Fi, abra a câmera no QR code:</p>
            {qr && <img src={qr} alt="QR code da sala" className="rounded-2xl bg-texto p-2" />}
            <p className="font-mono text-lg font-bold">{enderecoDoCelular}</p>
            <p className="text-base text-texto-suave">Outros PCs com o Riff Rush acham a sala sozinhos.</p>
          </section>
        )}
        <PainelDeChat
          titulo="Chat da sala"
          className="min-h-48 flex-1"
          mensagens={sala.chat.map((m) => ({ id: String(m.n), autor: m.autor, texto: m.texto, em: m.em, minha: m.de === sala.meuId }))}
          aoEnviar={aoEnviarChat}
          aviso={
            codigo
              ? "Quem entrar na sala lê o chat. Não passe dados pessoais."
              : "Na rede local, quem estiver no mesmo Wi-Fi consegue ler o chat. Não passe dados pessoais."
          }
        />
      </div>
      <Dialog open={!!confirmacao} onOpenChange={(aberto) => !aberto && setConfirmacao(null)}>
        <DialogContent>
          {confirmacao?.tipo === "expulsar" ? (
            <>
              <DialogTitle>Expulsar {confirmacao.nome} da sala?</DialogTitle>
              <DialogDescription>{confirmacao.nome} sai da sala agora e não volta mais para ela.</DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle>Passar a liderança para {confirmacao?.nome}?</DialogTitle>
              <DialogDescription>Quem lidera escolhe o que tocar e dá a largada. Você continua na sala como convidado.</DialogDescription>
            </>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button
              variant={confirmacao?.tipo === "expulsar" ? "destructive" : "default"}
              onClick={() => {
                if (confirmacao?.tipo === "expulsar") aoExpulsar(confirmacao.id);
                else if (confirmacao) aoPassarLideranca(confirmacao.id);
                setConfirmacao(null);
              }}
            >
              {confirmacao?.tipo === "expulsar" ? (
                <>
                  <IconeDeChute /> Expulsar
                </>
              ) : (
                <>
                  <Crown className="text-ouro" /> Passar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
