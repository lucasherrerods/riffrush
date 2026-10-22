import type { Acessorio, Barba, Cabelo, Instrumento, Roupa } from "./catalogo";
import { migrarPersonagem, type Personagem } from "./personagem";

/** Medidas em metros do corpo montado. */
export interface Medidas {
  altura: number;
  cabeca: number;
  pescoco: number;
  tronco: number;
  perna: number;
  braco: number;
  /** Meia largura dos ombros e do quadril. */
  ombros: number;
  quadril: number;
  /** Raio médio dos membros. */
  espessura: number;
}

export interface Montagem {
  medidas: Medidas;
  rosto: { mandibula: number; olhos: number; sobrancelhas: number };
  pecas: { cabelo: Cabelo; barba: Barba | null; roupa: Roupa; acessorio: Acessorio | null; instrumento: Instrumento };
  cores: Personagem["cores"];
}

/** Proporção do estilo DQXI: herói estilizado com cerca de 7 cabeças de altura. */
const CABECAS_DE_ALTURA = 7;
const entre = (minimo: number, maximo: number, t: number) => minimo + (maximo - minimo) * t;

/** Transforma os dados do personagem nas medidas e peças que o render 3D desenha. */
export function montarPersonagem(dado: Personagem): Montagem {
  const p = migrarPersonagem(dado);
  const altura = entre(1.62, 1.92, p.corpo.altura);
  const cabeca = altura / CABECAS_DE_ALTURA;
  const pescoco = cabeca * 0.3;
  const perna = altura * 0.47;
  const tronco = altura - perna - pescoco - cabeca;
  const quadril = cabeca * entre(0.62, 0.78, p.corpo.porte);
  return {
    medidas: {
      altura,
      cabeca,
      pescoco,
      tronco,
      perna,
      braco: altura * 0.36,
      ombros: quadril + cabeca * entre(0.18, 0.5, p.corpo.ombros),
      quadril,
      espessura: altura * entre(0.026, 0.038, p.corpo.porte),
    },
    rosto: {
      mandibula: entre(0.85, 1.15, p.rosto.mandibula),
      olhos: entre(0.8, 1.2, p.rosto.olhos),
      sobrancelhas: entre(0.6, 1.4, p.rosto.sobrancelhas),
    },
    pecas: {
      cabelo: p.cabelo,
      barba: p.barba === "nenhuma" ? null : p.barba,
      roupa: p.roupa,
      acessorio: p.acessorio === "nenhum" ? null : p.acessorio,
      instrumento: p.instrumento,
    },
    cores: p.cores,
  };
}
