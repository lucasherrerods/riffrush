import type { PreferenciasDeAudio } from "@/modules/audio";
import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { LinhaDeSlider } from "./LinhaDeSlider";

interface Props {
  valores: PreferenciasDeAudio;
  aoMudar: (parcial: Partial<PreferenciasDeAudio>) => void;
}

const porcentagem = (valor: number) => `${Math.round(valor * 100)}%`;

const VOLUMES: { chave: keyof PreferenciasDeAudio; rotulo: string }[] = [
  { chave: "volumeGeral", rotulo: "Volume geral" },
  { chave: "volumeDaMusica", rotulo: "Volume da música" },
  { chave: "volumeDosEfeitos", rotulo: "Volume dos efeitos" },
];

/** Os volumes do app, os mesmos nos dois modos. */
export function AbaDeAudio({ valores, aoMudar }: Props) {
  const estreita = useTelaEstreita();
  return VOLUMES.map(({ chave, rotulo }) => (
    <div key={chave} className="contents">
      <LinhaDeSlider rotulo={rotulo} valor={valores[chave]} minimo={0} maximo={1} passo={0.05} formatar={porcentagem} aoMudar={(valor) => aoMudar({ [chave]: valor })} />
      {chave === "volumeGeral" && !estreita && <p className="px-2 text-base text-texto-suave">Em qualquer tela: Alt + roda do mouse.</p>}
    </div>
  ));
}
