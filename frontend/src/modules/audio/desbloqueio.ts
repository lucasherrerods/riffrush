import { obterContextoDeAudio } from "./contexto";

const EVENTOS = ["pointerdown", "touchend", "keydown"] as const;

/**
 * O Safari do iPhone só deixa tocar som se o áudio for liberado dentro de um toque.
 * No primeiro toque, cria o contexto e toca um som mudo; depois disso a música pode
 * começar a qualquer momento, até pela largada que chega da rede.
 */
export function desbloquearNoPrimeiroToque() {
  const desbloquear = () => {
    for (const evento of EVENTOS) window.removeEventListener(evento, desbloquear, true);
    const contexto = obterContextoDeAudio();
    const fonte = contexto.createBufferSource();
    fonte.buffer = contexto.createBuffer(1, 1, 22050);
    fonte.connect(contexto.destination);
    fonte.start(0);
  };
  for (const evento of EVENTOS) window.addEventListener(evento, desbloquear, true);
}
