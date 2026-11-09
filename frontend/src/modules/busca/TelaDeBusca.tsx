import { ArrowLeft, Search } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export type EstadoDaBusca = { tipo: "carregando" } | { tipo: "erro"; mensagem: string } | { tipo: "pronto"; vazio: boolean };

interface Props {
  /** Só para leitores de tela; a tela abre direto no campo. */
  titulo: string;
  rotuloDoCampo: string;
  placeholder: string;
  texto: string;
  aoMudarTexto: (texto: string) => void;
  aoVoltar?: () => void;
  /** Com um modal aberto, o Esc é dele. */
  escBloqueado?: boolean;
  filtros?: React.ReactNode;
  /** Uma linha de aviso abaixo dos filtros. */
  aviso?: React.ReactNode;
  /** Entre os filtros e a lista (ex.: paginação). */
  barra?: React.ReactNode;
  estado: EstadoDaBusca;
  mensagemDeVazio?: string;
  /** Os itens da lista (ItemDaBusca). */
  children?: React.ReactNode;
  /** De onde vêm os resultados. */
  fonte?: React.ReactNode;
}

/** A tela de busca dos dois modos: campo, filtros em chips e a lista de resultados para baixar. */
export function TelaDeBusca(props: Props) {
  const { aoVoltar, estado } = props;
  useTeclado((evento) => {
    if (evento.code === "Escape" && !props.escBloqueado) aoVoltar?.();
  });

  return (
    <section className="respiro-de-tela relative flex h-full flex-col">
      <h1 className="sr-only">{props.titulo}</h1>
      <div className="flex items-center gap-2">
        {aoVoltar && (
          <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
            <ArrowLeft aria-hidden />
          </Button>
        )}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 opacity-70" aria-hidden />
          <Input type="search" aria-label={props.rotuloDoCampo} placeholder={props.placeholder} value={props.texto} onChange={(e) => props.aoMudarTexto(e.target.value)} className="pl-9" autoFocus />
        </div>
      </div>
      {props.filtros && <div className="flex flex-wrap items-end gap-6 max-md:gap-3">{props.filtros}</div>}
      {props.aviso && <p className="text-sm text-texto-suave">{props.aviso}</p>}
      {props.barra}

      {estado.tipo === "erro" && (
        <p role="alert" className="text-perigo">
          {estado.mensagem}
        </p>
      )}
      {estado.tipo === "carregando" && <p className="text-texto-suave">Buscando…</p>}
      {estado.tipo === "pronto" && estado.vazio && <p className="text-texto-suave">{props.mensagemDeVazio ?? "Nada encontrado."}</p>}

      <ul aria-label="Resultados" aria-busy={estado.tipo === "carregando"} className="rolagem-de-toque flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {estado.tipo === "pronto" && props.children}
      </ul>
      {props.fonte && <p className="text-xs text-texto-suave">{props.fonte}</p>}
    </section>
  );
}
