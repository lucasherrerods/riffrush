import { ehTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";
import { agoraNoAudio, momentoDoEvento, obterContextoDeAudio, saidaDeAudio } from "@/modules/audio";
import { Button } from "@/shared/ui/button";
import { BATIDAS_DA_CALIBRACAO, INTERVALO_DA_CALIBRACAO, batidasDaCalibracao, medirAtraso } from "../calibracao";
import { LinhaDeOpcao } from "./LinhaDeOpcao";

const ESPERA_ANTES_DE_COMECAR = 0.6;

function tocarClique(contexto: AudioContext, tempo: number, forte: boolean) {
  const oscilador = contexto.createOscillator();
  const ganho = contexto.createGain();
  oscilador.frequency.value = forte ? 1600 : 1000;
  ganho.gain.setValueAtTime(0.4, tempo);
  ganho.gain.exponentialRampToValueAtTime(0.001, tempo + 0.06);
  oscilador.connect(ganho).connect(saidaDeAudio());
  oscilador.start(tempo);
  oscilador.stop(tempo + 0.07);
}

/** Toca um metrônomo, registra os toques da pessoa e transforma a diferença em atraso. */
export function Calibracao({ aoMedir }: { aoMedir: (atrasoMs: number) => void }) {
  const [rodando, setRodando] = useState(false);
  const [batida, setBatida] = useState(0);
  const [ultimaMedida, setUltimaMedida] = useState<number | null>(null);

  useEffect(() => {
    if (!rodando) return;
    const contexto = obterContextoDeAudio();
    const batidas = batidasDaCalibracao(contexto.currentTime + ESPERA_ANTES_DE_COMECAR);
    batidas.forEach((tempo, i) => tocarClique(contexto, tempo, i % 4 === 0));
    const toques: number[] = [];

    const aoTocar = (evento: Event) => {
      if (evento instanceof KeyboardEvent) {
        if (evento.repeat || evento.code === "Escape") return;
        evento.preventDefault();
        evento.stopPropagation();
      }
      toques.push(momentoDoEvento(contexto, evento));
    };
    window.addEventListener("keydown", aoTocar, true);
    window.addEventListener("pointerdown", aoTocar);
    const contador = setInterval(() => {
      setBatida(Math.max(0, Math.floor((agoraNoAudio(contexto) - batidas[0]) / INTERVALO_DA_CALIBRACAO) + 1));
    }, 50);
    const fim = setTimeout(
      () => {
        setRodando(false);
        const medida = medirAtraso(batidas, toques);
        setUltimaMedida(medida);
        if (medida !== null) aoMedir(medida);
      },
      (ESPERA_ANTES_DE_COMECAR + BATIDAS_DA_CALIBRACAO * INTERVALO_DA_CALIBRACAO + 0.3) * 1000,
    );
    return () => {
      window.removeEventListener("keydown", aoTocar, true);
      window.removeEventListener("pointerdown", aoTocar);
      clearInterval(contador);
      clearTimeout(fim);
    };
    // aoMedir muda a cada render da tela; a calibração só reinicia quando `rodando` muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando]);

  const dica = rodando
    ? `${ehTelaEstreita() ? "Toque na tela" : "Aperte qualquer tecla"} junto com o clique. Batida ${Math.min(batida, BATIDAS_DA_CALIBRACAO)}/${BATIDAS_DA_CALIBRACAO}`
    : ultimaMedida !== null
      ? `Calibrado: ${ultimaMedida > 0 ? "+" : ""}${ultimaMedida} ms`
      : ehTelaEstreita() ? "Toca um metrônomo e mede o atraso do seu fone e da tela" : "Toca um metrônomo e mede o atraso do seu fone e teclado";

  return (
    <LinhaDeOpcao rotulo="Calibrar atraso" dica={dica}>
      {rodando ? (
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className={`size-3 rounded-full ${batida > 0 && (batida - 1) % 4 === i ? "bg-primaria" : "bg-borda"}`} />
          ))}
        </div>
      ) : (
        <Button variant="outline" onClick={() => setRodando(true)}>
          <Crosshair className="opacity-70" /> Calibrar
        </Button>
      )}
    </LinhaDeOpcao>
  );
}
