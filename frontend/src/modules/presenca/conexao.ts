import type { Modo } from "@/shared/modo";
import { aplicarMensagem, lerConvite, lerMensagemPrivada, urlDaPresenca, type ConviteParaSala, type EstadoOnline, type MensagemPrivada, type PessoaOnline } from "./protocolo";
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
  private ouvintesDeConvite = new Set<(convite: ConviteParaSala) => void>();
  private ouvintesDePrivadas = new Set<(mensagem: MensagemPrivada) => void>();
  private socket: SocketComFicha;
  private onde: EstadoOnline = { tipo: "menu" };
  private modo: Modo = "rock";

  constructor(private deps: DependenciasDaPresenca) {
    this.socket = new SocketComFicha(deps, {
      url: urlDaPresenca(deps.urlDoRelay),
      aoAbrir: () => {
        this.socket.enviar(JSON.stringify({ estado: { ...this.onde, modo: this.modo } }));
        this.mudar({ ...this.estadoAtual, conectada: true });
      },
      aoReceber: (texto) => {
        const convite = lerConvite(texto);
        const privada = !convite && lerMensagemPrivada(texto);
        if (convite) for (const ouvinte of this.ouvintesDeConvite) ouvinte(convite);
        else if (privada) for (const ouvinte of this.ouvintesDePrivadas) ouvinte(privada);
        else this.mudar({ ...this.estadoAtual, pessoas: aplicarMensagem(this.estadoAtual.pessoas, texto) });
      },
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

  ouvirConvites = (ouvinte: (convite: ConviteParaSala) => void) => {
    this.ouvintesDeConvite.add(ouvinte);
    return () => {
      this.ouvintesDeConvite.delete(ouvinte);
    };
  };

  /** As mensagens entre amigos saem pela API; por aqui só chegam as entregues na hora. */
  ouvirPrivadas = (ouvinte: (mensagem: MensagemPrivada) => void) => {
    this.ouvintesDePrivadas.add(ouvinte);
    return () => {
      this.ouvintesDePrivadas.delete(ouvinte);
    };
  };

  /** Chama a conta para a sala online. Sem conexão, o convite não sai. */
  convidar(para: string, codigo: string) {
    this.socket.enviar(JSON.stringify({ tipo: "convite", para, codigo }));
  }

  ligar() {
    if (this.deps.urlDoRelay) this.socket.ligar();
  }

  desligar() {
    this.socket.desligar();
    this.mudar({ conectada: false, pessoas: [] });
  }

  /** Onde a pessoa está agora; vai de novo a cada reconexão. */
  definirEstado(onde: EstadoOnline) {
    // A tela manda o estado a cada mudança da sala: só vale avisar o relay quando ele muda de fato.
    if (JSON.stringify(onde) === JSON.stringify(this.onde)) return;
    this.onde = onde;
    this.socket.enviar(JSON.stringify({ estado: { ...onde, modo: this.modo } }));
  }

  /** O modo de jogo aberto, que vai junto com o estado para os amigos verem. */
  definirModo(modo: Modo) {
    if (modo === this.modo) return;
    this.modo = modo;
    this.socket.enviar(JSON.stringify({ estado: { ...this.onde, modo } }));
  }

  private mudar(estado: EstadoDaPresenca) {
    this.estadoAtual = estado;
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}
