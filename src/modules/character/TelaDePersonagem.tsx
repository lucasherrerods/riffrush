import { useEffect, useState } from "react";
import { ArrowLeft, Check, Dices } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Chibi } from "./Chibi";
import { GrupoDeOpcoes } from "./componentes/GrupoDeOpcoes";
import {
  ACESSORIOS,
  CABELOS,
  CORES_DE_CABELO,
  CORES_DE_ROUPA,
  INSTRUMENTOS,
  OLHOS,
  TONS_DE_PELE,
  personagemAleatorio,
  type Personagem,
} from "./personagem";

interface Props {
  personagem: Personagem;
  aoSalvar: (personagem: Personagem) => void;
  aoVoltar: () => void;
}

const comoCores = (cores: string[], nome: string) => cores.map((cor, i) => ({ id: cor, rotulo: `${nome} ${i + 1}`, cor }));
const INTERVALO_DA_PALHETADA = 500;

export function TelaDePersonagem({ personagem, aoSalvar, aoVoltar }: Props) {
  const [rascunho, setRascunho] = useState(personagem);
  const [pulso, setPulso] = useState(0);
  const mudar = (parcial: Partial<Personagem>) => setRascunho((atual) => ({ ...atual, ...parcial }));
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
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] font-black tracking-[-0.02em]">Seu personagem</h1>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setRascunho(personagemAleatorio(rascunho.nome))}>
          <Dices className="opacity-70" /> Aleatório
        </Button>
        <Button disabled={!nomeValido} onClick={() => aoSalvar({ ...rascunho, nome: rascunho.nome.trim() })}>
          <Check className="opacity-70" /> Salvar
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:grid-cols-1 max-md:overflow-y-auto">
        <section className="col-span-5 flex flex-col items-center justify-center gap-2 rounded-3xl border border-borda bg-superficie p-6">
          <Chibi personagem={rascunho} tocando pulso={pulso} className="h-[min(56vh,400px)] w-auto" />
          <p className="text-2xl font-black">{rascunho.nome.trim() || "Sem nome"}</p>
          <p className="text-base text-texto-suave">{INSTRUMENTOS.find((i) => i.id === rascunho.instrumento)?.rotulo}</p>
        </section>

        <section className="col-span-7 flex min-h-0 flex-col gap-6 overflow-y-auto rounded-3xl border border-borda bg-superficie p-6">
          <div>
            <Label htmlFor="nome-do-personagem" className="mb-2 text-base font-semibold text-texto-suave">
              Nome
            </Label>
            <Input
              id="nome-do-personagem"
              value={rascunho.nome}
              maxLength={16}
              onChange={(e) => mudar({ nome: e.target.value })}
              className="max-w-xs text-base"
            />
          </div>
          <GrupoDeOpcoes titulo="Instrumento" opcoes={INSTRUMENTOS} valor={rascunho.instrumento} aoEscolher={(instrumento) => mudar({ instrumento })} />
          <GrupoDeOpcoes titulo="Pele" opcoes={comoCores(TONS_DE_PELE, "Pele")} valor={rascunho.pele} aoEscolher={(pele) => mudar({ pele })} />
          <GrupoDeOpcoes titulo="Cabelo" opcoes={CABELOS} valor={rascunho.cabelo} aoEscolher={(cabelo) => mudar({ cabelo })} />
          <GrupoDeOpcoes
            titulo="Cor do cabelo"
            opcoes={comoCores(CORES_DE_CABELO, "Cor do cabelo")}
            valor={rascunho.corDoCabelo}
            aoEscolher={(corDoCabelo) => mudar({ corDoCabelo })}
          />
          <GrupoDeOpcoes titulo="Olhos" opcoes={OLHOS} valor={rascunho.olhos} aoEscolher={(olhos) => mudar({ olhos })} />
          <GrupoDeOpcoes titulo="Roupa" opcoes={comoCores(CORES_DE_ROUPA, "Roupa")} valor={rascunho.roupa} aoEscolher={(roupa) => mudar({ roupa })} />
          <GrupoDeOpcoes titulo="Acessório" opcoes={ACESSORIOS} valor={rascunho.acessorio} aoEscolher={(acessorio) => mudar({ acessorio })} />
        </section>
      </div>
    </div>
  );
}
