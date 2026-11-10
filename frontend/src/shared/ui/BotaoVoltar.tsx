import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";
import { Button } from "./button";

// Os botões montados, do mais antigo ao mais novo: o Esc é só do último (ex.: o painel por cima da tela).
const pilha: symbol[] = [];

interface Props {
  aoVoltar: () => void;
  rotulo?: string;
  className?: string;
}

/** O voltar de toda tela: a seta no topo, e o Esc faz o mesmo. */
export function BotaoVoltar({ aoVoltar, rotulo = "Voltar", className }: Props) {
  const id = useRef(Symbol("voltar")).current;

  useEffect(() => {
    pilha.push(id);
    return () => {
      pilha.splice(pilha.indexOf(id), 1);
    };
  }, [id]);

  useTeclado((evento) => {
    if (evento.code !== "Escape" || evento.defaultPrevented || pilha[pilha.length - 1] !== id) return;
    if (evento.target instanceof HTMLTextAreaElement) return;
    // Um diálogo ou menu aberto fecha com o Esc, sem levar a tela junto.
    if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
    aoVoltar();
  });

  return (
    <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label={rotulo} className={cn("shrink-0", className)}>
      <ArrowLeft aria-hidden />
    </Button>
  );
}
