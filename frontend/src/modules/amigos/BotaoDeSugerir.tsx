import { useEffect, useState, type KeyboardEvent } from "react";
import { Check, Send } from "lucide-react";
import { useConta } from "@/modules/conta";
import type { SugestaoDeMusica } from "@/modules/presenca";
import { cn } from "@/shared/lib/utils";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useAmigos } from "./PainelDeAmigos";
import { conversas, listaDeAmigos } from "./loja";

interface Props {
  /** A música selecionada como sugestão, ou nada quando ela não dá para o amigo baixar. */
  sugestao: SugestaoDeMusica | null;
  /** Por que essa música não dá para sugerir, na dica do botão desligado. */
  motivoSemSugestao?: string;
}

/** O botão redondo, ao lado do coração, que manda a música selecionada para amigos tocarem. Só com conta. */
export function BotaoDeSugerir({ sugestao, motivoSemSugestao = "Essa música não dá para sugerir." }: Props) {
  const { conta } = useConta();
  const { listas } = useAmigos();
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState<ReadonlySet<string>>(new Set());
  const [recado, setRecado] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) void listaDeAmigos.recarregar();
  }, [aberto]);

  if (!conta) return null;
  const amigos = listas?.amigos ?? [];

  const alternar = (id: string) =>
    setEscolhidos((atuais) => {
      const proximos = new Set(atuais);
      if (!proximos.delete(id)) proximos.add(id);
      return proximos;
    });

  const enviar = async () => {
    if (!sugestao || escolhidos.size === 0) return;
    setEnviando(true);
    const enviadosPara: string[] = [];
    for (const id of escolhidos) {
      if (await conversas.enviar(id, recado, sugestao)) enviadosPara.push(amigos.find((a) => a.conta_id === id)?.nome ?? "amigo");
    }
    setEnviando(false);
    if (enviadosPara.length === 0) return;
    avisar.success(`Sugestão enviada para ${enviadosPara.join(", ")}`);
    setAberto(false);
    setEscolhidos(new Set());
    setRecado("");
  };

  // A seleção escuta as teclas na janela inteira (Enter toca, F favorita): aqui dentro elas ficam no painel.
  const segurarTeclas = (evento: KeyboardEvent) => {
    evento.stopPropagation();
    if (evento.key === "Escape") setAberto(false);
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Sugerir para um amigo"
          title={sugestao ? "Sugerir para um amigo" : motivoSemSugestao}
          disabled={!sugestao}
          className="grid size-10 place-items-center rounded-full border border-borda bg-fundo/70 text-texto backdrop-blur-sm transition-colors hover:bg-fundo/90 disabled:opacity-40"
        >
          <Send className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72" onKeyDown={segurarTeclas}>
        <p className="mb-2 font-bold">Sugerir para</p>
        {amigos.length === 0 ? (
          <p className="text-sm text-texto-suave">Adicione amigos para sugerir músicas.</p>
        ) : (
          <ul aria-label="Amigos" className="mb-3 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {amigos.map((amigo) => {
              const marcado = escolhidos.has(amigo.conta_id);
              return (
                <li key={amigo.conta_id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marcado}
                    onClick={() => alternar(amigo.conta_id)}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-superficie-hover", marcado && "bg-superficie-elevada")}
                  >
                    <span className={cn("grid size-4 place-items-center rounded-sm border border-borda", marcado && "border-primaria bg-primaria text-fundo")}>
                      {marcado && <Check className="size-3" aria-hidden />}
                    </span>
                    <span className="truncate">{amigo.nome}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Input value={recado} onChange={(e) => setRecado(e.target.value)} maxLength={200} placeholder="Recado (opcional)" aria-label="Recado" className="mb-3" />
        <Button className="w-full" disabled={escolhidos.size === 0 || enviando} onClick={() => void enviar()}>
          <Send /> {enviando ? "Enviando..." : "Enviar"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
