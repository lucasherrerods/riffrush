import { ArrowLeft, CircleDot, Route } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { EscolhaDeCacapa } from "./EscolhaDeCacapa";
import { PersonalizacaoDaPista } from "./PersonalizacaoDaPista";

interface Props {
  skinDaPista: string;
  skinDaCacapa: string;
  aoMudar: (parcial: { skinDaPista?: string; skinDaCacapa?: string }) => void;
  aoVoltar: () => void;
}

/** O visual do jogo: a pista e as caçapas, cada uma com a sua escolha. */
export function TelaDeCustomizacao({ skinDaPista, skinDaCacapa, aoMudar, aoVoltar }: Props) {
  useTeclado((evento) => {
    if (evento.key === "Escape") aoVoltar();
  });
  return (
    <div className="respiro-de-tela flex h-full flex-col">
      <header className="flex items-center gap-4 max-md:gap-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela">Customizar</h1>
      </header>
      <Tabs defaultValue="pista" className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <TabsList className="abas-rolaveis w-full">
          <TabsTrigger value="pista">
            <Route className="opacity-70" /> Pista
          </TabsTrigger>
          <TabsTrigger value="cacapas">
            <CircleDot className="opacity-70" /> Caçapas
          </TabsTrigger>
        </TabsList>
        <div className="rolagem-de-toque mt-2 min-h-0 flex-1 placa p-2 max-md:mt-1 max-md:p-1.5">
          <TabsContent value="pista">
            <PersonalizacaoDaPista escolhida={skinDaPista} aoEscolher={(id) => aoMudar({ skinDaPista: id })} />
          </TabsContent>
          <TabsContent value="cacapas">
            <EscolhaDeCacapa escolhida={skinDaCacapa} aoEscolher={(id) => aoMudar({ skinDaCacapa: id })} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
