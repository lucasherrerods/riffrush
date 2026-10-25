export interface SocketMinimo {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((evento: { data: string }) => void) | null;
  onclose: ((evento?: { reason?: string }) => void) | null;
  send(texto: string): void;
  close(): void;
}

export interface DependenciasDoSocket {
  pedirFicha: () => Promise<string>;
  criarSocket?: (url: string) => SocketMinimo;
  esperar?: (fn: () => void, ms: number) => unknown;
}

interface Eventos {
  url: (ficha: string) => string;
  aoAbrir: () => void;
  aoReceber: (texto: string) => void;
  aoCair: () => void;
}

const ABERTO = 1;
const ESPERA_INICIAL_MS = 2000;
const ESPERA_MAXIMA_MS = 30000;

/**
 * Uma conexão com o relay que entra com a ficha da conta: pede ficha nova a cada tentativa
 * (ela vale poucos minutos) e reconecta sozinha, esperando cada vez mais, quando a rede cai.
 */
export class SocketComFicha {
  private socket: SocketMinimo | null = null;
  private ligado = false;
  private espera = ESPERA_INICIAL_MS;

  constructor(
    private deps: DependenciasDoSocket,
    private eventos: Eventos,
  ) {}

  get aberto() {
    return this.socket?.readyState === ABERTO;
  }

  ligar() {
    if (this.ligado) return;
    this.ligado = true;
    void this.conectar();
  }

  desligar() {
    this.ligado = false;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  /** Devolve false quando a conexão não está aberta. */
  enviar(texto: string) {
    if (!this.aberto) return false;
    this.socket!.send(texto);
    return true;
  }

  private async conectar() {
    let ficha: string;
    try {
      ficha = await this.deps.pedirFicha();
    } catch {
      return this.tentarDeNovo();
    }
    if (!this.ligado) return;
    const criar = this.deps.criarSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketMinimo);
    const socket = criar(this.eventos.url(ficha));
    this.socket = socket;
    socket.onopen = () => {
      this.espera = ESPERA_INICIAL_MS;
      this.eventos.aoAbrir();
    };
    socket.onmessage = (evento) => this.eventos.aoReceber(evento.data);
    socket.onclose = (evento) => {
      if (this.socket !== socket) return;
      this.socket = null;
      // A mesma conta abriu em outro aparelho: este sai e não briga pela vaga.
      if (evento?.reason === "outroAparelho") this.ligado = false;
      this.eventos.aoCair();
      this.tentarDeNovo();
    };
  }

  private tentarDeNovo() {
    if (!this.ligado) return;
    const esperar = this.deps.esperar ?? setTimeout;
    esperar(() => this.ligado && !this.socket && void this.conectar(), this.espera);
    this.espera = Math.min(this.espera * 2, ESPERA_MAXIMA_MS);
  }
}
