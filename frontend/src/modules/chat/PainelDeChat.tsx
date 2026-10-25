import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { MessageSquare, Send, VolumeX } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { TAMANHO_MAXIMO_DO_TEXTO, limparTexto } from "./chat";

export interface MensagemDoChat {
  id: string;
  autor: string;
  texto: string;
  minha?: boolean;
}

interface Props {
  titulo: string;
  mensagens: MensagemDoChat[];
  /** Devolve false quando a mensagem passou do limite e não saiu. */
  aoEnviar: (texto: string) => boolean | void;
  /** Quando existe, ninguém digita: aparece este motivo no lugar do campo. */
  bloqueado?: string;
  aoSilenciar?: (mensagem: MensagemDoChat) => void;
  /** Ao lado do título, à direita. */
  extra?: ReactNode;
  className?: string;
}

/** Chat de texto puro: nada vira link nem HTML, e as teclas digitadas não acionam os atalhos das telas. */
export function PainelDeChat({ titulo, mensagens, aoEnviar, bloqueado, aoSilenciar, extra, className }: Props) {
  const [texto, setTexto] = useState("");
  const [devagar, setDevagar] = useState(false);
  const lista = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (lista.current) lista.current.scrollTop = lista.current.scrollHeight;
  }, [mensagens]);

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const limpo = limparTexto(texto);
    if (!limpo) return;
    const saiu = aoEnviar(limpo) !== false;
    setDevagar(!saiu);
    if (saiu) setTexto("");
  };

  // Sem isso, Enter e as setas do campo também mexeriam no menu atrás do chat.
  const segurarTeclas = (evento: KeyboardEvent<HTMLInputElement>) => {
    evento.stopPropagation();
    if (evento.key === "Escape") evento.currentTarget.blur();
  };

  return (
    <section aria-label={titulo} className={cn("flex min-h-0 flex-col gap-2 placa p-4", className)}>
      <div className="flex items-center gap-2">
        <p className="flex flex-1 items-center gap-2 text-base font-bold">
          <MessageSquare className="size-4 text-primaria opacity-70" aria-hidden /> {titulo}
        </p>
        {extra}
      </div>
      <ol ref={lista} role="log" aria-label={titulo} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-base">
        {mensagens.length === 0 && !bloqueado && <li className="text-texto-suave">Nenhuma mensagem ainda.</li>}
        {mensagens.map((m) => (
          <li key={m.id} className="group flex items-start gap-1 break-words">
            <p className="min-w-0 flex-1">
              <span className={cn("font-bold", m.minha ? "text-destaque" : "text-texto")}>{m.autor}</span>
              <span className="text-texto-suave">: </span>
              <span>{m.texto}</span>
            </p>
            {aoSilenciar && !m.minha && (
              <button
                type="button"
                aria-label={`Silenciar ${m.autor}`}
                title={`Silenciar ${m.autor}`}
                onClick={() => aoSilenciar(m)}
                className="shrink-0 text-texto-suave opacity-0 group-hover:opacity-100 hover:text-perigo focus-visible:opacity-100"
              >
                <VolumeX className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ol>
      {bloqueado ? (
        <p className="text-base text-texto-suave">{bloqueado}</p>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-1">
          <div className="flex gap-2">
            <input
              aria-label="Mensagem"
              value={texto}
              maxLength={TAMANHO_MAXIMO_DO_TEXTO}
              autoComplete="off"
              placeholder="Escreva uma mensagem"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={segurarTeclas}
              className="h-9 min-w-0 flex-1 rounded-md border border-borda bg-fundo px-3 text-base outline-none placeholder:text-texto-suave focus-visible:border-primaria"
            />
            <Button type="submit" size="icon" variant="ghost" aria-label="Enviar">
              <Send />
            </Button>
          </div>
          {devagar && <p className="text-base text-texto-suave">Mais devagar: espere um pouco para mandar de novo.</p>}
        </form>
      )}
    </section>
  );
}
