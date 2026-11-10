import { cn } from "@/shared/lib/utils";
import type { FaixaDeDificuldade } from "../beatmaps/dificuldades";
import type { FiltroDoSorteio } from "../busca/sortear";

export const TECLAS_DO_SORTEIO = [4, 5, 6, 7, 8, 9, 10];
export const FAIXAS_DO_SORTEIO: FaixaDeDificuldade[] = ["Easy", "Normal", "Hard", "Insane", "Expert", "Expert+"];
const CHAVE = "riffrush:mania:filtro-da-aleatoria";

export const FILTRO_VAZIO: FiltroDoSorteio = { teclas: [], faixas: [] };

export function carregarFiltroDaAleatoria(): FiltroDoSorteio {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    return {
      teclas: (salvo?.teclas ?? []).filter((t: unknown) => TECLAS_DO_SORTEIO.includes(t as number)),
      faixas: (salvo?.faixas ?? []).filter((f: unknown) => FAIXAS_DO_SORTEIO.includes(f as FaixaDeDificuldade)),
    };
  } catch {
    return FILTRO_VAZIO;
  }
}

export function salvarFiltroDaAleatoria(filtro: FiltroDoSorteio) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(filtro));
  } catch {
    // Sem armazenamento, o filtro vale só nesta sessão.
  }
}

const alternar = <T,>(lista: T[], item: T) => (lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item]);

function Chips<T extends string | number>({ titulo, opcoes, escolhidas, rotulo, aoAlternar }: { titulo: string; opcoes: T[]; escolhidas: T[]; rotulo: (o: T) => string; aoAlternar: (o: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-texto-suave">{titulo}</p>
      <div role="group" aria-label={titulo} className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => {
          const ligada = escolhidas.includes(opcao);
          return (
            <button
              key={opcao}
              aria-pressed={ligada}
              onClick={() => aoAlternar(opcao)}
              className={cn(
                "rounded-lg border px-3 py-1 text-sm font-semibold transition-colors",
                ligada ? "border-primaria bg-primaria text-texto" : "border-borda bg-superficie text-texto-suave hover:bg-superficie-hover",
              )}
            >
              {rotulo(opcao)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Quais teclas e faixas de dificuldade a Aleatória pode trazer. Nada marcado é qualquer uma. */
export function FiltroDaAleatoria({ filtro, aoMudar }: { filtro: FiltroDoSorteio; aoMudar: (filtro: FiltroDoSorteio) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Chips titulo="Teclas" opcoes={TECLAS_DO_SORTEIO} escolhidas={filtro.teclas} rotulo={(t) => `${t}K`} aoAlternar={(t) => aoMudar({ ...filtro, teclas: alternar(filtro.teclas, t) })} />
      <Chips titulo="Dificuldade" opcoes={FAIXAS_DO_SORTEIO} escolhidas={filtro.faixas} rotulo={(f) => f} aoAlternar={(f) => aoMudar({ ...filtro, faixas: alternar(filtro.faixas, f) })} />
      <p className="text-xs text-texto-suave">Sem nada marcado, vale qualquer uma.</p>
    </div>
  );
}
