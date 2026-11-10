import type { ReactNode } from "react";
import { ArrowLeft, RotateCcw, type LucideIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

export interface AbaDeConfiguracoes {
  id: string;
  rotulo: string;
  icone: LucideIcon;
  conteudo: ReactNode;
}

interface Props {
  abas: AbaDeConfiguracoes[];
  aoVoltar: () => void;
  /** Sem ele, o botão de restaurar o padrão não aparece. */
  aoRestaurar?: () => void;
}

/** A tela de configurações dos dois modos: cabeçalho e abas. O conteúdo de cada aba vem do modo. */
export function MolduraDeConfiguracoes({ abas, aoVoltar, aoRestaurar }: Props) {
  return (
    <div className="respiro-de-tela flex h-full flex-col">
      <header className="flex items-center gap-4 max-md:gap-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela">Configurações</h1>
        <div className="flex-1" />
        {aoRestaurar && (
          <Button variant="ghost" aria-label="Restaurar padrão" onClick={aoRestaurar}>
            <RotateCcw className="opacity-70" /> <span className="max-md:sr-only">Restaurar padrão</span>
          </Button>
        )}
      </header>

      <Tabs defaultValue={abas[0]?.id} className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <TabsList className="abas-rolaveis w-full">
          {abas.map(({ id, rotulo, icone: Icone }) => (
            <TabsTrigger key={id} value={id}>
              <Icone className="opacity-70" /> {rotulo}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="rolagem-de-toque mt-2 min-h-0 flex-1 placa p-2 max-md:mt-1 max-md:p-1.5">
          {abas.map(({ id, conteudo }) => (
            <TabsContent key={id} value={id} className="flex flex-col gap-2">
              {conteudo}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
