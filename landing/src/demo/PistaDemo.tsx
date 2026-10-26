import { useCallback, useEffect, useRef, useState } from "react";
import { comAlfa, temaAtivo } from "@jogo/src/shared/styles/tokens";
import { PISTAS, TECLAS, julgarToque, notasDoRiff, notasNaTela, type Nota } from "./riff";

const CORES = temaAtivo.pista.trastes;
const NOMES = ["verde", "vermelho", "amarelo", "azul", "laranja"];
const LETRAS = TECLAS.map((tecla) => tecla.replace("Key", ""));
const ANTECEDENCIA = 1400;
/** Altura do alvo, em fração da altura do canvas. */
const ALVO = 0.84;
const NOTAS: Nota[] = notasDoRiff(60000);
const FIM = NOTAS[NOTAS.length - 1].tempo + 1500;

interface Placar {
  pontos: number;
  sequencia: number;
  acertos: number;
}

const PLACAR_ZERADO: Placar = { pontos: 0, sequencia: 0, acertos: 0 };
const multiplicador = (sequencia: number) => Math.min(4, 1 + Math.floor(sequencia / 10));

/** Ponto na pista em perspectiva: posição 0 é o fundo, 1 é o alvo. */
function ponto(largura: number, altura: number, posicao: number, pista: number) {
  const y = altura * ALVO * Math.pow(Math.max(0, posicao), 1.6);
  const meia = largura * (0.12 + 0.34 * (y / (altura * ALVO)));
  const larguraDaPista = (meia * 2) / PISTAS;
  return { x: largura / 2 - meia + larguraDaPista * (pista + 0.5), y, larguraDaPista };
}

