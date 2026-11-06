import { projetar, type LayoutDaPista } from "./geometria";

export interface FaixaDaHighway {
  x: number;
  y: number;
  largura: number;
  altura: number;
  /** Linha da imagem onde a faixa começa e quantas linhas ela pega. */
  origem: number;
  alturaDaOrigem: number;
}

/**
 * O canvas 2D não faz perspectiva, então a imagem da highway é desenhada em faixas horizontais.
 * Como no Clone Hero, a imagem é esticada na largura do braço, cobre o braço inteiro e se repete correndo junto com as notas.
 */
export function faixasDaHighway(layout: LayoutDaPista, tempo: number, antecedencia: number, alturaDaImagem: number, inicio: number, quantas: number): FaixaDaHighway[] {
  const deslocamento = tempo / antecedencia;
  const naImagem = (distancia: number) => {
    const v = (distancia + deslocamento) % 1;
    return v < 0 ? v + 1 : v;
  };
  const faixas: FaixaDaHighway[] = [];
  for (let i = 0; i < quantas; i++) {
    const d0 = inicio + ((1 - inicio) * i) / quantas;
    const d1 = inicio + ((1 - inicio) * (i + 1)) / quantas;
    const perto = projetar(layout, d0);
    const longe = projetar(layout, d1);
    const v0 = naImagem(d0);
    // Na emenda da repetição a faixa termina no fim da imagem, em vez de pegar a imagem inteira de trás para frente.
    const fim = naImagem(d1);
    const v1 = fim < v0 ? 1 : fim;
    const largura = layout.largura * perto.escala;
    faixas.push({
      x: layout.centro - largura / 2,
      y: longe.y,
      largura,
      altura: perto.y - longe.y,
      origem: (1 - v1) * alturaDaImagem,
      alturaDaOrigem: (v1 - v0) * alturaDaImagem,
    });
  }
  return faixas;
}
