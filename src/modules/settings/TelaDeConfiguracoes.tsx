import { useEffect, useState } from "react";
import { ArrowLeft, Gamepad2, Keyboard, Monitor, RotateCcw, Volume2 } from "lucide-react";
import { CORES_DAS_PISTAS, COR_DA_ESTRELA, NOMES_DAS_PISTAS } from "@/modules/gameplay";
import { definirTelaCheia, estaEmTelaCheia } from "@/modules/platform";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Calibracao } from "./componentes/Calibracao";
import { LinhaDeOpcao } from "./componentes/LinhaDeOpcao";
import { LinhaDeSlider } from "./componentes/LinhaDeSlider";
import { CONFIGURACOES_PADRAO, nomeDaTecla, trocarTecla, type Configuracoes } from "./configuracoes";

interface Props {
  configuracoes: Configuracoes;
  aoMudar: (configuracoes: Configuracoes) => void;
  aoVoltar: () => void;
}

const INDICE_DA_ESTRELA = 5;
const porcentagem = (valor: number) => `${Math.round(valor * 100)}%`;

export function TelaDeConfiguracoes({ configuracoes, aoMudar, aoVoltar }: Props) {
  /** Qual tecla está esperando a nova: 0 a 4 são os trastes, 5 é o star power. */
  const [trocando, setTrocando] = useState<number | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const mudar = (parcial: Partial<Configuracoes>) => aoMudar({ ...configuracoes, ...parcial });

  useEffect(() => {
    estaEmTelaCheia()
      .then(setTelaCheia)
      .catch(() => {});
  }, []);

  useTeclado((evento) => {
    if (trocando !== null) {
      evento.preventDefault();
      if (evento.code !== "Escape") aoMudar(trocarTecla(configuracoes, trocando, evento.code));
      setTrocando(null);
    } else if (evento.code === "Escape") {
      aoVoltar();
    }
  });

  const alternarTelaCheia = async (ligada: boolean) => {
    setTelaCheia(ligada);
    await definirTelaCheia(ligada).catch(() => setTelaCheia(!ligada));
  };

  const botaoDeTecla = (indice: number, nome: string, codigo: string, cor: string) => (
    <button
      aria-label={`Tecla ${nome}`}
      onClick={() => setTrocando(indice)}
      className="min-w-28 rounded-lg border-2 bg-superficie px-4 py-2 font-mono text-base font-bold transition-colors hover:bg-superficie-elevada"
      style={{ borderColor: trocando === indice ? "var(--cor-texto)" : cor }}
    >
      {trocando === indice ? "Aperte..." : nomeDaTecla(codigo)}
    </button>
  );

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] font-black tracking-[-0.02em]">Configurações</h1>
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => aoMudar(CONFIGURACOES_PADRAO)}>
          <RotateCcw className="opacity-70" /> Restaurar padrão
        </Button>
      </header>

      <Tabs defaultValue="controles" className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="controles">
            <Keyboard className="opacity-70" /> Controles
          </TabsTrigger>
          <TabsTrigger value="gameplay">
            <Gamepad2 className="opacity-70" /> Gameplay
          </TabsTrigger>
          <TabsTrigger value="audio">
            <Volume2 className="opacity-70" /> Áudio
          </TabsTrigger>
          <TabsTrigger value="video">
            <Monitor className="opacity-70" /> Vídeo
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-3xl border border-borda bg-superficie p-4">
          <TabsContent value="controles" className="flex flex-col gap-2">
            <p className="px-4 py-2 text-base text-texto-suave">Clique numa tecla e aperte a nova. Esc cancela.</p>
            {NOMES_DAS_PISTAS.map((nome, i) => (
              <LinhaDeOpcao key={nome} rotulo={`Traste ${nome}`}>
                {botaoDeTecla(i, `do traste ${nome}`, configuracoes.teclas[i], CORES_DAS_PISTAS[i])}
              </LinhaDeOpcao>
            ))}
            <LinhaDeOpcao rotulo="Star Power" dica="Ativa o bônus quando a barra passa da metade">
              {botaoDeTecla(INDICE_DA_ESTRELA, "do star power", configuracoes.teclaDaEstrela, COR_DA_ESTRELA)}
            </LinhaDeOpcao>
          </TabsContent>

          <TabsContent value="gameplay" className="flex flex-col gap-2">
            <LinhaDeSlider
              rotulo="Velocidade das notas"
              dica="Quanto maior, mais rápido as notas descem"
              valor={configuracoes.velocidade}
              minimo={1}
              maximo={10}
              passo={1}
              formatar={String}
              aoMudar={(velocidade) => mudar({ velocidade })}
            />
            <LinhaDeSlider
              rotulo="Atraso do áudio"
              dica="Ajuste se as notas parecerem fora do ritmo da música"
              valor={configuracoes.atrasoMs}
              minimo={-200}
              maximo={200}
              passo={5}
              formatar={(v) => `${v > 0 ? "+" : ""}${v} ms`}
              aoMudar={(atrasoMs) => mudar({ atrasoMs })}
            />
            <Calibracao aoMedir={(atrasoMs) => mudar({ atrasoMs })} />
            <LinhaDeOpcao rotulo="Modo sem falha" dica="O medidor de rock nunca tira você da música" para="sem-falha">
              <Switch id="sem-falha" checked={configuracoes.semFalha} onCheckedChange={(semFalha) => mudar({ semFalha })} />
            </LinhaDeOpcao>
            <LinhaDeOpcao rotulo="Bot" dica="O jogo toca sozinho. Recordes não são salvos" para="bot">
              <Switch id="bot" checked={configuracoes.bot} onCheckedChange={(bot) => mudar({ bot })} />
            </LinhaDeOpcao>
          </TabsContent>

          <TabsContent value="audio" className="flex flex-col gap-2">
            <LinhaDeSlider
              rotulo="Volume da música"
              valor={configuracoes.volumeDaMusica}
              minimo={0}
              maximo={1}
              passo={0.05}
              formatar={porcentagem}
              aoMudar={(volumeDaMusica) => mudar({ volumeDaMusica })}
            />
            <LinhaDeSlider
              rotulo="Volume dos efeitos"
              valor={configuracoes.volumeDosEfeitos}
              minimo={0}
              maximo={1}
              passo={0.05}
              formatar={porcentagem}
              aoMudar={(volumeDosEfeitos) => mudar({ volumeDosEfeitos })}
            />
          </TabsContent>

          <TabsContent value="video" className="flex flex-col gap-2">
            <LinhaDeOpcao rotulo="Tela cheia" dica="Atalho: F11" para="tela-cheia">
              <Switch id="tela-cheia" checked={telaCheia} onCheckedChange={(ligada) => void alternarTelaCheia(ligada)} />
            </LinhaDeOpcao>
            <LinhaDeOpcao rotulo="Efeitos de brilho" dica="Desligue se o jogo estiver travando" para="efeitos">
              <Switch id="efeitos" checked={configuracoes.efeitos} onCheckedChange={(efeitos) => mudar({ efeitos })} />
            </LinhaDeOpcao>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
