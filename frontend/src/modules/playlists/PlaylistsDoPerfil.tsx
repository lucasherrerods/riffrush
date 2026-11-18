import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Copy, EyeOff, ListMusic } from "lucide-react";
import { sessaoDaConta } from "@/modules/conta";
import type { Modo } from "@/shared/modo";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";
import { EtiquetaDeModo } from "@/shared/ui/EtiquetaDeModo";
import { apiDasPlaylists } from "./api";
import type { Playlist } from "./playlists";
import { lojaDoModo } from "./usePlaylists";

type PlaylistComModo = Playlist & { modo: Modo };

const MODOS: Modo[] = ["rock", "mania"];

function Lista({ playlists, aoCopiar }: { playlists: PlaylistComModo[]; aoCopiar?: (p: PlaylistComModo) => void }) {
  return (
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {playlists.map((p) => (
        <li key={p.id} aria-label={p.nome} className="flex items-center gap-3 rounded-md border border-borda bg-superficie p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-superficie-elevada text-texto-suave">
            <ListMusic className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <EtiquetaDeModo modo={p.modo} />
              <span className="truncate font-bold">{p.nome}</span>
              {!p.publica && <EyeOff className="size-3.5 shrink-0 text-texto-suave" aria-label="Só você vê" />}
            </span>
            <span className="block truncate text-xs text-texto-suave">
              {p.faixas.length === 1 ? "1 música" : `${p.faixas.length} músicas`}
              {p.faixas.length > 0 && ` · ${p.faixas.slice(0, 3).map((f) => f.titulo).join(", ")}${p.faixas.length > 3 ? "…" : ""}`}
            </span>
          </span>
          {aoCopiar && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => aoCopiar(p)}>
              <Copy /> Salvar
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Secao({ vazia, children }: { vazia: string | null; children: ReactNode }) {
  return (
    <section aria-label="Playlists" className="placa flex flex-col gap-4 p-6 max-md:gap-3 max-md:p-3">
      <h3 className="titulo-de-secao font-titulo tracking-wide">Playlists</h3>
      {vazia ? <p className="text-sm text-texto-suave">{vazia}</p> : children}
    </section>
  );
}

/** As playlists de quem está logado, nos dois modos, inclusive as que só a pessoa vê. */
function MinhasPlaylists() {
  const rock = useSyncExternalStore(lojaDoModo("rock").inscrever, lojaDoModo("rock").estado);
  const mania = useSyncExternalStore(lojaDoModo("mania").inscrever, lojaDoModo("mania").estado);
  const todas = [...rock.map((p) => ({ ...p, modo: "rock" as const })), ...mania.map((p) => ({ ...p, modo: "mania" as const }))];
  return (
    <Secao vazia={todas.length ? null : "Nenhuma playlist ainda. Crie uma na seleção de músicas."}>
      <Lista playlists={todas} />
    </Secao>
  );
}

/** As que o amigo deixou visíveis, com o botão de guardar uma cópia entre as suas. */
function PlaylistsDoAmigo({ contaId }: { contaId: string }) {
  const [playlists, setPlaylists] = useState<PlaylistComModo[] | null>(null);

  useEffect(() => {
    const token = sessaoDaConta.token();
    if (!token) return;
    const controle = new AbortController();
    apiDasPlaylists
      .doAmigo(token, contaId, controle.signal)
      .then((lista) => setPlaylists(lista.filter((p) => MODOS.includes(p.modo))))
      .catch(() => {
        if (!controle.signal.aborted) setPlaylists([]);
      });
    return () => controle.abort();
  }, [contaId]);

  if (playlists === null) return null;
  const copiar = (p: PlaylistComModo) => {
    if (lojaDoModo(p.modo).copiar(p)) avisar.success(`${p.nome} salva nas suas playlists.`);
  };
  return (
    <Secao vazia={playlists.length ? null : "Nenhuma playlist visível."}>
      <Lista playlists={playlists} aoCopiar={copiar} />
    </Secao>
  );
}

/** A seção de playlists do perfil: as suas, ou as do amigo quando vem o `contaId`. */
export function PlaylistsDoPerfil({ contaId }: { contaId?: string }) {
  return contaId ? <PlaylistsDoAmigo contaId={contaId} /> : <MinhasPlaylists />;
}
