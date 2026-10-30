import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Avatar } from "./Avatar";
import { INSTRUMENTOS, PERSONAGENS, definicaoDoPersonagem, instrumentoDoPersonagem } from "./catalogo";
import { migrarPersonagem, type Personagem } from "./personagem";

interface Props {
  personagem: Personagem;
  aoSalvar: (personagem: Personagem) => void;
  aoVoltar: () => void;
  /** Com a conta logada, o nome é o do Google e não pode ser trocado aqui. */
  nomeDaConta?: string;
}

const INTERVALO_DA_PALHETADA = 500;

export function TelaDePersonagem({ personagem, aoSalvar, aoVoltar, nomeDaConta }: Props) {
  const [rascunho, setRascunho] = useState(() => migrarPersonagem(personagem));
  const [pulso, setPulso] = useState(0);
  const mudar = (parcial: Partial<Personagem>) => setRascunho((atual) => ({ ...atual, ...parcial }));
  const definicao = definicaoDoPersonagem(rascunho);
  const instrumento = instrumentoDoPersonagem(rascunho);
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
        <Button disabled={!nomeValido} onClick={() => aoSalvar({ ...rascunho, nome: rascunho.nome.trim() })}>
          <Check className="opacity-70" /> Salvar
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:flex-none max-md:grid-cols-1 max-md:gap-2">
        <section className="col-span-5 flex min-h-0 flex-col items-center justify-center gap-2 placa p-6 max-md:gap-0 max-md:p-2">
          <Avatar personagem={rascunho} tocando pulso={pulso} className="h-[min(60vh,480px)] w-auto max-md:h-[24vh]" />
          <p className="font-titulo text-3xl uppercase max-md:text-lg max-md:leading-tight">{nomeNaTela || "Sem nome"}</p>
          <p className="text-base text-texto-suave max-md:text-sm">{definicao.rotulo} · {INSTRUMENTOS.find((i) => i.id === instrumento)?.rotulo}</p>
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

          <GrupoDeOpcoes
            titulo="Personagem"
            opcoes={PERSONAGENS}
            valor={definicao.id}
            aoEscolher={(personagem) => mudar({ personagem, skin: definicaoDoPersonagem({ personagem }).skins[0].id })}
          />
          <GrupoDeOpcoes titulo="Skin" opcoes={definicao.skins} valor={rascunho.skin} aoEscolher={(skin) => mudar({ skin })} />
        </section>
      </div>
    </div>
  );
}
