import { useState, type KeyboardEvent } from "react";
import { Eye, EyeOff, ListMusic, Play, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import type { Playlist } from "./playlists";
import type { ApiDasPlaylistsDoModo } from "./usePlaylists";

interface Props {
  playlists: ApiDasPlaylistsDoModo;
  /** Começa a maratona: todas as músicas da playlist em sequência. */
  aoTocar: (playlist: Playlist) => void;
}

/** O botão "Playlists" nos filtros da seleção, com a lista para tocar em maratona ou apagar. */
export function BotaoDasPlaylists({ playlists, aoTocar }: Props) {
  const [aberto, setAberto] = useState(false);
  const segurarTeclas = (evento: KeyboardEvent) => evento.stopPropagation();

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <ListMusic className="opacity-70" />
          <span className="max-md:sr-only">Playlists</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80" onKeyDown={segurarTeclas}>
        <p className="mb-2 font-bold">Playlists</p>
        {playlists.playlists.length === 0 ? (
          <p className="text-sm text-texto-suave">Nenhuma ainda. Use o botão de playlist no cartão da música para criar uma.</p>
        ) : (
          <ul aria-label="Suas playlists" className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {playlists.playlists.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-superficie-hover">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p.nome}</span>
                  <span className="block text-xs text-texto-suave">{p.faixas.length === 1 ? "1 música" : `${p.faixas.length} músicas`}</span>
                </span>
                <Button
                  size="sm"
                  disabled={p.faixas.length === 0}
                  aria-label={`Tocar ${p.nome} em maratona`}
                  onClick={() => {
                    setAberto(false);
                    aoTocar(p);
                  }}
                >
                  <Play /> Tocar
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-pressed={p.publica}
                  aria-label={`${p.nome} aparece no perfil para os amigos`}
                  title={p.publica ? "Aparece no perfil para os amigos" : "Só você vê"}
                  onClick={() => playlists.alternarPublica(p.id)}
                >
                  {p.publica ? <Eye /> : <EyeOff className="opacity-60" />}
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Apagar ${p.nome}`} onClick={() => playlists.apagar(p.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
