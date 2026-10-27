import { IDENTIDADE_DO_MANIA } from "./identidade";

/** A raiz do modo Mania. Por enquanto só se apresenta: as telas chegam nas próximas fases. */
export function TelaDoMania() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2 bg-fundo text-texto">
      <h1 className="font-titulo text-5xl tracking-wide">{IDENTIDADE_DO_MANIA.nome}</h1>
      <p className="text-texto-suave">Em construção.</p>
    </main>
  );
}
