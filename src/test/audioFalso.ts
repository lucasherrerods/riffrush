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
}

/** Troca o AudioContext global pelo falso e devolve um módulo recém-importado. */
export async function comAudioFalso<T>(importar: () => Promise<T>) {
  AudioContextFalso.instancias = [];
  vi.stubGlobal("AudioContext", AudioContextFalso);
  vi.resetModules();
  return importar();
}
