import { geradorAleatorio } from "@/shared/lib/aleatorio";
import { cores } from "@/modules/rock/tema";
import { comAlfa } from "@/shared/styles/tokens";
import { COR_DA_ESTRELA, COR_DA_NOTA_DE_ESTRELA } from "../cores";
import { SPRITE_DA_ABERTA, SPRITE_DA_NOTA, type Sprites } from "./desenhar";

const CONTORNO = comAlfa(cores.fundo, 0.9);
const TAMANHO_DO_BRILHO = 256;
const TAMANHO_DA_TEXTURA = 256;
const SEMENTE_DA_TEXTURA = 1987;

function comCanvas(largura: number, altura: number, desenhar: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  desenhar(canvas.getContext("2d")!);
  return canvas;
}

/**
 * Notas e brilhos são desenhados uma vez só e reaproveitados em todo frame.
 * O shadowBlur fica aqui, fora do loop, porque é o que mais pesa no canvas 2D.
 */
export function criarSprites(): Sprites {
  const cache = new Map<string, HTMLCanvasElement>();
  const lembrar = (chave: string, criar: () => HTMLCanvasElement) => {
    if (!cache.has(chave)) cache.set(chave, criar());
    return cache.get(chave)!;
  };

  /** As camadas que quase não mudam, uma por nome, com o que foi usado para desenhá-las. */
  const camadas = new Map<string, { canvas: HTMLCanvasElement; versao: number; largura: number; altura: number; escala: number }>();

  return {
    nota: (cor, estrela, brilho, tipo) =>
      lembrar(`nota:${cor}:${estrela}:${brilho}:${tipo ?? "comum"}`, () =>
        comCanvas(SPRITE_DA_NOTA.largura, SPRITE_DA_NOTA.altura, (c) => {
          // Uma pastilha vista de cima e de lado: parede escura, tampa colorida e a cúpula branca no meio.
          const x = SPRITE_DA_NOTA.largura / 2;
          const y = SPRITE_DA_NOTA.altura / 2 - 10;
          const rx = SPRITE_DA_NOTA.raio;
          const ry = rx * 0.5;
          // A HOPO é mais baixa, como no Clone Hero: parece mais leve que a nota de palheta.
          const altura = ry * (tipo === "hopo" ? 0.3 : 0.55);
          const corDaTampa = estrela ? COR_DA_NOTA_DE_ESTRELA : cor;

          c.beginPath();
          c.ellipse(x, y + altura + ry * 0.3, rx * 1.02, ry, 0, 0, Math.PI * 2);
          c.fillStyle = comAlfa(cores.fundo, 0.6);
          c.fill();

          // Parede: o retângulo entre a base e a tampa, fechado pelas meias-elipses.
          c.beginPath();
          c.ellipse(x, y + altura, rx, ry, 0, 0, Math.PI);
          c.lineTo(x - rx, y);
          c.ellipse(x, y, rx, ry, 0, Math.PI, 0, true);
          c.closePath();
          const metal = c.createLinearGradient(x - rx, 0, x + rx, 0);
          metal.addColorStop(0, cores.fundo);
          metal.addColorStop(0.3, cores.borda);
          metal.addColorStop(0.45, cores.textoSuave);
          metal.addColorStop(0.6, cores.borda);
          metal.addColorStop(1, cores.fundo);
          c.fillStyle = metal;
          c.fill();
          c.lineWidth = 3;
          c.strokeStyle = estrela ? COR_DA_ESTRELA : CONTORNO;
          c.stroke();

          // O tap é vazado: tampa escura com um anel grosso na cor do traste.
          const tampa = c.createRadialGradient(x, y - ry * 0.3, rx * 0.1, x, y, rx);
          tampa.addColorStop(0, comAlfa(cores.texto, tipo === "tap" ? 0.15 : 0.55));
          tampa.addColorStop(0.35, tipo === "tap" ? comAlfa(cores.fundo, 0.9) : corDaTampa);
          tampa.addColorStop(1, corDaTampa);
          c.beginPath();
          c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
          c.fillStyle = tampa;
          if (brilho) {
            c.shadowColor = estrela ? COR_DA_ESTRELA : cor;
            c.shadowBlur = estrela ? 22 : 10;
          }
          c.fill();
          c.shadowBlur = 0;
          c.lineWidth = 3;
          c.strokeStyle = estrela ? COR_DA_ESTRELA : CONTORNO;
          c.stroke();

          // A borda da tampa escurece, para a cor parecer pintura sobre metal e não plástico.
          const sombra = c.createRadialGradient(x, y, rx * 0.5, x, y, rx);
          sombra.addColorStop(0, comAlfa(cores.fundo, 0));
          sombra.addColorStop(1, comAlfa(cores.fundo, 0.55));
          c.beginPath();
          c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
          c.fillStyle = sombra;
          c.fill();

          if (tipo === "tap") {
            c.beginPath();
            c.ellipse(x, y - ry * 0.05, rx * 0.62, ry * 0.52, 0, 0, Math.PI * 2);
            c.lineWidth = 7;
            c.strokeStyle = corDaTampa;
            c.stroke();
            return;
          }

          // A HOPO tem a cúpula branca maior e acesa, a marca dela no Clone Hero.
          const hopo = tipo === "hopo";
          const cupula = c.createLinearGradient(0, y - ry * 0.55, 0, y + ry * 0.2);
          cupula.addColorStop(0, cores.texto);
          cupula.addColorStop(1, hopo ? cores.texto : comAlfa(cores.textoSuave, 0.95));
          c.beginPath();
          c.ellipse(x, y - ry * 0.12, rx * (hopo ? 0.66 : 0.5), ry * (hopo ? 0.56 : 0.42), 0, 0, Math.PI * 2);
          c.fillStyle = cupula;
          if (hopo && brilho) {
            c.shadowColor = cores.texto;
            c.shadowBlur = 14;
          }
          c.fill();
          c.shadowBlur = 0;
          c.lineWidth = 2;
          c.strokeStyle = comAlfa(cores.fundo, 0.5);
          c.stroke();
          c.beginPath();
          c.ellipse(x - rx * 0.15, y - ry * 0.32, rx * 0.18, ry * 0.12, 0, 0, Math.PI * 2);
          c.fillStyle = comAlfa(cores.texto, 0.9);
          c.fill();
        }),
      ),
    aberta: (cor, estrela, brilho, tipo) =>
      lembrar(`aberta:${cor}:${estrela}:${brilho}:${tipo ?? "comum"}`, () =>
        comCanvas(SPRITE_DA_ABERTA.largura, SPRITE_DA_ABERTA.altura, (c) => {
          // Uma barra deitada com as pontas arredondadas: parede escura embaixo e tampa colorida em cima.
          const meio = SPRITE_DA_ABERTA.largura / 2;
          const metade = SPRITE_DA_ABERTA.barra / 2;
          const alturaDaTampa = SPRITE_DA_ABERTA.altura * 0.42;
          const topo = SPRITE_DA_ABERTA.altura * 0.18;
          const parede = SPRITE_DA_ABERTA.altura * (tipo === "hopo" ? 0.12 : 0.22);
          const corDaTampa = estrela ? COR_DA_NOTA_DE_ESTRELA : cor;
          const capsula = (y: number) => {
            c.beginPath();
            c.roundRect(meio - metade, y, metade * 2, alturaDaTampa, alturaDaTampa / 2);
          };

          capsula(topo + parede);
          c.fillStyle = comAlfa(cores.fundo, 0.85);
          c.fill();

          capsula(topo);
          const tampa = c.createLinearGradient(0, topo, 0, topo + alturaDaTampa);
          tampa.addColorStop(0, comAlfa(cores.texto, 0.5));
          tampa.addColorStop(0.4, tipo === "tap" ? comAlfa(cores.fundo, 0.9) : corDaTampa);
          tampa.addColorStop(1, corDaTampa);
          c.fillStyle = tampa;
          if (brilho) {
            c.shadowColor = estrela ? COR_DA_ESTRELA : cor;
            c.shadowBlur = estrela ? 22 : 12;
          }
          c.fill();
          c.shadowBlur = 0;
          c.lineWidth = tipo === "tap" ? 6 : 3;
          c.strokeStyle = tipo === "tap" ? corDaTampa : estrela ? COR_DA_ESTRELA : CONTORNO;
          c.stroke();

          // A HOPO aberta ganha a faixa branca acesa no meio, como a cúpula das outras HOPOs.
          if (tipo === "hopo") {
            c.beginPath();
            c.roundRect(meio - metade * 0.85, topo + alturaDaTampa * 0.3, metade * 1.7, alturaDaTampa * 0.32, alturaDaTampa * 0.16);
            c.fillStyle = cores.texto;
            c.fill();
          }
        }),
      ),
    textura: () =>
      lembrar("textura", () =>
        comCanvas(TAMANHO_DA_TEXTURA, TAMANHO_DA_TEXTURA, (c) => {
          // Semente fixa: o braço tem sempre o mesmo desgaste, não muda a cada partida.
          const aleatorio = geradorAleatorio(SEMENTE_DA_TEXTURA);
          const t = TAMANHO_DA_TEXTURA;
          for (let i = 0; i < 2600; i++) {
            c.fillStyle = aleatorio() < 0.7 ? comAlfa(cores.fundo, 0.5 + aleatorio() * 0.5) : comAlfa(cores.texto, aleatorio() * 0.08);
            c.fillRect(aleatorio() * t, aleatorio() * t, 1 + aleatorio() * 2, 1 + aleatorio() * 2);
          }
          c.lineWidth = 1;
          for (let i = 0; i < 40; i++) {
            const x = aleatorio() * t;
            const y = aleatorio() * t;
            const angulo = (aleatorio() - 0.5) * 0.8;
            const comprimento = 10 + aleatorio() * 50;
            c.strokeStyle = comAlfa(aleatorio() < 0.5 ? cores.fundo : cores.textoSuave, 0.12 + aleatorio() * 0.15);
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + Math.sin(angulo) * comprimento, y + Math.cos(angulo) * comprimento);
            c.stroke();
          }
        }),
      ),
    brilho: (cor) =>
      lembrar(`brilho:${cor}`, () =>
        comCanvas(TAMANHO_DO_BRILHO, TAMANHO_DO_BRILHO, (c) => {
          const r = TAMANHO_DO_BRILHO / 2;
          const gradiente = c.createRadialGradient(r, r, 0, r, r, r);
          gradiente.addColorStop(0, comAlfa(cores.texto, 0.95));
          gradiente.addColorStop(0.35, comAlfa(cor, 0.6));
          gradiente.addColorStop(1, comAlfa(cor, 0));
          c.fillStyle = gradiente;
          c.fillRect(0, 0, TAMANHO_DO_BRILHO, TAMANHO_DO_BRILHO);
        }),
      ),
    camada: (nome, versao, largura, altura, escala, desenhar) => {
      let camada = camadas.get(nome);
      if (!camada) camadas.set(nome, (camada = { canvas: document.createElement("canvas"), versao: -1, largura: -1, altura: -1, escala: -1 }));
      if (camada.versao !== versao || camada.largura !== largura || camada.altura !== altura || camada.escala !== escala) {
        Object.assign(camada, { versao, largura, altura, escala });
        // Trocar o tamanho do canvas já limpa o que estava desenhado.
        camada.canvas.width = Math.max(1, Math.round(largura * escala));
        camada.canvas.height = Math.max(1, Math.round(altura * escala));
        const c = camada.canvas.getContext("2d");
        if (c) {
          c.setTransform(escala, 0, 0, escala, 0, 0);
          desenhar(c);
        }
      }
      return camada.canvas;
    },
  };
}
