import { useEffect, useRef, useState } from "react";
import { Gamepad2, Keyboard, Play, TriangleAlert, X } from "lucide-react";
import { indiceDoControle } from "@/modules/gamepad";
import { Button } from "@/shared/ui/button";
import { MAXIMO_DE_JOGADORES, avisoDeRollover, dispositivoDaTecla, entrar, mesmoDispositivo, sair, type DispositivoDoJogador } from "./dispositivos";

interface Props {
  aoComecar: (jogadores: DispositivoDoJogador[]) => void;
  aoVoltar: () => void;
}

const MINIMO_DE_JOGADORES = 2;

const nomeDoDispositivo = (dispositivo: DispositivoDoJogador) =>
  dispositivo.tipo === "controle" ? `Controle ${dispositivo.indice + 1}` : dispositivo.lado === "esquerda" ? "Teclado · lado esquerdo (A S D F G)" : "Teclado · lado direito (H J K L Ç)";

/** Antes da tela dividida: cada jogador entra apertando o próprio teclado ou controle. */
export function EscolhaDeDispositivos({ aoComecar, aoVoltar }: Props) {
  const [jogadores, setJogadores] = useState<DispositivoDoJogador[]>([]);
  const atuais = useRef({ jogadores, aoComecar, aoVoltar });
  atuais.current = { jogadores, aoComecar, aoVoltar };
  const podeComecar = jogadores.length >= MINIMO_DE_JOGADORES;

  useEffect(() => {
    const aoApertar = (evento: KeyboardEvent) => {
      const { jogadores, aoComecar, aoVoltar } = atuais.current;
      if (evento.code === "Escape") return aoVoltar();
      const dispositivo = dispositivoDaTecla(evento);
      const jaEntrou = dispositivo && jogadores.some((j) => mesmoDispositivo(j, dispositivo));
      // O Enter do teclado, ou o A de quem já entrou, começa a partida.
      const confirmou = evento.code === "Enter" && (indiceDoControle(evento) === undefined || jaEntrou);
      // Tratada aqui: o A do controle não aperta também o botão em foco.
      if (confirmou || dispositivo) evento.preventDefault();
      if (confirmou) {
        if (jogadores.length >= MINIMO_DE_JOGADORES) aoComecar(jogadores);
        return;
      }
      if (dispositivo) setJogadores((j) => entrar(j, dispositivo));
    };
    window.addEventListener("keydown", aoApertar);
    return () => window.removeEventListener("keydown", aoApertar);
  }, []);

  return (
    <div className="respiro-de-tela flex h-full flex-col items-center justify-center gap-6">
      <h1 className="titulo-de-tela">Tela dividida</h1>
      <p className="max-w-[70ch] text-center text-base text-texto-suave">Cada jogador aperta um traste do seu lado do teclado ou qualquer botão do seu controle.</p>

      <ul className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: MAXIMO_DE_JOGADORES }, (_, i) => {
          const jogador = jogadores[i];
          const Icone = jogador?.tipo === "controle" ? Gamepad2 : Keyboard;
          return (
            <li key={i} className="flex min-h-20 items-center gap-4 chapa px-4 py-4">
              <span className="font-titulo text-2xl tracking-wide">P{i + 1}</span>
              {jogador ? (
                <>
                  <Icone className="size-5 shrink-0 opacity-70" aria-hidden />
                  <span className="flex-1 text-base">{nomeDoDispositivo(jogador)}</span>
                  <Button variant="ghost" size="icon" aria-label={`Tirar o jogador ${i + 1}`} onClick={() => setJogadores((j) => sair(j, jogador))}>
                    <X />
                  </Button>
                </>
              ) : (
                <span className="flex-1 text-base text-texto-suave">Aperte um traste para entrar</span>
              )}
            </li>
          );
        })}
      </ul>

      {avisoDeRollover(jogadores) && (
        <p role="alert" className="flex max-w-[70ch] items-start gap-2 text-base text-ouro">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 opacity-70" aria-hidden />
          Teclados comuns só registram algumas teclas ao mesmo tempo. Com duas pessoas no mesmo teclado, acordes podem falhar; um controle resolve.
        </p>
      )}

      <div className="flex gap-4">
        <Button size="lg" variant="ghost" onClick={aoVoltar}>
          Voltar
        </Button>
        <Button size="lg" disabled={!podeComecar} onClick={() => aoComecar(jogadores)}>
          <Play className="opacity-70" /> Começar
        </Button>
      </div>
    </div>
  );
}
