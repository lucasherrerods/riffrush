import { useEffect, useState } from "react";
import { ArrowLeft, Check, Dices, Guitar, PersonStanding, Scissors, Shirt, Smile } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Slider } from "@/shared/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Avatar } from "./Avatar";
import {
  ACESSORIOS,
  AJUSTES_DO_CORPO,
  AJUSTES_DO_ROSTO,
  BARBAS,
  CABELOS,
  CORES_DE_CABELO,
  CORES_DE_DETALHE,
  CORES_DE_ROUPA,
  CORES_DOS_OLHOS,
  INSTRUMENTOS,
  ROUPAS,
  TONS_DE_PELE,
} from "./catalogo";
import { migrarPersonagem, personagemAleatorio, type Personagem } from "./personagem";

interface Props {
  personagem: Personagem;
  aoSalvar: (personagem: Personagem) => void;
  aoVoltar: () => void;
}

const comoCores = (cores: string[], nome: string) => cores.map((cor, i) => ({ id: cor, rotulo: `${nome} ${i + 1}`, cor }));
const INTERVALO_DA_PALHETADA = 500;

const ABAS = [
  { id: "corpo", rotulo: "Corpo", icone: PersonStanding },
  { id: "rosto", rotulo: "Rosto", icone: Smile },
  { id: "cabelo", rotulo: "Cabelo", icone: Scissors },
  { id: "roupa", rotulo: "Roupa", icone: Shirt },
  { id: "instrumento", rotulo: "Instrumento", icone: Guitar },
];

