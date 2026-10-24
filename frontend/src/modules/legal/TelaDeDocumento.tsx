import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { DOCUMENTOS, type Documento } from "./documentos";

interface Props {
  documento: Documento;
  aoVoltar: () => void;
  /** Ações no fim do texto, como excluir a conta na privacidade. */
  children?: ReactNode;
}

export function TelaDeDocumento({ documento, aoVoltar, children }: Props) {
  const { titulo, atualizadoEm, secoes } = DOCUMENTOS[documento];

  useTeclado((evento) => {
    if (evento.code === "Escape") aoVoltar();
  });

  return (
    <div className="flex h-full flex-col gap-4 p-6 max-md:p-4">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] font-black tracking-[-0.02em] max-md:text-3xl">{titulo}</h1>
      </header>

      <article className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto placa p-8 max-md:p-4">
        <div className="mx-auto flex max-w-[68ch] flex-col gap-8">
          <p className="text-base text-texto-suave">Atualizado em {atualizadoEm}</p>
          {secoes.map((secao) => (
            <section key={secao.titulo} className="flex flex-col gap-2">
              <h2 className="font-titulo text-2xl leading-[1.1] tracking-wide uppercase">{secao.titulo}</h2>
              {secao.paragrafos.map((paragrafo) => (
                <p key={paragrafo} className="text-base leading-relaxed">
                  {paragrafo}
                </p>
              ))}
            </section>
          ))}
          {children && <div className="flex flex-wrap gap-4">{children}</div>}
        </div>
      </article>
    </div>
  );
}
