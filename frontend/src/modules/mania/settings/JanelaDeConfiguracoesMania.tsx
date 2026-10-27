import { useEffect, useState } from "react";
import { nomeDaTecla } from "@/modules/settings";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import type { OpcoesDoMania } from "../gameplay/TelaDeJogoMania";
import { teclasDoMapa } from "../gameplay/teclas";
import { LIMITES, trocarTecla } from "./configuracoesMania";

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  opcoes: OpcoesDoMania;
  aoMudar: (opcoes: OpcoesDoMania) => void;
}

const NUMEROS_DE_TECLAS = [4, 5, 6, 7, 8, 9, 10];

function Faixa({ rotulo, valor, sufixo, min, max, passo, aoMudar }: { rotulo: string; valor: number; sufixo: string; min: number; max: number; passo: number; aoMudar: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-sm text-texto-suave">
        {rotulo}
        <span className="text-texto">
          {valor}
          {sufixo}
        </span>
      </span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => aoMudar(Number(e.target.value))} className="accent-primaria" />
    </label>
  );
}

export function JanelaDeConfiguracoesMania({ aberta, aoFechar, opcoes, aoMudar }: Props) {
  const [teclas, setTeclas] = useState(4);
  const [esperando, setEsperando] = useState<number | null>(null);
  const atuais = teclasDoMapa(teclas, opcoes.teclasPersonalizadas);

  useEffect(() => {
    if (esperando === null) return;
    const aoApertar = (evento: KeyboardEvent) => {
      evento.preventDefault();
      evento.stopPropagation();
      if (evento.code !== "Escape") aoMudar({ ...opcoes, teclasPersonalizadas: { ...opcoes.teclasPersonalizadas, [teclas]: trocarTecla(atuais, esperando, evento.code) } });
      setEsperando(null);
    };
    window.addEventListener("keydown", aoApertar, { capture: true });
    return () => window.removeEventListener("keydown", aoApertar, { capture: true });
  }, [esperando, teclas, atuais, opcoes, aoMudar]);

  return (
    <Dialog open={aberta} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="flex max-w-lg flex-col gap-5">
        <DialogTitle>Configurações do Mania</DialogTitle>
        <DialogDescription>Valem só para o Mania. Volume geral e conta ficam nas configurações do app.</DialogDescription>
        <Faixa
          rotulo="Velocidade de rolagem (tempo da nota na tela)"
          valor={opcoes.rolagemMs}
          sufixo=" ms"
          min={LIMITES.rolagemMs.minimo}
          max={LIMITES.rolagemMs.maximo}
          passo={LIMITES.rolagemMs.passo}
          aoMudar={(rolagemMs) => aoMudar({ ...opcoes, rolagemMs })}
        />
        <Faixa
          rotulo="Atraso do áudio"
          valor={opcoes.atrasoMs}
          sufixo=" ms"
          min={LIMITES.atrasoMs.minimo}
          max={LIMITES.atrasoMs.maximo}
          passo={LIMITES.atrasoMs.passo}
          aoMudar={(atrasoMs) => aoMudar({ ...opcoes, atrasoMs })}
        />
        <Faixa
          rotulo="Volume da música"
          valor={Math.round(opcoes.volumeDaMusica * 100)}
          sufixo="%"
          min={0}
          max={100}
          passo={5}
          aoMudar={(v) => aoMudar({ ...opcoes, volumeDaMusica: v / 100 })}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm text-texto-suave">Teclas</span>
          <div role="radiogroup" aria-label="Número de teclas" className="flex flex-wrap gap-2">
            {NUMEROS_DE_TECLAS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={k === teclas}
                onClick={() => {
                  setTeclas(k);
                  setEsperando(null);
                }}
                className={cn("rounded-md border px-3 py-1 text-sm", k === teclas ? "border-primaria bg-primaria text-texto" : "border-borda bg-superficie-elevada text-texto-suave")}
              >
                {k}K
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {atuais.map((codigo, coluna) => (
              <button
                key={coluna}
                type="button"
                aria-label={`Coluna ${coluna + 1}: ${esperando === coluna ? "aperte uma tecla" : nomeDaTecla(codigo)}`}
                onClick={() => setEsperando(coluna)}
                className={cn("min-w-12 rounded-md border px-2 py-2 font-titulo text-lg", esperando === coluna ? "border-primaria" : "border-borda bg-superficie-elevada")}
              >
                {esperando === coluna ? "…" : nomeDaTecla(codigo)}
              </button>
            ))}
          </div>
          {opcoes.teclasPersonalizadas[teclas] && (
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => {
                const { [teclas]: _, ...resto } = opcoes.teclasPersonalizadas;
                aoMudar({ ...opcoes, teclasPersonalizadas: resto });
              }}
            >
              Voltar ao padrão de {teclas}K
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
