/** A precisão (0 a 1) com duas casas, igual nos dois modos: "98,76%". */
export const comoPorcentagem = (precisao: number) => `${(precisao * 100).toFixed(2).replace(".", ",")}%`;

/** Cor da precisão (0 a 1): verde acima de 95%, ouro acima de 80%, vermelho abaixo. */
export const corDaPrecisao = (precisao: number) => (precisao >= 0.95 ? "text-sucesso" : precisao >= 0.8 ? "text-ouro" : "text-perigo");
