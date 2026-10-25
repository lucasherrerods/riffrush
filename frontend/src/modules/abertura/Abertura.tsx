import { useEffect, useRef } from "react";
import { DURACAO, DURACAO_TOTAL, corteNoTempo, roteiroDaAbertura, vermelhoNoTempo, type Corte } from "./roteiro";

const NOME = "RIFF RUSH";
const VERMELHO = "#b91c1c";
const FUNDO = "#0a0a0a";
/** Quantas capas ficam empilhadas na tela durante os cortes, como revistas jogadas na mesa. */
const PILHA = 5;

interface Props {
  /** As capas já carregadas: a abertura não espera imagem nenhuma no meio. */
  capas: HTMLImageElement[];
  aoTerminar: () => void;
}

/** As últimas capas cortadas, empilhadas; no fim dos cortes a de cima já cobre a tela toda. */
function desenharPilha(ctx: CanvasRenderingContext2D, largura: number, altura: number, cortes: Corte[], tempo: number, capas: HTMLImageElement[]) {
  const atual = cortes.indexOf(corteNoTempo(cortes, tempo));
  const progresso = Math.min(1, tempo / DURACAO.cortes);
  const cheia = Math.hypot(largura, altura);
  for (let i = Math.max(0, atual - PILHA + 1); i <= atual; i++) {
    const corte = cortes[i];
    const doTopo = atual - i;
    // A capa de cima cresce de pouco mais da metade da tela até cobrir tudo; as de baixo ficam menores.
    const lado = Math.min(largura, altura) * (0.62 + progresso * 0.9) * corte.zoom * (1 - doTopo * 0.06);
    ctx.save();
    ctx.translate(largura / 2 + corte.dx * largura * (1 - progresso * 0.6), altura / 2 + corte.dy * altura * (1 - progresso * 0.6));
    ctx.rotate(corte.giro * (1 - progresso * 0.5));
    const ladoFinal = Math.min(lado, cheia * 1.2);
    ctx.drawImage(capas[corte.capa], -ladoFinal / 2, -ladoFinal / 2, ladoFinal, ladoFinal);
    ctx.restore();
  }
}

/** Tinge as capas: multiplica pelo vermelho e escurece. */
function tingir(ctx: CanvasRenderingContext2D, largura: number, altura: number, quanto: number) {
  if (quanto <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = quanto;
  ctx.fillStyle = VERMELHO;
  ctx.fillRect(0, 0, largura, altura);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = quanto * 0.35;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, largura, altura);
  ctx.restore();
}

