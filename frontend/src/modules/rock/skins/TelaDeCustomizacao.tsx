import { ArrowLeft, Hexagon, Palette, Route } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { EscolhaDasCores, EscolhaDoFormato, type EscolhasDaCacapa } from "./EscolhaDaCacapa";
import { PersonalizacaoDaPista } from "./PersonalizacaoDaPista";

export interface EscolhasDeCustomizacao extends EscolhasDaCacapa {
  skinDaPista: string;
}

interface Props {
  valores: EscolhasDeCustomizacao;
  aoMudar: (parcial: Partial<EscolhasDeCustomizacao>) => void;
  aoVoltar: () => void;
}

/** O visual do jogo. A pista, o formato e as cores das caçapas são escolhas separadas, que se combinam. */
export function TelaDeCustomizacao({ valores, aoMudar, aoVoltar }: Props) {
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
          <TabsTrigger value="formato">
            <Hexagon className="opacity-70" /> Formato
          </TabsTrigger>
          <TabsTrigger value="cores">
            <Palette className="opacity-70" /> Cores
          </TabsTrigger>
        </TabsList>
        <div className="rolagem-de-toque mt-2 min-h-0 flex-1 placa p-2 max-md:mt-1 max-md:p-1.5">
          <TabsContent value="pista">
            <PersonalizacaoDaPista escolhida={valores.skinDaPista} aoEscolher={(id) => aoMudar({ skinDaPista: id })} />
          </TabsContent>
          <TabsContent value="formato">
            <EscolhaDoFormato {...valores} aoMudar={aoMudar} />
          </TabsContent>
          <TabsContent value="cores">
            <EscolhaDasCores {...valores} aoMudar={aoMudar} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
