import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Avatar } from "./Avatar";
import { CardDePersonagem } from "./CardDePersonagem";
import { INSTRUMENTOS, PERSONAGENS, cardDoPersonagem, definicaoDoPersonagem, instrumentoDoPersonagem } from "./catalogo";
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
  const card = cardDoPersonagem(definicao, rascunho.skin);
  const legenda = `${definicao.rotulo} · ${INSTRUMENTOS.find((i) => i.id === instrumento)?.rotulo}`;
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
        {card ? (
          // Splash da escolha: a arte grande e, por cima, o personagem tocando.
          <section className="relative col-span-5 min-h-0 overflow-hidden rounded-xl border border-borda max-md:h-[40vh]">
            <img src={card} alt={`Arte de ${definicao.rotulo}`} className="absolute inset-0 size-full object-cover object-top" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-fundo via-fundo/80 to-transparent p-6 pt-24 max-md:p-3 max-md:pt-16">
              <div>
                <p className="font-titulo text-4xl uppercase max-md:text-xl max-md:leading-tight">{nomeNaTela || "Sem nome"}</p>
                <p className="text-base text-texto-suave max-md:text-sm">{legenda}</p>
              </div>
              <Avatar personagem={rascunho} tocando pulso={pulso} className="h-40 w-auto shrink-0 max-md:h-24" />
            </div>
          </section>
        ) : (
          <section className="col-span-5 flex min-h-0 flex-col items-center justify-center gap-2 placa p-6 max-md:gap-0 max-md:p-2">
            <Avatar personagem={rascunho} tocando pulso={pulso} className="h-[min(60vh,480px)] w-auto max-md:h-[24vh]" />
            <p className="font-titulo text-3xl uppercase max-md:text-lg max-md:leading-tight">{nomeNaTela || "Sem nome"}</p>
            <p className="text-base text-texto-suave max-md:text-sm">{legenda}</p>
          </section>
        )}

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

          <div>
            <p className="mb-1.5 text-sm font-semibold text-texto-suave">Personagens</p>
            <div role="radiogroup" aria-label="Personagens" className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
              {PERSONAGENS.map((p) => (
                <CardDePersonagem
                  key={p.id}
                  rotulo={p.rotulo}
                  card={cardDoPersonagem(p, p.id === definicao.id ? rascunho.skin : undefined)}
                  escolhido={p.id === definicao.id}
                  aoEscolher={() => mudar({ personagem: p.id, skin: p.skins[0].id })}
                />
              ))}
            </div>
          </div>
          <GrupoDeOpcoes titulo="Skin" opcoes={definicao.skins} valor={rascunho.skin} aoEscolher={(skin) => mudar({ skin })} />
        </section>
      </div>
    </div>
  );
}