export function PistaDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const estado = useRef({ inicio: 0, acertadas: new Set<number>(), brilhos: [0, 0, 0, 0, 0], apertadas: [false, false, false, false, false], jogador: false });
  const [placar, setPlacar] = useState<Placar>(PLACAR_ZERADO);
  const [jogador, setJogador] = useState(false);

  const agora = () => performance.now() - estado.current.inicio;

  const acertar = useCallback((indice: number) => {
    const { acertadas, brilhos } = estado.current;
    acertadas.add(indice);
    brilhos[NOTAS[indice].pista] = 1;
    setPlacar((p) => ({ pontos: p.pontos + 50 * multiplicador(p.sequencia), sequencia: p.sequencia + 1, acertos: p.acertos + 1 }));
  }, []);

  const apertar = useCallback(
    (pista: number) => {
      const s = estado.current;
      if (!s.jogador) {
        // Primeiro toque: o bot sai e a música recomeça para quem chegou.
        s.jogador = true;
        s.inicio = performance.now();
        s.acertadas.clear();
        setJogador(true);
        setPlacar(PLACAR_ZERADO);
      }
      s.apertadas[pista] = true;
      const indice = julgarToque(NOTAS, pista, agora(), s.acertadas);
      if (indice === null) setPlacar((p) => ({ ...p, sequencia: 0 }));
      else acertar(indice);
    },
    [acertar],
  );

  const soltar = useCallback((pista: number) => {
    estado.current.apertadas[pista] = false;
  }, []);

  useEffect(() => {
    const pistaDaTecla = (evento: KeyboardEvent) => TECLAS.indexOf(evento.code);
    const aoApertar = (evento: KeyboardEvent) => {
      const pista = pistaDaTecla(evento);
      if (pista < 0 || evento.repeat || evento.ctrlKey || evento.metaKey) return;
      apertar(pista);
    };
    const aoSoltar = (evento: KeyboardEvent) => {
      const pista = pistaDaTecla(evento);
      if (pista >= 0) soltar(pista);
    };
    window.addEventListener("keydown", aoApertar);
    window.addEventListener("keyup", aoSoltar);
    return () => {
      window.removeEventListener("keydown", aoApertar);
      window.removeEventListener("keyup", aoSoltar);
    };
  }, [apertar, soltar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const s = estado.current;
    s.inicio = performance.now();
    let quadro = 0;
    let anterior = performance.now();

    const desenhar = () => {
      const agoraReal = performance.now();
      const passo = (agoraReal - anterior) / 1000;
      anterior = agoraReal;
      const proporcao = window.devicePixelRatio || 1;
      const { clientWidth: largura, clientHeight: altura } = canvas;
      if (canvas.width !== largura * proporcao) {
        canvas.width = largura * proporcao;
        canvas.height = altura * proporcao;
      }
      ctx.setTransform(proporcao, 0, 0, proporcao, 0, 0);
      ctx.clearRect(0, 0, largura, altura);

      let tempo = agoraReal - s.inicio;
      if (tempo > FIM) {
        s.inicio = agoraReal;
        s.acertadas.clear();
        tempo = 0;
      }

      // O bot toca sozinho até alguém apertar uma tecla.
      if (!s.jogador) {
        NOTAS.forEach((nota, indice) => {
          if (!s.acertadas.has(indice) && nota.tempo <= tempo && tempo - nota.tempo < 100) acertar(indice);
        });
      }

      // Braço da guitarra.
      const fundo = ponto(largura, altura, 0, 0);
      const base = ponto(largura, altura, 1.15, 0);
      const meiaNoFundo = largura / 2 - (fundo.x - fundo.larguraDaPista / 2);
      const meiaNaBase = largura / 2 - (base.x - base.larguraDaPista / 2);
      const braco = ctx.createLinearGradient(0, 0, 0, base.y);
      braco.addColorStop(0, comAlfa(temaAtivo.cores.superficie, 0));
      braco.addColorStop(0.35, comAlfa(temaAtivo.cores.superficie, 0.9));
      braco.addColorStop(1, temaAtivo.cores.superficieElevada);
      ctx.fillStyle = braco;
      ctx.beginPath();
      ctx.moveTo(largura / 2 - meiaNoFundo, 0);
      ctx.lineTo(largura / 2 + meiaNoFundo, 0);
      ctx.lineTo(largura / 2 + meiaNaBase, base.y);
      ctx.lineTo(largura / 2 - meiaNaBase, base.y);
      ctx.closePath();
      ctx.fill();

      // Trastes que passam, dando a sensação de velocidade.
      const batida = 60000 / 140;
      for (let i = 0; i < 8; i++) {
        const posicao = 1 - (((batida - (tempo % batida)) + i * batida) / ANTECEDENCIA);
        if (posicao < 0 || posicao > 1.1) continue;
        const a = ponto(largura, altura, posicao, 0);
        const b = ponto(largura, altura, posicao, PISTAS - 1);
        ctx.strokeStyle = comAlfa(temaAtivo.cores.texto, 0.08 + 0.12 * posicao);
        ctx.lineWidth = 1 + posicao * 2;
        ctx.beginPath();
        ctx.moveTo(a.x - a.larguraDaPista / 2, a.y);
        ctx.lineTo(b.x + b.larguraDaPista / 2, b.y);
        ctx.stroke();
      }

      // Cordas.
      for (let pista = 0; pista < PISTAS; pista++) {
        const a = ponto(largura, altura, 0, pista);
        const b = ponto(largura, altura, 1.15, pista);
        ctx.strokeStyle = comAlfa(CORES[pista], 0.22);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Alvos.
      for (let pista = 0; pista < PISTAS; pista++) {
        const { x, y, larguraDaPista } = ponto(largura, altura, 1, pista);
        const raio = larguraDaPista * 0.34;
        const brilho = s.brilhos[pista];
        s.brilhos[pista] = Math.max(0, brilho - passo * 4);
        ctx.shadowColor = CORES[pista];
        ctx.shadowBlur = 8 + brilho * 40;
        ctx.lineWidth = 4;
        ctx.strokeStyle = CORES[pista];
        ctx.fillStyle = s.apertadas[pista] ? comAlfa(CORES[pista], 0.55) : comAlfa(temaAtivo.cores.fundo, 0.85);
        ctx.beginPath();
        ctx.ellipse(x, y, raio, raio * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (brilho > 0) {
          ctx.fillStyle = comAlfa(CORES[pista], brilho * 0.5);
          ctx.beginPath();
          ctx.moveTo(x - raio, y);
          ctx.lineTo(x, y - altura * 0.35 * brilho);
          ctx.lineTo(x + raio, y);
          ctx.fill();
        }
      }

      // Notas.
      for (const nota of notasNaTela(NOTAS, tempo, ANTECEDENCIA, s.acertadas)) {
        const { x, y, larguraDaPista } = ponto(largura, altura, nota.posicao, nota.pista);
        const raio = larguraDaPista * 0.32;
        const perdida = nota.posicao > 1.04;
        const cor = perdida ? temaAtivo.pista.notaPerdida : CORES[nota.pista];
        ctx.shadowColor = cor;
        ctx.shadowBlur = perdida ? 0 : 18;
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.ellipse(x, y, raio, raio * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = comAlfa(temaAtivo.cores.texto, 0.85);
        ctx.beginPath();
        ctx.ellipse(x, y - raio * 0.08, raio * 0.42, raio * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, [acertar]);

  const mult = multiplicador(placar.sequencia);

  return (
    <section aria-label="Demo jogável" className="relative flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 px-2">
        <div>
          <p className="font-titulo text-4xl leading-none text-texto tabular-nums">{placar.pontos.toLocaleString("pt-BR")}</p>
          <p className="text-sm text-texto-suave">{jogador ? "Sua pontuação" : "O bot está tocando"}</p>
        </div>
        <div className="text-right">
          <p className="font-titulo text-4xl leading-none tabular-nums" style={{ color: temaAtivo.pista.multiplicador[mult - 1] }}>
            {mult}x
          </p>
          <p className="text-sm text-texto-suave tabular-nums">sequência {placar.sequencia}</p>
        </div>
      </div>

      <canvas ref={canvasRef} className="min-h-0 w-full flex-1" aria-hidden="true" />

      <div className="grid grid-cols-5 gap-2 px-2">
        {LETRAS.map((letra, pista) => (
          <button
            key={letra}
            type="button"
            aria-label={`Tecla ${letra} (${NOMES[pista]})`}
            onPointerDown={(evento) => {
              evento.preventDefault();
              apertar(pista);
            }}
            onPointerUp={() => soltar(pista)}
            onPointerLeave={() => soltar(pista)}
            className="chapa touch-none py-3 font-titulo text-2xl select-none active:brightness-150"
            style={{ color: CORES[pista], borderColor: CORES[pista] }}
          >
            {letra}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-texto-suave">{jogador ? "Acerte as notas quando elas chegarem no alvo." : "Aperte A S J K L ou toque nos botões para assumir a guitarra."}</p>
    </section>
  );
}
