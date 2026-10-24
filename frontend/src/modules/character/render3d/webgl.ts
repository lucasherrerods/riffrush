/** Fica fora do renderizador para checar o WebGL sem carregar o three.js. */
export function suportaWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
