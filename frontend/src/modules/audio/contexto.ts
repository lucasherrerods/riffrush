let contexto: AudioContext | null = null;
let pausadoPelaPartida = false;

/** O jogo inteiro usa um único AudioContext. O navegador só deixa tocar som depois de um clique, por isso o resume. */
export function obterContextoDeAudio() {
  contexto ??= new AudioContext({ latencyHint: "interactive" });
  // Na pausa da partida o relógio é o áudio: religar aqui fazia as notas passarem com o menu aberto.
  if (contexto.state === "suspended" && !pausadoPelaPartida) void contexto.resume();
  return contexto;
}

/** Para o áudio na pausa da partida, até `retomarAudio`. */
export function pausarAudio() {
  pausadoPelaPartida = true;
  void obterContextoDeAudio().suspend();
}

export function retomarAudio() {
  pausadoPelaPartida = false;
  void obterContextoDeAudio().resume();
}
