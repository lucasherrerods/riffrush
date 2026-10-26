import { temaAtivo } from "@jogo/src/shared/styles/tokens";

const ITENS = [".chart", ".mid", ".sng", "Clone Hero", "Encore", "Xbox", "PlayStation", "Teclado", "Celular", "LAN", "Online"];

/** Letreiro correndo com tudo o que o jogo aceita. */
export function Faixa() {
  const trastes = temaAtivo.pista.trastes;
  const itens = [...ITENS, ...ITENS];
  return (
    <div className="gasto overflow-hidden border-y border-borda bg-primaria py-4" aria-label="Compatível com">
      <div className="faixa flex w-max gap-10">
        {itens.map((item, i) => (
          <span key={i} aria-hidden={i >= ITENS.length} className="flex items-center gap-10 font-titulo text-3xl whitespace-nowrap text-texto">
            {item}
            <span className="size-3 rotate-45" style={{ background: trastes[i % trastes.length] }} />
          </span>
        ))}
      </div>
    </div>
  );
}
