import { Dices, Dumbbell, Heart, Play } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { CampoDeSelecao } from "@/shared/ui/CampoDeSelecao";
import { CampoDeBusca } from "@/shared/ui/CampoDeBusca";

export interface ModDoChip {
  id: string;
  sigla: string;
  nome: string;
  ligado: boolean;
}

/** Os mods da partida em chips redondos no topo da seleção. */
export function ChipsDeMods({ mods, aoAlternar }: { mods: ModDoChip[]; aoAlternar: (id: string) => void }) {
  return (
    <div role="group" aria-label="Mods" className="flex flex-wrap justify-end gap-2">
      {mods.map((mod) => (
        <button
          key={mod.id}
          type="button"
          aria-pressed={mod.ligado}
          title={mod.nome}
          onClick={() => aoAlternar(mod.id)}
          className={cn(
            "grid h-11 min-w-11 place-items-center rounded-full border-2 px-2 font-titulo text-base tracking-wide",
            mod.ligado ? "border-texto bg-primaria text-texto ring-2 ring-primaria" : "border-borda bg-superficie-elevada text-texto-suave hover:text-texto",
          )}
        >
          {mod.sigla}
        </button>
      ))}
    </div>
  );
}

export function BotaoDeFavoritar({ favorita, aoAlternar }: { favorita: boolean; aoAlternar: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={favorita}
      title="Favoritar (F)"
      onClick={aoAlternar}
      className={cn("rounded-md", favorita ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-superficie")}
    >
      {favorita ? "Tirar dos favoritos" : "Favoritar"}
    </Button>
  );
}

/** O botão grande de tocar, com o treino ao lado, igual nos dois modos. */
export function BotaoDeTocar({ aoTocar, aoTreinar, desabilitado }: { aoTocar: () => void; aoTreinar?: () => void; desabilitado?: boolean }) {
  return (
    <div className="flex gap-2">
      <Button size="lg" className="h-11 flex-1 font-titulo text-xl tracking-widest max-md:h-10 max-md:text-lg" disabled={desabilitado} onClick={aoTocar}>
        <Play className="fill-current opacity-70" /> TOCAR
      </Button>
      {aoTreinar && (
        <Button size="lg" variant="outline" className="h-11 max-md:h-10" disabled={desabilitado} onClick={aoTreinar}>
          <Dumbbell className="opacity-70" /> Treinar
        </Button>
      )}
    </div>
  );
}

export interface Comando {
  teclas: string;
  rotulo: string;
}

/** Os atalhos da tela, no rodapé. Some no celular. */
export function RodapeDeComandos({ comandos }: { comandos: Comando[] }) {
  return (
    <footer className="flex items-center gap-8 bg-superficie px-8 py-2 max-md:hidden">
      {comandos.map((c) => (
        <span key={c.rotulo} className="flex items-center gap-2 text-base">
          <kbd className="rounded-sm bg-superficie-elevada px-2 font-mono text-texto-suave">{c.teclas}</kbd>
          <span className="font-titulo text-xl tracking-wide uppercase">{c.rotulo}</span>
        </span>
      ))}
    </footer>
  );
}

interface PropsDosFiltros<O extends string> {
  texto: string;
  aoMudarTexto: (texto: string) => void;
  /** Ex.: "Buscar na biblioteca". */
  placeholder: string;
  rotuloDoCampo: string;
  ordens: { id: O; rotulo: string }[];
  ordem: O;
  aoMudarOrdem: (ordem: O) => void;
  soFavoritas: boolean;
  aoAlternarFavoritas: () => void;
  /** Sorteia uma da lista; sem ele o botão não aparece. */
  aoSortear?: () => void;
  podeSortear?: boolean;
  /** Filtros próprios do modo (ex.: teclas do Mania). */
  children?: React.ReactNode;
  /** "3 de 10 músicas", abaixo dos filtros. */
  contagem?: string;
}

/** A busca, os filtros, a ordem e o sorteio acima da roda, iguais nos dois modos. */
export function FiltrosDaBiblioteca<O extends string>(props: PropsDosFiltros<O>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-4 max-md:gap-2">
        <CampoDeBusca placeholder={props.placeholder} aria-label={props.rotuloDoCampo} value={props.texto} onChange={(e) => props.aoMudarTexto(e.target.value)} />
        {props.children}
        <CampoDeSelecao titulo="Ordem" opcoes={props.ordens} valor={props.ordem} aoEscolher={props.aoMudarOrdem} />
        <Button variant="outline" aria-pressed={props.soFavoritas} onClick={props.aoAlternarFavoritas} className={cn(props.soFavoritas && "border-primaria text-primaria")}>
          <Heart className={cn(props.soFavoritas ? "fill-current" : "opacity-70")} />
          <span className="max-md:sr-only">Favoritos</span>
        </Button>
        {props.aoSortear && (
          <Button variant="outline" disabled={!props.podeSortear} onClick={props.aoSortear} aria-label="Aleatório">
            <Dices className="opacity-70" />
            <span className="max-md:sr-only">Aleatório</span>
          </Button>
        )}
      </div>
      {props.contagem !== undefined && (
        <p className="text-sm text-texto-suave" aria-live="polite">
          {props.contagem}
        </p>
      )}
    </div>
  );
}

/** O aviso no lugar da roda quando não há nada para mostrar (biblioteca vazia, filtro sem resultado). */
export function AvisoDaLista({ children }: { children: React.ReactNode }) {
  return <p className="chapa m-auto max-w-md bg-superficie-elevada/90 px-6 py-4 text-center text-texto-suave">{children}</p>;
}
