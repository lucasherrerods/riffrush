import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Ban, Flag, Info, MessageSquare, ShieldAlert, Trash2, VolumeX } from "lucide-react";
import { PainelDeChat, type AcaoDaMensagem, type MensagemDoChat } from "@/modules/chat";
import { sessaoDaConta, useConta } from "@/modules/conta";
import { cn } from "@/shared/lib/utils";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { apiDaPresenca, type BanidoDaModeracao, type DenunciaDaModeracao } from "./api";
import { chatGlobal } from "./presenca";

const CHAVE_DOS_SILENCIADOS = "riffrush:chat:silenciados";
const CHAVE_DO_MINIMIZADO = "riffrush:chat:minimizado";

/** Minimizado fica guardado: o chat volta do jeito que a pessoa deixou. */
function lerMinimizado() {
  try {
    return localStorage.getItem(CHAVE_DO_MINIMIZADO) === "1";
  } catch {
    return false;
  }
}

function guardarMinimizado(minimizado: boolean) {
  try {
    localStorage.setItem(CHAVE_DO_MINIMIZADO, minimizado ? "1" : "0");
  } catch {
    // Sem armazenamento: vale só até fechar o app.
  }
}

function lerSilenciados(): string[] {
  try {
    const lidos = JSON.parse(localStorage.getItem(CHAVE_DOS_SILENCIADOS) ?? "[]");
    return Array.isArray(lidos) ? lidos.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function guardarSilenciados(ids: string[]) {
  try {
    localStorage.setItem(CHAVE_DOS_SILENCIADOS, JSON.stringify(ids));
  } catch {
    // Sem armazenamento (janela anônima): vale só até fechar o app.
  }
}

const AVISO = "A moderação nunca pede senha nem dados pessoais. Só quem tem o selo Mod fala pela moderação.";

/** As denúncias e os banidos vêm da API (ficam no banco); só a moderação consegue ler. */
function useModeracao(ativa: boolean) {
  const [denuncias, setDenuncias] = useState<DenunciaDaModeracao[]>([]);
  const [banidos, setBanidos] = useState<BanidoDaModeracao[]>([]);

  const recarregar = useCallback(async () => {
    const token = sessaoDaConta.token();
    if (!token) return;
    try {
      const [novasDenuncias, novosBanidos] = await Promise.all([apiDaPresenca.denuncias(token), apiDaPresenca.banidos(token)]);
      setDenuncias(novasDenuncias);
      setBanidos(novosBanidos);
    } catch (erro) {
      avisar.error(erro instanceof Error ? erro.message : String(erro));
    }
  }, []);

  useEffect(() => {
    if (ativa) void recarregar();
  }, [ativa, recarregar]);

  /** Faz a ação na API e recarrega as listas. */
  const agir = async (acao: (token: string) => Promise<unknown>, aviso?: string) => {
    const token = sessaoDaConta.token();
    if (!token) return;
    try {
      await acao(token);
      if (aviso) avisar(aviso);
      await recarregar();
    } catch (erro) {
      avisar.error(erro instanceof Error ? erro.message : String(erro));
    }
  };

  return { denuncias, banidos, recarregar, agir };
}

interface Props {
  /** A resposta da pessoa às regras: null enquanto ela não respondeu, e nada liga sem ela aceitar. */
  aceito: boolean | null;
  aoResponder: (aceito: boolean) => void;
  className?: string;
}

/** O chat de todo mundo que tem conta. Silenciar é só neste aparelho; denunciar avisa a moderação. */
export function ChatGlobal({ aceito, aoResponder, className }: Props) {
  const { conta } = useConta();
  const logado = !!conta;
  const ligado = logado && aceito === true;
  const estado = useSyncExternalStore(chatGlobal.inscrever, chatGlobal.estado);
  const [silenciados, setSilenciados] = useState(lerSilenciados);
  const [moderando, setModerando] = useState(false);
  const [minimizado, setMinimizado] = useState(lerMinimizado);
  // Todos os hooks antes do retorno das regras: entrar na conta troca de tela no meio e o React exige os mesmos hooks.
  const [sobreAberto, setSobreAberto] = useState(false);
  const moderacao = useModeracao(ligado && !!estado.voce?.admin);

  useEffect(() => (ligado ? chatGlobal.usar() : undefined), [ligado]);

  if (logado && aceito === null) return <Regras className={className} aoResponder={aoResponder} />;

  const mudarSilenciados = (ids: string[]) => {
    setSilenciados(ids);
    guardarSilenciados(ids);
  };

  const { conectado, mensagens, voce } = estado;
  const original = (m: MensagemDoChat) => mensagens.find((o) => String(o.n) === m.id);
  const bloqueado = !logado
    ? "Entre com a sua conta para ver e usar o chat global."
    : !conectado || !voce
      ? "Conectando ao chat..."
      : voce.banido
        ? "Você foi banido do chat global."
        : !voce.podeEscrever
          ? `Chegue ao nível ${voce.nivelParaEscrever} para escrever. Até lá, dá para ler.`
          : undefined;

  const acoes = (m: MensagemDoChat): AcaoDaMensagem[] => {
    const msg = original(m);
    if (!msg) return [];
    const apagar: AcaoDaMensagem = { rotulo: "Apagar mensagem", icone: Trash2, aoClicar: () => chatGlobal.apagar(msg.n) };
    if (m.minha) return voce?.admin ? [apagar] : [];
    const lista: AcaoDaMensagem[] = [
      { rotulo: `Silenciar ${m.autor}`, icone: VolumeX, aoClicar: () => mudarSilenciados([...silenciados, msg.autor.id]) },
      {
        rotulo: `Denunciar mensagem de ${m.autor}`,
        icone: Flag,
        aoClicar: () => {
          if (chatGlobal.denunciar(msg.n)) avisar("Denúncia enviada para a moderação. Obrigado!");
        },
      },
    ];
    if (voce?.admin) {
      lista.push(apagar);
      // Ninguém da moderação é banido pelo botão (a API também recusa).
      if (!msg.autor.moderacao) {
        lista.push({ rotulo: `Banir ${m.autor}`, icone: Ban, aoClicar: () => void moderacao.agir((t) => apiDaPresenca.banir(t, msg.autor.id), `${m.autor} foi banido do chat.`) });
      }
    }
    return lista;
  };

  const mensagensDenunciadas = new Set(moderacao.denuncias.map((d) => d.mensagem_n)).size;

  return (
    <>
      <PainelDeChat
        titulo="Chat global"
        className={className}
        bloqueado={bloqueado}
        mensagens={mensagens
          .filter((m) => !silenciados.includes(m.autor.id))
          .map((m) => ({ id: String(m.n), autor: m.autor.nome, texto: m.texto, minha: m.autor.id === conta?.id, selo: m.autor.moderacao ? "Mod" : undefined }))}
        aoEnviar={(texto) => chatGlobal.enviar(texto)}
        acoesDaMensagem={acoes}
        minimizar={{
          minimizado,
          aoAlternar: (novo) => {
            setMinimizado(novo);
            guardarMinimizado(novo);
          },
        }}
        extra={
          <>
            {ligado && (
              <Button variant="ghost" size="icon" aria-label="Sobre a moderação" onClick={() => setSobreAberto(true)}>
                <Info className="opacity-70" />
              </Button>
            )}
            {silenciados.length > 0 && (
              <button type="button" onClick={() => mudarSilenciados([])} className="text-base text-texto-suave hover:text-texto">
                Mostrar silenciados ({silenciados.length})
              </button>
            )}
            {voce?.admin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setModerando(true);
                  void moderacao.recarregar();
                }}
              >
                <ShieldAlert className="opacity-70" /> <span className="max-md:sr-only">Moderação</span> ({mensagensDenunciadas})
              </Button>
            )}
          </>
        }
      />
      <Dialog open={sobreAberto} onOpenChange={setSobreAberto}>
        <DialogContent>
          <DialogTitle>Sobre a moderação</DialogTitle>
          <DialogDescription>{AVISO}</DialogDescription>
        </DialogContent>
      </Dialog>
      {voce?.admin && <Moderacao aberta={moderando} aoFechar={() => setModerando(false)} {...moderacao} />}
    </>
  );
}

