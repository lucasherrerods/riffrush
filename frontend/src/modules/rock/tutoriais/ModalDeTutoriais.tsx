import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { GRUPOS, TUTORIAIS, type GrupoDoTutorial, type Tutorial } from "./conteudo";
import { DemonstracaoDaPista } from "./DemonstracaoDaPista";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** Para os testes: outro conteúdo no lugar do do jogo. */
  tutoriais?: Tutorial[];
}

/** Os tutoriais do Rock: os modos de jogo numa aba e as mecânicas na outra, cada tópico com texto e a pista animada. */
export function ModalDeTutoriais({ aberto, aoFechar, tutoriais = TUTORIAIS }: Props) {
  const [grupo, setGrupo] = useState<GrupoDoTutorial>("modos");
  const doGrupo = tutoriais.filter((t) => t.grupo === grupo);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const tutorial = doGrupo.find((t) => t.id === escolhido) ?? doGrupo[0];

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent className="flex max-h-[90dvh] max-w-5xl flex-col gap-4 p-6 max-md:p-4">
        <DialogTitle className="text-4xl max-md:text-3xl">Tutoriais</DialogTitle>
        <DialogDescription className="sr-only">Os modos de jogo e as mecânicas do Riff Rush, com uma pista animada em cada tópico.</DialogDescription>
        <Tabs
          value={grupo}
          onValueChange={(valor) => {
            setGrupo(valor as GrupoDoTutorial);
            setEscolhido(null);
          }}
        >
          <TabsList className="w-full">
            {GRUPOS.map((g) => (
              <TabsTrigger key={g.id} value={g.id}>
                {g.titulo}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:grid-cols-1 max-md:gap-4">
          <nav aria-label="Tópicos" className="col-span-4 max-md:col-span-1">
            <ul className="rolagem-de-toque abas-rolaveis flex max-h-full flex-col gap-1 max-md:flex-row max-md:gap-2">
              {doGrupo.map((t) => {
                const atual = t.id === tutorial?.id;
                return (
                  <li key={t.id} className="max-md:shrink-0">
                    <button
                      type="button"
                      aria-current={atual}
                      onClick={() => setEscolhido(t.id)}
                      className={cn(
                        "chapa w-full px-4 py-2 text-left text-base transition-colors max-md:whitespace-nowrap",
                        atual ? "border-primaria bg-primaria/15 text-texto" : "border-transparent bg-superficie text-texto-suave hover:bg-superficie-hover hover:text-texto",
                      )}
                    >
                      {t.titulo}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {tutorial && (
            <article key={tutorial.id} aria-labelledby={`tutorial-${tutorial.id}`} className="rolagem-de-toque col-span-8 flex min-h-0 flex-col gap-4 max-md:col-span-1">
              <header className="flex flex-col gap-1">
                <h2 id={`tutorial-${tutorial.id}`} className="font-titulo text-3xl leading-[1.1] tracking-wide">
                  {tutorial.titulo}
                </h2>
                <p className="text-base text-texto-suave">{tutorial.resumo}</p>
              </header>
              <div className={cn("grid gap-6", tutorial.demo && "md:grid-cols-2")}>
                {tutorial.demo && <DemonstracaoDaPista roteiro={tutorial.demo} rotulo={`Demonstração: ${tutorial.titulo}`} />}
                <div className="flex max-w-[65ch] flex-col gap-4 text-base leading-relaxed">
                  {tutorial.texto.map((paragrafo) => (
                    <p key={paragrafo}>{paragrafo}</p>
                  ))}
                  {tutorial.dicas && (
                    <ul className="flex list-disc flex-col gap-2 pl-6 text-texto-suave">
                      {tutorial.dicas.map((dica) => (
                        <li key={dica}>{dica}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
