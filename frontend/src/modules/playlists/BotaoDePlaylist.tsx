import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, ListPlus, Plus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { contem, type Faixa } from "./playlists";
import type { ApiDasPlaylistsDoModo } from "./usePlaylists";

interface Props {
  /** A música selecionada na versão escolhida; sem ela o botão fica desligado. */
  faixa: Faixa | null;
  playlists: ApiDasPlaylistsDoModo;
}

/** O botão redondo, ao lado do coração, que põe ou tira a música selecionada das playlists. */
export function BotaoDePlaylist({ faixa, playlists }: Props) {
  const [nome, setNome] = useState("");

  const criar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!faixa || playlists.criar(nome, [faixa]) === null) return;
    setNome("");
  };

  // A seleção escuta as teclas na janela inteira (Enter toca, F favorita): aqui dentro elas ficam no painel.
  const segurarTeclas = (evento: KeyboardEvent) => evento.stopPropagation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Adicionar à playlist"
          title="Adicionar à playlist"
          disabled={!faixa}
          className="grid size-10 place-items-center rounded-full border border-borda bg-fundo/70 text-texto backdrop-blur-sm transition-colors hover:bg-fundo/90 disabled:opacity-40"
        >
          <ListPlus className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72" onKeyDown={segurarTeclas}>
        <p className="mb-2 font-bold">Adicionar à playlist</p>
        {playlists.playlists.length > 0 && (
          <ul aria-label="Playlists" className="mb-3 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {playlists.playlists.map((p) => {
              const marcada = !!faixa && contem(p, faixa);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marcada}
                    onClick={() => faixa && playlists.alternar(p.id, faixa)}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-superficie-hover", marcada && "bg-superficie-elevada")}
                  >
                    <span className={cn("grid size-4 place-items-center rounded-sm border border-borda", marcada && "border-primaria bg-primaria text-fundo")}>
                      {marcada && <Check className="size-3" aria-hidden />}
                    </span>
                    <span className="flex-1 truncate">{p.nome}</span>
                    <span className="text-xs text-texto-suave tabular-nums">{p.faixas.length}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <form onSubmit={criar} className="flex gap-2">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} placeholder="Nova playlist" aria-label="Nome da nova playlist" />
          <Button type="submit" size="icon" aria-label="Criar playlist com esta música">
            <Plus />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