function Ajuste({ rotulo, valor, aoMudar }: { rotulo: string; valor: number; aoMudar: (valor: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <p className="w-44 text-base font-semibold text-texto-suave">{rotulo}</p>
      <Slider aria-label={rotulo} className="flex-1" value={[valor]} min={0} max={1} step={0.01} onValueChange={([novo]) => aoMudar(novo)} />
    </div>
  );
}

export function TelaDePersonagem({ personagem, aoSalvar, aoVoltar }: Props) {
  const [rascunho, setRascunho] = useState(() => migrarPersonagem(personagem));
  const [pulso, setPulso] = useState(0);
  const mudar = (parcial: Partial<Personagem>) => setRascunho((atual) => ({ ...atual, ...parcial }));
  const mudarCores = (parcial: Partial<Personagem["cores"]>) => setRascunho((atual) => ({ ...atual, cores: { ...atual.cores, ...parcial } }));
  const nomeValido = rascunho.nome.trim().length > 0;

  // Palhetadas de demonstração na prévia.
  useEffect(() => {
    const id = setInterval(() => setPulso((p) => p + 1), INTERVALO_DA_PALHETADA);
    return () => clearInterval(id);
  }, []);

  useTeclado((evento) => {
    if (evento.code === "Escape" && !(evento.target instanceof HTMLInputElement)) aoVoltar();
  });

  return (
    <div className="flex h-full flex-col gap-6 p-8 max-md:p-4">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1]">Seu personagem</h1>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setRascunho(personagemAleatorio(rascunho.nome))}>
          <Dices className="opacity-70" /> Aleatório
        </Button>
        <Button disabled={!nomeValido} onClick={() => aoSalvar({ ...rascunho, nome: rascunho.nome.trim() })}>
          <Check className="opacity-70" /> Salvar
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:grid-cols-1 max-md:overflow-y-auto">
        <section className="col-span-5 flex min-h-0 flex-col items-center justify-center gap-2 rounded-3xl border border-borda bg-superficie p-6">
          <Avatar personagem={rascunho} tocando pulso={pulso} className="h-[min(60vh,480px)] w-auto" />
          <p className="font-titulo text-3xl uppercase">{rascunho.nome.trim() || "Sem nome"}</p>
          <p className="text-base text-texto-suave">{INSTRUMENTOS.find((i) => i.id === rascunho.instrumento)?.rotulo}</p>
        </section>

        <section className="col-span-7 flex min-h-0 flex-col gap-6 rounded-3xl border border-borda bg-superficie p-6">
          <div>
            <Label htmlFor="nome-do-personagem" className="mb-2 text-base font-semibold text-texto-suave">
              Nome
            </Label>
            <Input id="nome-do-personagem" value={rascunho.nome} maxLength={16} onChange={(e) => mudar({ nome: e.target.value })} className="max-w-xs text-base" />
          </div>

          <Tabs defaultValue="corpo" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="w-full">
              {ABAS.map(({ id, rotulo, icone: Icone }) => (
                <TabsTrigger key={id} value={id}>
                  <Icone className="opacity-70" /> {rotulo}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto pt-4">
              <TabsContent value="corpo" className="flex flex-col gap-6">
                {AJUSTES_DO_CORPO.map(({ id, rotulo }) => (
                  <Ajuste key={id} rotulo={rotulo} valor={rascunho.corpo[id]} aoMudar={(valor) => mudar({ corpo: { ...rascunho.corpo, [id]: valor } })} />
                ))}
                <GrupoDeOpcoes titulo="Pele" opcoes={comoCores(TONS_DE_PELE, "Pele")} valor={rascunho.cores.pele} aoEscolher={(pele) => mudarCores({ pele })} />
              </TabsContent>

              <TabsContent value="rosto" className="flex flex-col gap-6">
                {AJUSTES_DO_ROSTO.map(({ id, rotulo }) => (
                  <Ajuste key={id} rotulo={rotulo} valor={rascunho.rosto[id]} aoMudar={(valor) => mudar({ rosto: { ...rascunho.rosto, [id]: valor } })} />
                ))}
                <GrupoDeOpcoes titulo="Cor dos olhos" opcoes={comoCores(CORES_DOS_OLHOS, "Olhos")} valor={rascunho.cores.olhos} aoEscolher={(olhos) => mudarCores({ olhos })} />
                <GrupoDeOpcoes titulo="Acessório" opcoes={ACESSORIOS} valor={rascunho.acessorio} aoEscolher={(acessorio) => mudar({ acessorio })} />
              </TabsContent>

              <TabsContent value="cabelo" className="flex flex-col gap-6">
                <GrupoDeOpcoes titulo="Corte" opcoes={CABELOS} valor={rascunho.cabelo} aoEscolher={(cabelo) => mudar({ cabelo })} />
                <GrupoDeOpcoes titulo="Barba" opcoes={BARBAS} valor={rascunho.barba} aoEscolher={(barba) => mudar({ barba })} />
                <GrupoDeOpcoes titulo="Cor" opcoes={comoCores(CORES_DE_CABELO, "Cor do cabelo")} valor={rascunho.cores.cabelo} aoEscolher={(cabelo) => mudarCores({ cabelo })} />
              </TabsContent>

              <TabsContent value="roupa" className="flex flex-col gap-6">
                <GrupoDeOpcoes titulo="Peça" opcoes={ROUPAS} valor={rascunho.roupa} aoEscolher={(roupa) => mudar({ roupa })} />
                <GrupoDeOpcoes titulo="Cor principal" opcoes={comoCores(CORES_DE_ROUPA, "Roupa")} valor={rascunho.cores.roupa} aoEscolher={(roupa) => mudarCores({ roupa })} />
                <GrupoDeOpcoes titulo="Detalhes" opcoes={comoCores(CORES_DE_DETALHE, "Detalhe")} valor={rascunho.cores.detalhe} aoEscolher={(detalhe) => mudarCores({ detalhe })} />
              </TabsContent>

              <TabsContent value="instrumento" className="flex flex-col gap-6">
                <GrupoDeOpcoes titulo="Instrumento" opcoes={INSTRUMENTOS} valor={rascunho.instrumento} aoEscolher={(instrumento) => mudar({ instrumento })} />
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