function Regras({ aoResponder, className }: { aoResponder: (aceito: boolean) => void; className?: string }) {
  return (
    <section aria-label="Chat global" className={cn("flex min-h-0 flex-col gap-2 placa p-4", className)}>
      <p className="flex items-center gap-2 text-base font-bold">
        <MessageSquare className="size-4 text-primaria opacity-70" aria-hidden /> Chat global
      </p>
      <ul className="flex flex-1 list-disc flex-col gap-1 overflow-y-auto pl-5 text-base text-texto-suave">
        <li>É público: todo mundo com conta lê o que você escreve.</li>
        <li>Não passe dados pessoais (telefone, endereço, senha).</li>
        <li>A moderação nunca pede senha. Só quem tem o selo Mod fala por ela.</li>
        <li>Sem ofensas, spam ou golpes: dá para silenciar e denunciar, e a moderação pode banir.</li>
      </ul>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => aoResponder(true)}>
          Ligar o chat
        </Button>
        <Button variant="ghost" onClick={() => aoResponder(false)}>
          Agora não
        </Button>
      </div>
    </section>
  );
}

interface PropsDaModeracao extends ReturnType<typeof useModeracao> {
  aberta: boolean;
  aoFechar: () => void;
}

function Moderacao({ aberta, aoFechar, denuncias, banidos, agir }: PropsDaModeracao) {
  // Uma linha por mensagem denunciada, com quem denunciou.
  const porMensagem = new Map<number, DenunciaDaModeracao[]>();
  for (const d of denuncias) porMensagem.set(d.mensagem_n, [...(porMensagem.get(d.mensagem_n) ?? []), d]);
  return (
    <Dialog open={aberta} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogTitle>Moderação do chat</DialogTitle>
        <DialogDescription>Denúncias das mensagens e contas banidas. Fica tudo guardado no servidor do jogo.</DialogDescription>
        <section aria-label="Denúncias" className="flex flex-col gap-2">
          {porMensagem.size === 0 && <p className="text-base text-texto-suave">Nenhuma denúncia.</p>}
          {[...porMensagem.entries()].map(([n, grupo]) => {
            const { autor_id: autorId, autor_nome: autor, texto } = grupo[0];
            return (
              <div key={n} className="chapa flex flex-col gap-2 border-borda bg-superficie p-4">
                <p className="break-words">
                  <span className="font-bold">{autor}</span>: {texto}
                </p>
                <p className="text-base text-texto-suave">
                  {grupo.length} {grupo.length === 1 ? "denúncia" : "denúncias"} ({grupo.map((d) => d.denunciante_nome).join(", ")})
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      chatGlobal.apagar(n);
                      void agir((t) => apiDaPresenca.resolver(t, n), "Mensagem apagada.");
                    }}
                  >
                    <Trash2 className="opacity-70" /> Apagar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      void agir(async (t) => {
                        await apiDaPresenca.banir(t, autorId);
                        await apiDaPresenca.resolver(t, n);
                      }, `${autor} foi banido do chat.`)
                    }
                  >
                    <Ban className="opacity-70" /> Banir {autor}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void agir((t) => apiDaPresenca.resolver(t, n))}>
                    Descartar
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
        <section aria-label="Banidos" className="flex flex-col gap-2">
          <p className="text-base font-bold">Banidos</p>
          {banidos.length === 0 && <p className="text-base text-texto-suave">Ninguém banido.</p>}
          {banidos.map((b) => (
            <div key={b.conta_id} className="flex items-center gap-2">
              <span className="flex-1 truncate">{b.nome}</span>
              <Button size="sm" variant="ghost" onClick={() => void agir((t) => apiDaPresenca.desbanir(t, b.conta_id), `${b.nome} pode escrever de novo.`)}>
                Desbanir
              </Button>
            </div>
          ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}
