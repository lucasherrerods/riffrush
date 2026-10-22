import { vi } from "vitest";

export class ParametroFalso {
  value = 0;
  eventos: { tipo: string; valor: number; tempo: number }[] = [];
  setValueAtTime(valor: number, tempo: number) {
    this.eventos.push({ tipo: "set", valor, tempo });
    this.value = valor;
  }
  linearRampToValueAtTime(valor: number, tempo: number) {
    this.eventos.push({ tipo: "linear", valor, tempo });
  }
  exponentialRampToValueAtTime(valor: number, tempo: number) {
    this.eventos.push({ tipo: "exponencial", valor, tempo });
  }
}

export class OsciladorFalso {
  type: OscillatorType = "sine";
  frequency = new ParametroFalso();
  detune = new ParametroFalso();
  inicio?: number;
  fim?: number;
  connect<T>(destino: T) {
    return destino;
  }
  start(tempo = 0) {
    this.inicio = tempo;
  }
  stop(tempo = 0) {
    this.fim = tempo;
  }
}

export class GanhoFalso {
  gain = new ParametroFalso();
  connect<T>(destino: T) {
    return destino;
  }
  disconnect() {}
}

/** AudioContext de mentira: registra o que foi criado para os testes conferirem. */
export class AudioContextFalso {
  static instancias: AudioContextFalso[] = [];
  state: AudioContextState = "running";
  currentTime = 0;
  outputLatency = 0;
  baseLatency = 0;
  destination = {};
  osciladores: OsciladorFalso[] = [];
  ganhos: GanhoFalso[] = [];
  resume = vi.fn(async () => {
    this.state = "running";
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
  });

  constructor(public opcoes?: AudioContextOptions) {
    AudioContextFalso.instancias.push(this);
  }

  createOscillator() {
    const oscilador = new OsciladorFalso();
    this.osciladores.push(oscilador);
    return oscilador;
  }

  createGain() {
    const ganho = new GanhoFalso();
    this.ganhos.push(ganho);
    return ganho;
  }

  createBuffer(canais: number, tamanho: number, taxa: number) {
    return new AudioBufferFalso(
      Array.from({ length: canais }, () => new Float32Array(tamanho)),
      taxa,
    );
  }

  /** Entende só WAV mono de 16 bits, o formato que os testes geram. */
  async decodeAudioData(dados: ArrayBuffer) {
    const vista = new DataView(dados);
    if (new TextDecoder().decode(new Uint8Array(dados, 0, 4)) !== "RIFF") throw new Error("Formato de áudio não suportado.");
    const taxa = vista.getUint32(24, true);
    const amostras = new Float32Array((dados.byteLength - 44) / 2);
    for (let i = 0; i < amostras.length; i++) amostras[i] = vista.getInt16(44 + i * 2, true) / 32768;
    return new AudioBufferFalso([amostras], taxa);
  }
}

export class AudioBufferFalso {
  constructor(
    private canais: Float32Array[],
    public sampleRate: number,
  ) {}
  get numberOfChannels() {
    return this.canais.length;
  }
  get length() {
    return this.canais[0].length;
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  getChannelData(canal: number) {
    return this.canais[canal];
  }
  copyToChannel(origem: Float32Array, canal: number) {
    this.canais[canal].set(origem);
  }
}

/** Troca o AudioContext global pelo falso e devolve um módulo recém-importado. */
export async function comAudioFalso<T>(importar: () => Promise<T>) {
  AudioContextFalso.instancias = [];
  vi.stubGlobal("AudioContext", AudioContextFalso);
  vi.resetModules();
  return importar();
}
