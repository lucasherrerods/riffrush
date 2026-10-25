import { useEffect, useState, useSyncExternalStore } from "react";
import { PainelDeChat } from "@/modules/chat";
import { useConta } from "@/modules/conta";
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

/** O chat de todo mundo que tem conta. Silenciar é só neste aparelho: a pessoa some da tela, não do chat. */
export function ChatGlobal({ className }: { className?: string }) {
  const { conta } = useConta();
  const logado = !!conta;
  const { conectado, mensagens } = useSyncExternalStore(chatGlobal.inscrever, chatGlobal.estado);
  const [silenciados, setSilenciados] = useState(lerSilenciados);

  useEffect(() => (logado ? chatGlobal.usar() : undefined), [logado]);

  const mudarSilenciados = (ids: string[]) => {
    setSilenciados(ids);
    guardarSilenciados(ids);
  };

  const visiveis = mensagens.filter((m) => !silenciados.includes(m.autor.id));
  const bloqueado = !logado ? "Entre com a sua conta para ver e usar o chat global." : !conectado ? "Conectando ao chat..." : undefined;

  return (
    <PainelDeChat
      titulo="Chat global"
      className={className}
      bloqueado={bloqueado}
      mensagens={visiveis.map((m) => ({ id: String(m.n), autor: m.autor.nome, texto: m.texto, minha: m.autor.id === conta?.id }))}
      aoEnviar={(texto) => chatGlobal.enviar(texto)}
      aoSilenciar={(m) => {
        const autor = mensagens.find((original) => String(original.n) === m.id)?.autor.id;
        if (autor) mudarSilenciados([...silenciados, autor]);
      }}
      extra={
        silenciados.length > 0 && (
          <button type="button" onClick={() => mudarSilenciados([])} className="text-base text-texto-suave hover:text-texto">
            Mostrar silenciados ({silenciados.length})
          </button>
        )
      }
    />
  );
}
