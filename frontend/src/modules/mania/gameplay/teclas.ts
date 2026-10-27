/** Os layouts de costume do mania, por número de teclas (KeyboardEvent.code), da coluna da esquerda para a direita. */
const PADRAO: Record<number, string[]> = {
  1: ["Space"],
  2: ["KeyF", "KeyJ"],
  3: ["KeyF", "Space", "KeyJ"],
  4: ["KeyD", "KeyF", "KeyJ", "KeyK"],
  5: ["KeyD", "KeyF", "Space", "KeyJ", "KeyK"],
  6: ["KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL"],
  7: ["KeyS", "KeyD", "KeyF", "Space", "KeyJ", "KeyK", "KeyL"],
  8: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL", "Semicolon"],
  9: ["KeyA", "KeyS", "KeyD", "KeyF", "Space", "KeyJ", "KeyK", "KeyL", "Semicolon"],
  10: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyV", "KeyN", "KeyJ", "KeyK", "KeyL", "Semicolon"],
};

/** Mapas de dupla (11K a 18K): metade das colunas para cada mão, nas duas fileiras de cima. */
const MAO_ESQUERDA = ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyA", "KeyS", "KeyD", "KeyF", "KeyV"];
const MAO_DIREITA = ["KeyN", "KeyJ", "KeyK", "KeyL", "Semicolon", "KeyU", "KeyI", "KeyO", "KeyP"];

export function teclasDoMapa(teclas: number, personalizadas: Record<number, string[]> = {}): string[] {
  const doJogador = personalizadas[teclas];
  if (doJogador?.length === teclas && new Set(doJogador).size === teclas) return doJogador;
  if (PADRAO[teclas]) return PADRAO[teclas];
  const esquerda = Math.ceil(teclas / 2);
  return [...MAO_ESQUERDA.slice(0, esquerda), ...MAO_DIREITA.slice(0, teclas - esquerda)];
}

export const colunaDaTecla = (teclas: string[], codigo: string) => teclas.indexOf(codigo);
