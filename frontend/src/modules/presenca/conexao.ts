import { aplicarMensagem, urlDaPresenca, type EstadoOnline, type PessoaOnline } from "./protocolo";

export interface EstadoDaPresenca {
  conectada: boolean;
  pessoas: PessoaOnline[];
}

interface SocketMinimo {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((evento: { data: string }) => void) | null;
  onclose: ((evento?: { reason?: string }) => void) | null;
  send(texto: string): void;
  close(): void;
}

export interface DependenciasDaPresenca {
  urlDoRelay: string;
  pedirFicha: () => Promise<string>;
  criarSocket?: (url: string) => SocketMinimo;
  esperar?: (fn: () => void, ms: number) => unknown;
}

const ABERTO = 1;
const ESPERA_INICIAL_MS = 2000;
const ESPERA_MAXIMA_MS = 30000;

/**
 * A conexão com a lista de quem está online. Fica ligada enquanto a pessoa quiser aparecer,
 * reconecta sozinha quando a rede cai e reenvia onde a pessoa está.
 */
export class ConexaoDePresenca {
  private estadoAtual: EstadoDaPresenca = { conectada: false, pessoas: [] };
  private ouvintes = new Set<() => void>();
  private socket: SocketMinimo | null = null;
  private ligada = false;
  private espera = ESPERA_INICIAL_MS;
  private onde: EstadoOnline = { tipo: "menu" };

  constructor(private deps: DependenciasDaPresenca) {}

  inscrever = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  estado = () => this.estadoAtual;

  ligar() {
    if (this.ligada || !this.deps.urlDoRelay) return;
    this.ligada = true;
    void this.conectar();
  }

  desligar() {
    this.ligada = false;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.mudar({ conectada: false, pessoas: [] });
  }

  /** Onde a pessoa está agora; vai de novo a cada reconexão. */
  definirEstado(onde: EstadoOnline) {
    this.onde = onde;
    if (this.socket?.readyState === ABERTO) this.socket.send(JSON.stringify({ estado: onde }));
  }

  private async conectar() {
    let ficha: string;
    try {
      ficha = await this.deps.pedirFicha();
    } catch {
      return this.tentarDeNovo();
    }
    if (!this.ligada) return;
    const criar = this.deps.criarSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketMinimo);
    const socket = criar(urlDaPresenca(this.deps.urlDoRelay, ficha));
    this.socket = socket;
    socket.onopen = () => {
      this.espera = ESPERA_INICIAL_MS;
      socket.send(JSON.stringify({ estado: this.onde }));
      this.mudar({ ...this.estadoAtual, conectada: true });
    };
    socket.onmessage = (evento) => this.mudar({ ...this.estadoAtual, pessoas: aplicarMensagem(this.estadoAtual.pessoas, evento.data) });
    socket.onclose = (evento) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.mudar({ conectada: false, pessoas: [] });
      // A mesma conta abriu em outro aparelho: este sai da lista e não briga pela vaga.
      if (evento?.reason === "outroAparelho") this.ligada = false;
      this.tentarDeNovo();
    };
  }

  private tentarDeNovo() {
    if (!this.ligada) return;
    const esperar = this.deps.esperar ?? setTimeout;
    esperar(() => this.ligada && !this.socket && void this.conectar(), this.espera);
    this.espera = Math.min(this.espera * 2, ESPERA_MAXIMA_MS);
  }

  private mudar(estado: EstadoDaPresenca) {
    this.estadoAtual = estado;
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}
