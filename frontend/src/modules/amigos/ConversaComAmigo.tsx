import { useEffect, useSyncExternalStore } from "react";
import { ArrowLeft } from "lucide-react";
import { PainelDeChat } from "@/modules/chat";
import { Button } from "@/shared/ui/button";
import { lerConversa } from "./conversas";
import { conversas } from "./loja";

export function useConversas() {
  return useSyncExternalStore(conversas.inscrever, conversas.estado);
}

interface Props {
  amigo: { conta_id: string; nome: string };
  online: boolean;
  /** Sem a presença ligada, nenhuma mensagem sai nem chega. */
  conectada: boolean;
  aoVoltar: () => void;
}

/** A conversa com um amigo. As mensagens ficam só neste aparelho e só chegam a quem está online. */
export function ConversaComAmigo({ amigo, online, conectada, aoVoltar }: Props) {
  const { mensagens, naoLidas } = lerConversa(useConversas(), amigo.conta_id);

  // Aberta, tudo o que chega já foi visto.
  useEffect(() => {
    if (naoLidas) conversas.marcarComoLida(amigo.conta_id);
  }, [amigo.conta_id, naoLidas]);

  const bloqueado = !conectada
    ? 'Ative "Aparecer online" na tela Online para conversar.'
    : !online
      ? `${amigo.nome} está offline. As mensagens só chegam a quem está online.`
      : undefined;

  return (
    <PainelDeChat
      titulo={`Conversa com ${amigo.nome}`}
      className="min-h-0 flex-1"
      mensagens={mensagens.map((m) => ({ id: `${m.em}-${m.de.id}-${m.texto}`, autor: m.de.nome, texto: m.texto, em: m.em, minha: m.minha }))}
      aoEnviar={(texto) => conversas.enviar(amigo.conta_id, texto)}
      bloqueado={bloqueado}
      extra={
        <Button variant="ghost" size="icon" className="size-7" aria-label="Voltar para os amigos" onClick={aoVoltar}>
          <ArrowLeft />
        </Button>
      }
    />
  );
}
