export interface Faixa {
  taxa: number;
  canais: Float32Array[];
}

export interface PedidoDeMixagem {
  faixas: Faixa[];
  taxa: number;
}

type Estereo = [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>];

/** Mistura num Web Worker, para a tela não congelar. Sem Worker, mistura aqui mesmo. */
export function mixarEmSegundoPlano(faixas: Faixa[], taxa: number): Promise<Estereo> {
  if (typeof Worker === "undefined") return Promise.resolve(mixarFaixas(faixas, taxa));
  // Cópias: os canais de um AudioBuffer não podem ser transferidos, e a cópia transferida não pesa no envio.
  const copias = faixas.map((f) => ({ taxa: f.taxa, canais: f.canais.map((c) => c.slice()) }));
  const trabalhador = new Worker(new URL("./mixagem.worker.ts", import.meta.url), { type: "module" });
  return new Promise<Estereo>((resolver, rejeitar) => {
    trabalhador.onmessage = (evento: MessageEvent<Estereo>) => resolver(evento.data);
    trabalhador.onerror = () => rejeitar(new Error("Não deu para misturar as faixas do .sng."));
    const pedido: PedidoDeMixagem = { faixas: copias, taxa };
    trabalhador.postMessage(pedido, copias.flatMap((f) => f.canais.map((c) => c.buffer)));
  }).finally(() => trabalhador.terminate());
}

/** Soma as faixas separadas (guitarra, baixo, bateria...) num áudio estéreo, sem estourar o volume. */
export function mixarFaixas(faixas: Faixa[], taxaAlvo: number): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const tamanho = Math.max(...faixas.map((f) => Math.ceil((f.canais[0].length * taxaAlvo) / f.taxa)));
  const saida: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(tamanho), new Float32Array(tamanho)];
  for (const faixa of faixas) {
    const passo = faixa.taxa / taxaAlvo;
    for (let canal = 0; canal < 2; canal++) {
      const origem = faixa.canais[Math.min(canal, faixa.canais.length - 1)];
      const destino = saida[canal];
      for (let i = 0; i < tamanho; i++) {
        const j = Math.floor(i * passo);
        if (j >= origem.length) break;
        destino[i] += origem[j];
      }
    }
  }
  let pico = 0;
  for (const canal of saida) for (const amostra of canal) pico = Math.max(pico, Math.abs(amostra));
  if (pico > 1) for (const canal of saida) for (let i = 0; i < canal.length; i++) canal[i] /= pico;
  return saida;
}
