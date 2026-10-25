import { aplicarMensagem, urlDaPresenca, type EstadoOnline, type PessoaOnline } from "./protocolo";
import { SocketComFicha, type DependenciasDoSocket } from "./socketComFicha";

export interface EstadoDaPresenca {
  conectada: boolean;
  pessoas: PessoaOnline[];
}

export interface DependenciasDaPresenca extends DependenciasDoSocket {
  urlDoRelay: string;
}

/**
 * A conexão com a lista de quem está online. Fica ligada enquanto a pessoa quiser aparecer,
 * reconecta sozinha quando a rede cai e reenvia onde a pessoa está.
 */
export class ConexaoDePresenca {
  private estadoAtual: EstadoDaPresenca = { conectada: false, pessoas: [] };
  private ouvintes = new Set<() => void>();
  private socket: SocketComFicha;
  private onde: EstadoOnline = { tipo: "menu" };

  constructor(private deps: DependenciasDaPresenca) {
    this.socket = new SocketComFicha(deps, {
      url: urlDaPresenca(deps.urlDoRelay),
      aoAbrir: () => {
        this.socket.enviar(JSON.stringify({ estado: this.onde }));
        this.mudar({ ...this.estadoAtual, conectada: true });
      },
      aoReceber: (texto) => this.mudar({ ...this.estadoAtual, pessoas: aplicarMensagem(this.estadoAtual.pessoas, texto) }),
      aoCair: () => this.mudar({ conectada: false, pessoas: [] }),
    });
  }

  inscrever = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  estado = () => this.estadoAtual;

  ligar() {
    if (this.deps.urlDoRelay) this.socket.ligar();
  }

  desligar() {
    this.socket.desligar();
    this.mudar({ conectada: false, pessoas: [] });
  }

  /** Onde a pessoa está agora; vai de novo a cada reconexão. */
  definirEstado(onde: EstadoOnline) {
    this.onde = onde;
    this.socket.enviar(JSON.stringify({ estado: onde }));
  }

  private mudar(estado: EstadoDaPresenca) {
    this.estadoAtual = estado;
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}
