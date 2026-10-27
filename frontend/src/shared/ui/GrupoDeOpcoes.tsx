import { cn } from "@/shared/lib/utils";

interface Opcao<T extends string> {
  id: T;
  rotulo: string;
  /** Quando existe, a opção aparece como uma bolinha de cor. */
  cor?: string;
}

interface Props<T extends string> {
  titulo: string;
  opcoes: Opcao<T>[];
  valor: T;
  aoEscolher: (valor: T) => void;
}

/** Uma escolha entre várias opções, como chips de texto ou bolinhas de cor. */
export function GrupoDeOpcoes<T extends string>({ titulo, opcoes, valor, aoEscolher }: Props<T>) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-texto-suave">{titulo}</p>
      <div role="radiogroup" aria-label={titulo} className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => {
          const escolhida = opcao.id === valor;
          return (
            <button
              key={opcao.id}
              role="radio"
              aria-checked={escolhida}
              aria-label={opcao.rotulo}
              onClick={() => aoEscolher(opcao.id)}
              className={cn(
                "transition-colors",
                opcao.cor
                  ? "size-10 rounded-full border-2"
                  : "rounded-lg border px-3 py-1 text-sm font-semibold max-md:px-4 max-md:py-2 max-md:text-base",
                opcao.cor && (escolhida ? "border-texto" : "border-borda"),
                !opcao.cor && (escolhida ? "border-primaria bg-primaria text-texto" : "border-borda bg-superficie text-texto-suave hover:bg-superficie-hover"),
              )}
              style={opcao.cor ? { background: opcao.cor } : undefined}
            >
              {!opcao.cor && opcao.rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}
