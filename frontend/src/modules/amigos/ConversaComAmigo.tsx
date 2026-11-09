import { useEffect, useSyncExternalStore } from "react";
import { ArrowLeft } from "lucide-react";
import { PainelDeChat } from "@/modules/chat";
import { useConta } from "@/modules/conta";
import { Button } from "@/shared/ui/button";
import { lerConversa } from "./conversas";
import { conversas } from "./loja";

export function useConversas() {
  return useSyncExternalStore(conversas.inscrever, conversas.estado);
}

interface Props {
  amigo: { conta_id: string; nome: string };
  /** Sem a presença ligada, as mensagens novas só aparecem ao abrir a conversa de novo. */
  conectada: boolean;
  aoVoltar: () => void;
}

/** A conversa com um amigo. Fica guardada na API, então dá para mandar mesmo com ele offline. */
export function ConversaComAmigo({ amigo, conectada, aoVoltar }: Props) {
  const { conta } = useConta();
  const { mensagens, naoLidas } = lerConversa(useConversas(), amigo.conta_id);

  useEffect(() => {
    void conversas.carregar(amigo.conta_id);
  }, [amigo.conta_id]);

  // Aberta, tudo o que chega já foi visto.
  useEffect(() => {
    if (naoLidas) conversas.marcarComoLida(amigo.conta_id);
  }, [amigo.conta_id, naoLidas]);

  return (
    <PainelDeChat
      titulo={`Conversa com ${amigo.nome}`}
      className="min-h-0 flex-1"
      mensagens={mensagens.map((m) => {
        const minha = m.de !== amigo.conta_id;
        return { id: String(m.id), autor: minha ? (conta?.nome ?? "Você") : amigo.nome, texto: m.texto, em: m.em, minha };
      })}
      aoEnviar={(texto) => void conversas.enviar(amigo.conta_id, texto)}
      aviso={!conectada && <p className="text-xs text-texto-suave">Ative "Aparecer online" na tela Online para receber as mensagens na hora.</p>}
      extra={
        <Button variant="ghost" size="icon" className="size-7" aria-label="Voltar para os amigos" onClick={aoVoltar}>
          <ArrowLeft />
        </Button>
      }
    />
  );
}
