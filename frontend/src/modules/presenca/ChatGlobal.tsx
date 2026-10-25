import { useEffect, useState, useSyncExternalStore } from "react";
import { Ban, Flag, MessageSquare, ShieldAlert, Trash2, VolumeX } from "lucide-react";
import { PainelDeChat, type AcaoDaMensagem, type MensagemDoChat } from "@/modules/chat";
import { useConta } from "@/modules/conta";
import { cn } from "@/shared/lib/utils";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import type { Denuncia, EstadoDoChatGlobal, MensagemGlobal } from "./conexaoDoChat";
import { chatGlobal } from "./presenca";

const CHAVE_DOS_SILENCIADOS = "riffrush:chat:silenciados";

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

const AVISO = "A equipe nunca pede senha nem dados pessoais. Só quem tem o selo Equipe fala pela equipe.";

interface Props {
  /** A resposta da pessoa às regras: null enquanto ela não respondeu, e nada liga sem ela aceitar. */
  aceito: boolean | null;
  aoResponder: (aceito: boolean) => void;
  className?: string;
}

/** O chat de todo mundo que tem conta. Silenciar é só neste aparelho; denunciar avisa a equipe. */
export function ChatGlobal({ aceito, aoResponder, className }: Props) {
  const { conta } = useConta();
  const logado = !!conta;
  const ligado = logado && aceito === true;
  const estado = useSyncExternalStore(chatGlobal.inscrever, chatGlobal.estado);
  const [silenciados, setSilenciados] = useState(lerSilenciados);
  const [moderando, setModerando] = useState(false);

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
          if (chatGlobal.denunciar(msg.n)) avisar("Denúncia enviada para a equipe. Obrigado!");
        },
      },
    ];
    if (voce?.admin) {
      lista.push(apagar);
      // Ninguém da equipe é banido pelo botão.
      if (!msg.autor.equipe) lista.push({ rotulo: `Banir ${m.autor}`, icone: Ban, aoClicar: () => chatGlobal.banir(msg.autor.id) });
    }
    return lista;
  };

  return (
    <>
      <PainelDeChat
        titulo="Chat global"
        className={className}
        bloqueado={bloqueado}
        aviso={ligado ? AVISO : undefined}
        mensagens={mensagens
          .filter((m) => !silenciados.includes(m.autor.id))
          .map((m) => ({ id: String(m.n), autor: m.autor.nome, texto: m.texto, minha: m.autor.id === conta?.id, selo: m.autor.equipe ? "Equipe" : undefined }))}
        aoEnviar={(texto) => chatGlobal.enviar(texto)}
        acoesDaMensagem={acoes}
        extra={
          <>
            {silenciados.length > 0 && (
              <button type="button" onClick={() => mudarSilenciados([])} className="text-base text-texto-suave hover:text-texto">
                Mostrar silenciados ({silenciados.length})
              </button>
            )}
            {voce?.admin && (
              <Button variant="ghost" size="sm" onClick={() => setModerando(true)}>
                <ShieldAlert className="opacity-70" /> Moderação ({new Set(estado.denuncias.map((d) => d.mensagem.n)).size})
              </Button>
            )}
          </>
        }
      />
      {voce?.admin && <Moderacao aberta={moderando} aoFechar={() => setModerando(false)} estado={estado} />}
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
        <li>A equipe nunca pede senha. Só quem tem o selo Equipe fala por ela.</li>
        <li>Sem ofensas, spam ou golpes: dá para silenciar e denunciar, e a equipe pode banir.</li>
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

function Moderacao({ aberta, aoFechar, estado }: { aberta: boolean; aoFechar: () => void; estado: EstadoDoChatGlobal }) {
  // Uma linha por mensagem denunciada, com quem denunciou.
  const porMensagem = new Map<number, { mensagem: MensagemGlobal; denuncias: Denuncia[] }>();
  for (const d of estado.denuncias) {
    const grupo = porMensagem.get(d.mensagem.n) ?? { mensagem: d.mensagem, denuncias: [] };
    grupo.denuncias.push(d);
    porMensagem.set(d.mensagem.n, grupo);
  }
  return (
    <Dialog open={aberta} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogTitle>Moderação do chat</DialogTitle>
        <DialogDescription>Denúncias das últimas mensagens e contas banidas.</DialogDescription>
        <section aria-label="Denúncias" className="flex flex-col gap-2">
          {porMensagem.size === 0 && <p className="text-base text-texto-suave">Nenhuma denúncia.</p>}
          {[...porMensagem.values()].map(({ mensagem, denuncias }) => (
            <div key={mensagem.n} className="chapa flex flex-col gap-2 border-borda bg-superficie p-4">
              <p className="break-words">
                <span className="font-bold">{mensagem.autor.nome}</span>: {mensagem.texto}
              </p>
              <p className="text-base text-texto-suave">
                {denuncias.length} {denuncias.length === 1 ? "denúncia" : "denúncias"} ({denuncias.map((d) => d.por.nome).join(", ")})
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    chatGlobal.apagar(mensagem.n);
                    chatGlobal.resolver(mensagem.n);
                  }}
                >
                  <Trash2 className="opacity-70" /> Apagar
                </Button>
                {!mensagem.autor.equipe && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      chatGlobal.banir(mensagem.autor.id);
                      chatGlobal.resolver(mensagem.n);
                    }}
                  >
                    <Ban className="opacity-70" /> Banir {mensagem.autor.nome}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => chatGlobal.resolver(mensagem.n)}>
                  Descartar
                </Button>
              </div>
            </div>
          ))}
        </section>
        <section aria-label="Banidos" className="flex flex-col gap-2">
          <p className="text-base font-bold">Banidos</p>
          {estado.banidos.length === 0 && <p className="text-base text-texto-suave">Ninguém banido.</p>}
          {estado.banidos.map((b) => (
            <div key={b.id} className="flex items-center gap-2">
              <span className="flex-1 truncate">{b.nome}</span>
              <Button size="sm" variant="ghost" onClick={() => chatGlobal.desbanir(b.id)}>
                Desbanir
              </Button>
            </div>
          ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}
