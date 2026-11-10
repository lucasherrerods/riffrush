import { useState } from "react";
import { Gamepad2, Keyboard, RotateCcw, Volume2 } from "lucide-react";
import { mudarPreferenciasDeAudio, usePreferenciasDeAudio } from "@/modules/audio";
import { AbaDeAudio, BotaoDeTecla, LinhaDeOpcao, LinhaDeSlider, MolduraDeConfiguracoes, nomeDaTecla } from "@/modules/settings";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { teclasDoMapa } from "../gameplay/teclas";
import { LIMITES, trocarTecla, type ConfiguracoesDoMania } from "./configuracoesMania";

interface Props {
  opcoes: ConfiguracoesDoMania;
  aoMudar: (opcoes: ConfiguracoesDoMania) => void;
  aoVoltar: () => void;
}

const NUMEROS_DE_TECLAS = [4, 5, 6, 7, 8, 9, 10];

/** As configurações do Mania, na mesma tela do Rock: teclas e gameplay são do Mania, o áudio é o global. */
export function TelaDeConfiguracoesMania({ opcoes, aoMudar, aoVoltar }: Props) {
  const audio = usePreferenciasDeAudio();
  const [teclas, setTeclas] = useState(4);
  const [esperando, setEsperando] = useState<number | null>(null);
  const atuais = teclasDoMapa(teclas, opcoes.teclasPersonalizadas);

  useTeclado((evento) => {
    if (esperando === null) {
      if (evento.code === "Escape") aoVoltar();
      return;
    }
    evento.preventDefault();
    if (evento.code !== "Escape") aoMudar({ ...opcoes, teclasPersonalizadas: { ...opcoes.teclasPersonalizadas, [teclas]: trocarTecla(atuais, esperando, evento.code) } });
    setEsperando(null);
  });

  const controles = (
    <>
      <p className="px-4 py-2 text-base text-texto-suave max-md:px-2 max-md:py-1 max-md:text-sm">Clique numa coluna e aperte a nova tecla. Esc cancela.</p>
      <div className="flex items-end justify-between gap-4 px-4 pb-2 max-md:px-2">
        <GrupoDeOpcoes
          titulo="Número de teclas"
          opcoes={NUMEROS_DE_TECLAS.map((k) => ({ id: String(k), rotulo: `${k}K` }))}
          valor={String(teclas)}
          aoEscolher={(k) => {
            setTeclas(Number(k));
            setEsperando(null);
          }}
        />
        {opcoes.teclasPersonalizadas[teclas] && (
          <Button
            variant="ghost"
            onClick={() => {
              const { [teclas]: _, ...resto } = opcoes.teclasPersonalizadas;
              aoMudar({ ...opcoes, teclasPersonalizadas: resto });
            }}
          >
            <RotateCcw className="opacity-70" /> Voltar ao padrão de {teclas}K
          </Button>
        )}
      </div>
      {atuais.map((codigo, coluna) => (
        <LinhaDeOpcao key={coluna} rotulo={`Coluna ${coluna + 1}`}>
          <BotaoDeTecla
            rotulo={`Coluna ${coluna + 1}: ${esperando === coluna ? "aperte uma tecla" : nomeDaTecla(codigo)}`}
            texto={nomeDaTecla(codigo)}
            esperando={esperando === coluna}
            aoClicar={() => setEsperando(coluna)}
          />
        </LinhaDeOpcao>
      ))}
    </>
  );

  const gameplay = (
    <>
      <LinhaDeSlider
        rotulo="Velocidade de rolagem"
        dica="Quanto tempo a nota fica na tela"
        valor={opcoes.rolagemMs}
        minimo={LIMITES.rolagemMs.minimo}
        maximo={LIMITES.rolagemMs.maximo}
        passo={LIMITES.rolagemMs.passo}
        formatar={(v) => `${v} ms`}
        aoMudar={(rolagemMs) => aoMudar({ ...opcoes, rolagemMs })}
      />
      <LinhaDeSlider
        rotulo="Atraso do áudio"
        dica="Ajuste se as notas parecerem fora do ritmo da música"
        valor={opcoes.atrasoMs}
        minimo={LIMITES.atrasoMs.minimo}
        maximo={LIMITES.atrasoMs.maximo}
        passo={LIMITES.atrasoMs.passo}
        formatar={(v) => `${v > 0 ? "+" : ""}${v} ms`}
        aoMudar={(atrasoMs) => aoMudar({ ...opcoes, atrasoMs })}
      />
    </>
  );

  return (
    <MolduraDeConfiguracoes
      aoVoltar={aoVoltar}
      abas={[
        { id: "controles", rotulo: "Controles", icone: Keyboard, conteudo: controles },
        { id: "gameplay", rotulo: "Gameplay", icone: Gamepad2, conteudo: gameplay },
        { id: "audio", rotulo: "Áudio", icone: Volume2, conteudo: <AbaDeAudio valores={audio} aoMudar={mudarPreferenciasDeAudio} /> },
      ]}
    />
  );
}
