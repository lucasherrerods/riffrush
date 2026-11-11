import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronUp, Info, ListOrdered, SlidersHorizontal } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

interface Props {
  /** Voltar e as ações da tela (BarraDaSelecao). */
  cabecalho: ReactNode;
  /** Busca, ordem e filtros do modo: ficam recolhidos atrás do botão Filtros. */
  filtros?: ReactNode;
  /** Opções que ficam sempre à vista acima da lista (ex.: o instrumento no Rock). */
  extras?: ReactNode;
  /** A roda (Carrossel) ou o aviso de lista vazia. */
  lista: ReactNode;
  /** O que está selecionado, no resumo da gaveta. */
  titulo?: string;
  subtitulo?: string;
  capa?: ReactNode;
  favoritar?: ReactNode;
  detalhes?: ReactNode;
  /** Sem ranking, a gaveta mostra só os detalhes. */
  ranking?: ReactNode;
  tocar: ReactNode;
  /** O fundo borrado da seleção. */
  fundo?: ReactNode;
}

/** Quanto o dedo arrasta o resumo (px) para a gaveta abrir ou fechar. */
const ARRASTE_DA_GAVETA = 40;

/**
 * A seleção no celular: a roda ocupa a tela e o resto fica a um gesto.
 * Embaixo, o resumo do selecionado e o tocar; tocar ou arrastar o resumo para cima abre a gaveta com ranking e detalhes.
 */
export function SelecaoNoCelular({ cabecalho, filtros, extras, lista, titulo, subtitulo, capa, favoritar, detalhes, ranking, tocar, fundo }: Props) {
  const [aberta, setAberta] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // Com a gaveta aberta, o Esc só a fecha: sem isso a tela voltaria ao menu.
  useTeclado(
    (evento) => {
      if (!aberta || evento.code !== "Escape") return;
      evento.stopImmediatePropagation();
      evento.preventDefault();
      setAberta(false);
    },
    { captura: true },
  );

  return (
    <div className="relative isolate flex h-full flex-col">
      {fundo}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        {cabecalho}
        {filtros && (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-expanded={filtrosAbertos}
              onClick={() => setFiltrosAbertos((a) => !a)}
              className={cn("self-start", filtrosAbertos && "border-primaria text-primaria")}
            >
              <SlidersHorizontal className="opacity-70" /> Filtros
            </Button>
            {filtrosAbertos && filtros}
          </div>
        )}
        {extras}
        {lista}
      </div>

      <footer className="flex flex-col gap-3 border-t border-borda bg-superficie p-3">
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, { offset }) => {
            if (offset.y < -ARRASTE_DA_GAVETA) setAberta(true);
            if (offset.y > ARRASTE_DA_GAVETA) setAberta(false);
          }}
          className="flex touch-none items-center gap-2"
        >
          <button type="button" aria-expanded={aberta} onClick={() => setAberta((a) => !a)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            {capa && <span className="size-10 shrink-0 overflow-hidden rounded-sm">{capa}</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-titulo text-xl tracking-wide uppercase">{titulo}</span>
              {subtitulo && <span className="block truncate text-sm text-texto-suave">{subtitulo}</span>}
            </span>
            <ChevronUp aria-hidden className={cn("size-5 shrink-0 text-texto-suave transition-transform", aberta && "rotate-180")} />
          </button>
          {favoritar}
        </motion.div>

        {aberta && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex max-h-[55dvh] min-h-0 flex-col">
            <Tabs defaultValue={ranking ? "ranking" : "detalhes"} className="min-h-0 flex-1">
              <TabsList className="w-full">
                <TabsTrigger value="detalhes">
                  <Info className="opacity-70" /> Detalhes
                </TabsTrigger>
                {ranking && (
                  <TabsTrigger value="ranking">
                    <ListOrdered className="opacity-70" /> Ranking
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="detalhes" className="flex min-h-0 flex-col gap-2 overflow-y-auto">
                {detalhes}
              </TabsContent>
              {ranking && (
                <TabsContent value="ranking" className="flex min-h-0 flex-col overflow-y-auto">
                  {ranking}
                </TabsContent>
              )}
            </Tabs>
          </motion.div>
        )}

        {tocar}
      </footer>
    </div>
  );
}
