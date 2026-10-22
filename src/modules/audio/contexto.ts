let contexto: AudioContext | null = null;

/** O jogo inteiro usa um único AudioContext. O navegador só deixa tocar som depois de um clique, por isso o resume. */
export function obterContextoDeAudio() {
  contexto ??= new AudioContext({ latencyHint: "interactive" });
  if (contexto.state === "suspended") void contexto.resume();
  return contexto;
}
