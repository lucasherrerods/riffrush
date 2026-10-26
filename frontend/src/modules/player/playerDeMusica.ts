import { obterContextoDeAudio, saidaDeAudio } from "@/modules/audio";
import { carregarMusica, type Musica } from "@/modules/songs";
import { acaoDeVoltar, indiceVizinho, posicaoNaMusica } from "./fila";

export interface EstadoDoPlayerDeMusica {
  musica: Musica | null;
  tocando: boolean;
  carregando: boolean;
  duracao: number;
}

type Carregar = (musica: Musica) => Promise<AudioBuffer>;

/** A trilha dos menus: um só player para o app inteiro, que segue a música que cada tela pede. */
export class PlayerDeMusica {
  private estadoAtual: EstadoDoPlayerDeMusica = { musica: null, tocando: false, carregando: false, duracao: 0 };
  private ouvintes = new Set<() => void>();
  private fila: Musica[] = [];
  private buffer: AudioBuffer | null = null;
  private fonte: AudioBufferSourceNode | null = null;
  private ganhoCriado: GainNode | null = null;
  private volume = 1;
  private inicio = 0;
  private deslocamento = 0;
  /** Cada pedido ganha um número; um carregamento que termina depois de outro pedido é descartado. */
  private pedido = 0;
  private suspenso = false;
  private navegar: ((passos: number) => void) | null = null;
  private tocavaAntesDeSuspender = false;

  constructor(
    private contexto: () => AudioContext = obterContextoDeAudio,
    private carregar: Carregar = async (musica) => (await carregarMusica(musica, "medio")).audio,
  ) {}

  inscrever = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  estado = () => this.estadoAtual;

  posicao() {
    const { tocando, duracao } = this.estadoAtual;
    return posicaoNaMusica(tocando, this.deslocamento, this.inicio, tocando ? this.contexto().currentTime : 0, duracao);
  }

  definirFila(musicas: Musica[]) {
    this.fila = musicas;
  }

  /** Na seleção, avançar e voltar mexem no carrossel, e o carrossel pede a música de volta. */
  definirNavegacao(navegar: ((passos: number) => void) | null) {
    this.navegar = navegar;
  }

  definirVolume(volume: number) {
    this.volume = volume;
    if (this.ganhoCriado) this.ganhoCriado.gain.value = volume;
  }

  /** Toca a música pedida desde o começo. Se já é ela, não faz nada. */
  seguir(musica: Musica) {
    if (musica.id === this.estadoAtual.musica?.id) return;
    void this.abrir(musica);
  }

  /** Como `seguir`, mas tira do pause quando é a mesma música: é o botão de ouvir a prévia. */
  ouvir(musica: Musica) {
    if (musica.id !== this.estadoAtual.musica?.id) return this.seguir(musica);
    if (!this.estadoAtual.tocando && !this.estadoAtual.carregando) this.continuar();
  }

  alternar() {
    if (this.estadoAtual.tocando) this.pausar();
    else this.continuar();
  }

  proxima() {
    this.pular(1);
  }

  anterior() {
    if (acaoDeVoltar(this.posicao()) === "reiniciar") this.irPara(0);
    else this.pular(-1);
  }

  irPara(segundos: number) {
    this.deslocamento = Math.min(Math.max(segundos, 0), this.estadoAtual.duracao);
    if (this.estadoAtual.tocando) this.iniciarFonte();
    else this.avisar();
  }

  /** Na partida a pista toca a própria música: o player cala e volta de onde parou depois. */
  suspender(suspenso: boolean) {
    if (suspenso === this.suspenso) return;
    if (suspenso) {
      this.tocavaAntesDeSuspender = this.estadoAtual.tocando;
      this.pausar();
      this.suspenso = true;
      return;
    }
    this.suspenso = false;
    if (this.tocavaAntesDeSuspender) this.continuar();
  }

  private pular(passos: number) {
    if (this.navegar) return this.navegar(passos);
    const atual = this.fila.findIndex((m) => m.id === this.estadoAtual.musica?.id);
    const vizinho = this.fila[indiceVizinho(this.fila.length, atual, passos)];
    if (vizinho) void this.abrir(vizinho);
  }

  private pausar() {
    if (!this.estadoAtual.tocando) return;
    this.deslocamento = this.posicao();
    this.pararFonte();
    this.mudar({ tocando: false });
  }

  private continuar() {
    if (!this.buffer || this.suspenso) return;
    this.iniciarFonte();
    this.mudar({ tocando: true });
  }

  private async abrir(musica: Musica) {
    const pedido = ++this.pedido;
    this.pararFonte();
    this.buffer = null;
    this.deslocamento = 0;
    this.mudar({ musica, tocando: false, carregando: true, duracao: 0 });
    try {
      const buffer = await this.carregar(musica);
      if (pedido !== this.pedido) return;
      this.buffer = buffer;
      this.mudar({ carregando: false, duracao: buffer.duration });
      // Música aberta durante a partida fica pronta para tocar quando a partida acabar.
      if (this.suspenso) this.tocavaAntesDeSuspender = true;
      this.continuar();
    } catch {
      if (pedido === this.pedido) this.mudar({ carregando: false });
    }
  }

  private ganho() {
    if (!this.ganhoCriado) {
      this.ganhoCriado = this.contexto().createGain();
      this.ganhoCriado.gain.value = this.volume;
      this.ganhoCriado.connect(saidaDeAudio(this.contexto()));
    }
    return this.ganhoCriado;
  }

  private iniciarFonte() {
    this.pararFonte();
    const contexto = this.contexto();
    const fonte = contexto.createBufferSource();
    fonte.buffer = this.buffer;
    fonte.connect(this.ganho());
    fonte.onended = () => {
      if (fonte === this.fonte) this.proxima();
    };
    fonte.start(0, this.deslocamento);
    this.fonte = fonte;
    this.inicio = contexto.currentTime - this.deslocamento;
  }

  private pararFonte() {
    const fonte = this.fonte;
    this.fonte = null;
    fonte?.stop();
  }

  private mudar(parte: Partial<EstadoDoPlayerDeMusica>) {
    this.estadoAtual = { ...this.estadoAtual, ...parte };
    this.avisar();
  }

  private avisar() {
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}

export const playerDeMusica = new PlayerDeMusica();
