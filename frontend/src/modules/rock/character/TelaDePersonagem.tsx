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
import { AJUSTES_DO_CORPO, BASES, EXPRESSOES, INSTRUMENTOS, PALETAS, PECAS, type ParteColorivel } from "./catalogo";
import { migrarPersonagem, personagemAleatorio, type Personagem } from "./personagem";

interface Props {
  personagem: Personagem;
  aoSalvar: (personagem: Personagem) => void;
  aoVoltar: () => void;
  /** Com a conta logada, o nome é o do Google e não pode ser trocado aqui. */
  nomeDaConta?: string;
}

const ORIGINAL = "original";
/** A primeira opção mantém a cor da textura do modelo. */
const comoCores = (parte: ParteColorivel, nome: string) => [
  { id: ORIGINAL, rotulo: "Original" },
  ...PALETAS[parte].map((cor, i) => ({ id: cor, rotulo: `${nome} ${i + 1}`, cor })),
];
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

export function TelaDePersonagem({ personagem, aoSalvar, aoVoltar, nomeDaConta }: Props) {
  const [rascunho, setRascunho] = useState(() => migrarPersonagem(personagem));
  const [pulso, setPulso] = useState(0);
  const mudar = (parcial: Partial<Personagem>) => setRascunho((atual) => ({ ...atual, ...parcial }));
  const mudarCor = (parte: ParteColorivel, cor: string) =>
    setRascunho((atual) => ({ ...atual, cores: { ...atual.cores, [parte]: cor === ORIGINAL ? null : cor } }));
  const corDa = (parte: ParteColorivel, titulo: string) => (
    <GrupoDeOpcoes titulo={titulo} opcoes={comoCores(parte, titulo)} valor={rascunho.cores[parte] ?? ORIGINAL} aoEscolher={(cor) => mudarCor(parte, cor)} />
  );
  const nomeValido = !!nomeDaConta || rascunho.nome.trim().length > 0;
  const nomeNaTela = nomeDaConta ?? rascunho.nome.trim();

  // Palhetadas de demonstração na prévia.
  useEffect(() => {
    const id = setInterval(() => setPulso((p) => p + 1), INTERVALO_DA_PALHETADA);
    return () => clearInterval(id);
  }, []);

  useTeclado((evento) => {
    if (evento.code === "Escape" && !(evento.target instanceof HTMLInputElement)) aoVoltar();
  });

  return (
    <div className="respiro-de-tela flex h-full flex-col max-md:rolagem-de-toque">
      <header className="flex flex-wrap items-center gap-4 max-md:gap-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela">Seu personagem</h1>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setRascunho(personagemAleatorio(rascunho.nome))}>
          <Dices className="opacity-70" /> Aleatório
        </Button>
        <Button disabled={!nomeValido} onClick={() => aoSalvar({ ...rascunho, nome: rascunho.nome.trim() })}>
          <Check className="opacity-70" /> Salvar
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:flex-none max-md:grid-cols-1 max-md:gap-2">
        <section className="col-span-5 flex min-h-0 flex-col items-center justify-center gap-2 placa p-6 max-md:p-3">
          <Avatar personagem={rascunho} tocando pulso={pulso} className="h-[min(60vh,480px)] w-auto max-md:h-[36vh]" />
          <p className="font-titulo text-3xl uppercase max-md:text-2xl">{nomeNaTela || "Sem nome"}</p>
          <p className="text-base text-texto-suave">{INSTRUMENTOS.find((i) => i.id === rascunho.instrumento)?.rotulo}</p>
        </section>

        <section className="col-span-7 flex min-h-0 flex-col gap-6 placa p-6 max-md:gap-4 max-md:p-3">
          <div>
            <Label htmlFor="nome-do-personagem" className="mb-2 text-base font-semibold text-texto-suave">
              Nome
            </Label>
            {nomeDaConta ? (
              <>
                <Input id="nome-do-personagem" value={nomeDaConta} readOnly disabled className="max-w-xs text-base" />
              </>
            ) : (
              <Input id="nome-do-personagem" value={rascunho.nome} maxLength={16} onChange={(e) => mudar({ nome: e.target.value })} className="max-w-xs text-base" />
            )}
          </div>

          <Tabs defaultValue="corpo" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="abas-rolaveis w-full">
              {ABAS.map(({ id, rotulo, icone: Icone }) => (
                <TabsTrigger key={id} value={id}>
                  <Icone className="opacity-70" /> {rotulo}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="min-h-0 flex-1 pt-4 md:rolagem-de-toque">
              <TabsContent value="corpo" className="flex flex-col gap-6">
                {BASES.length > 1 && (
                  <GrupoDeOpcoes titulo="Modelo" opcoes={BASES} valor={rascunho.base} aoEscolher={(base) => mudar({ base })} />
                )}
                {AJUSTES_DO_CORPO.map(({ id, rotulo }) => (
                  <Ajuste key={id} rotulo={rotulo} valor={rascunho.corpo[id]} aoMudar={(valor) => mudar({ corpo: { ...rascunho.corpo, [id]: valor } })} />
                ))}
                {corDa("pele", "Pele")}
              </TabsContent>

              <TabsContent value="rosto" className="flex flex-col gap-6">
                <GrupoDeOpcoes titulo="Expressão" opcoes={EXPRESSOES} valor={rascunho.expressao} aoEscolher={(expressao) => mudar({ expressao })} />
                {corDa("olhos", "Olhos")}
              </TabsContent>

              <TabsContent value="cabelo" className="flex flex-col gap-6">
                {corDa("cabelo", "Cor do cabelo")}
              </TabsContent>

              <TabsContent value="roupa" className="flex flex-col gap-6">
                {PECAS.length > 0 && (
                  <GrupoDeOpcoes
                    titulo="Peças extras"
                    opcoes={[{ id: "nenhuma", rotulo: "Nenhuma" }, ...PECAS]}
                    valor={rascunho.pecas[0] ?? "nenhuma"}
                    aoEscolher={(id) => mudar({ pecas: id === "nenhuma" ? [] : [id] })}
                  />
                )}
                {corDa("roupa", "Roupa")}
                {corDa("calca", "Calça")}
                {corDa("calcados", "Calçados")}
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