function escreverNome(ctx: CanvasRenderingContext2D, tamanho: number, largura: number, altura: number) {
  ctx.font = `${tamanho}px "Bebas Neue", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(NOME, largura / 2, altura / 2);
}

function tamanhoDoNome(ctx: CanvasRenderingContext2D, largura: number, altura: number) {
  ctx.font = `100px "Bebas Neue", sans-serif`;
  const medida = ctx.measureText(NOME).width || 1;
  return Math.min((largura * 0.82 * 100) / medida, altura * 0.42);
}

/**
 * A abertura do jogo, no estilo da abertura da Marvel: capas de álbum trocando cada vez mais rápido,
 * tudo ficando vermelho e o nome do jogo com as capas passando dentro das letras.
 * Qualquer tecla, clique ou botão do controle pula.
 */
export function Abertura({ capas, aoTerminar }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const terminarAtual = useRef(aoTerminar);
  terminarAtual.current = aoTerminar;

  useEffect(() => {
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.current?.getContext("2d") ?? null;
    } catch {
      // Sem canvas (como nos testes): a abertura não passa.
    }
    if (!ctx || capas.length === 0) {
      terminarAtual.current();
      return;
    }
    const pincel = ctx;
    const cortes = roteiroDaAbertura(capas.length);
    // O nome com as capas dentro: as capas desenhadas aqui e recortadas no formato das letras.
    const mascara = document.createElement("canvas");
    const pincelDaMascara = mascara.getContext("2d");
    let quadro = 0;
    let inicio: number | null = null;
    let acabou = false;

    const terminar = () => {
      if (acabou) return;
      acabou = true;
      terminarAtual.current();
    };

    const desenhar = (agora: number) => {
      const el = canvas.current;
      if (acabou || !el) return;
      inicio ??= agora;
      const tempo = (agora - inicio) / 1000;
      if (tempo >= DURACAO_TOTAL) return terminar();
      if (tempo > 0.3 && navigator.getGamepads?.().some((g) => g?.buttons.some((b) => b.pressed))) return terminar();

      const escala = window.devicePixelRatio || 1;
      const largura = el.clientWidth;
      const altura = el.clientHeight;
      if (el.width !== Math.round(largura * escala)) el.width = Math.round(largura * escala);
      if (el.height !== Math.round(altura * escala)) el.height = Math.round(altura * escala);
      // A escala sai do próprio canvas: se a densidade da tela mudar no meio, o desenho ainda cobre tudo.
      const escalaX = el.width / (largura || 1);
      const escalaY = el.height / (altura || 1);
      pincel.setTransform(escalaX, 0, 0, escalaY, 0, 0);
      pincel.fillStyle = FUNDO;
      pincel.fillRect(0, 0, largura, altura);

      desenharPilha(pincel, largura, altura, cortes, tempo, capas);
      if (tempo < DURACAO.cortes) {
        tingir(pincel, largura, altura, vermelhoNoTempo(tempo) * 0.85);
      } else {
        const noNome = tempo - DURACAO.cortes;
        // Atrás do nome, as capas seguem passando, vermelhas e escuras.
        tingir(pincel, largura, altura, 1);
        pincel.fillStyle = "rgba(60, 0, 0, 0.45)";
        pincel.fillRect(0, 0, largura, altura);

        // As letras chegam um pouco maiores e assentam.
        const assentar = 1 - (1 - Math.min(1, noNome / 0.5)) ** 3;
        const tamanho = tamanhoDoNome(pincel, largura, altura) * (1.12 - 0.12 * assentar);
        if (pincelDaMascara) {
          mascara.width = el.width;
          mascara.height = el.height;
          pincelDaMascara.setTransform(escalaX, 0, 0, escalaY, 0, 0);
          desenharPilha(pincelDaMascara, largura, altura, cortes, tempo, capas);
          pincelDaMascara.globalCompositeOperation = "destination-in";
          escreverNome(pincelDaMascara, tamanho, largura, altura);
          pincel.save();
          pincel.setTransform(1, 0, 0, 1, 0, 0);
          pincel.drawImage(mascara, 0, 0);
          pincel.restore();
        }
        // No fim, as letras ficam sólidas.
        pincel.save();
        pincel.globalAlpha = Math.min(1, Math.max(0, (noNome - DURACAO.nome * 0.55) / (DURACAO.nome * 0.45)));
        pincel.fillStyle = "#f5f5f4";
        escreverNome(pincel, tamanho, largura, altura);
        pincel.restore();

        const naSaida = noNome - DURACAO.nome;
        if (naSaida > 0) {
          pincel.save();
          pincel.globalAlpha = Math.min(1, naSaida / DURACAO.saida);
          pincel.fillStyle = FUNDO;
          pincel.fillRect(0, 0, largura, altura);
          pincel.restore();
        }
      }
      quadro = requestAnimationFrame(desenhar);
    };

    // Sem esperar a fonte, o nome sairia na fonte de reserva nos primeiros quadros.
    const fonte = document.fonts?.load(`100px "Bebas Neue"`).catch(() => undefined) ?? Promise.resolve();
    void fonte.then(() => {
      if (!acabou) quadro = requestAnimationFrame(desenhar);
    });

    const pular = (evento: Event) => {
      evento.preventDefault();
      evento.stopPropagation();
      terminar();
    };
    window.addEventListener("keydown", pular, true);
    window.addEventListener("pointerdown", pular, true);
    return () => {
      acabou = true;
      cancelAnimationFrame(quadro);
      window.removeEventListener("keydown", pular, true);
      window.removeEventListener("pointerdown", pular, true);
    };
  }, [capas]);

  return <canvas ref={canvas} role="img" aria-label="Abertura do Riff Rush" className="fixed inset-0 z-[100] size-full bg-black" />;
}
