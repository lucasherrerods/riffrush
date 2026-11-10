import { obterContextoDeAudio, saidaDeAudio } from "@/modules/audio";
import { criarCacheLimitado } from "@/shared/lib/cacheLimitado";
import { acaoDeVoltar, vizinhasParaPreCarregar, indiceSorteado, indiceVizinho, pontoAleatorioDeInicio, pontoDeVolta, posicaoNaMusica, type SaidaDaPartida } from "./fila";

/** O que o player toca: as músicas do Rock ou os mapas da biblioteca do Mania. */
export interface FaixaDoPlayer {
  id: string;
  titulo: string;
  artista?: string;
}

/** Quantas vizinhas da música que toca ficam carregadas de antemão, de cada lado da fila. */
export const VIZINHAS_PRE_CARREGADAS = 1;
/** Uma música decodificada ocupa dezenas de MB: só a atual, as vizinhas e uma de folga ficam na memória. */
const MUSICAS_NA_MEMORIA = 2 * VIZINHAS_PRE_CARREGADAS + 2;

/** Quanto tempo o volume leva para sumir ou voltar quando o player cala ou retoma (na troca de modo, por exemplo). */
export const ESMAECER_MS = 600;

/**
 * Se a primeira música da abertura já abriu, em qualquer player: a cortina da abertura espera por ela,
 * sem precisar saber qual modo está montado.
 */
export const primeiraMusica = (() => {
  let pronta = false;
  const ouvintes = new Set<() => void>();
  return {
    pronta: () => pronta,
    inscrever(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => void ouvintes.delete(ouvinte);
    },
    marcar() {
      if (pronta) return;
      pronta = true;
      for (const ouvinte of ouvintes) ouvinte();
    },
    /** Só para os testes. */
    reiniciar() {
      pronta = false;
    },
  };
})();

export interface EstadoDoPlayerDeMusica<F extends FaixaDoPlayer = FaixaDoPlayer> {
  musica: F | null;
  tocando: boolean;
  carregando: boolean;
  duracao: number;
}

type Carregar<F> = (musica: F) => Promise<AudioBuffer>;
/** De onde a música abre, sabendo a duração dela. */
type PontoDeAbertura = (duracao: number) => number;

/** A trilha dos menus de um modo: segue a música que cada tela pede. Cada modo tem o seu, com a própria fila. */
export class PlayerDeMusica<F extends FaixaDoPlayer = FaixaDoPlayer> {
  private estadoAtual: EstadoDoPlayerDeMusica<F> = { musica: null, tocando: false, carregando: false, duracao: 0 };
  private ouvintes = new Set<() => void>();
  private fila: F[] = [];
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
  private pontoAoCarregar: PontoDeAbertura | null = null;
  private carregadas = criarCacheLimitado<Promise<AudioBuffer>>(MUSICAS_NA_MEMORIA);
  private prontas = new Set<string>();

  constructor(
    private contexto: () => AudioContext = obterContextoDeAudio,
    private carregar: Carregar<F>,
    private sortear: () => number = Math.random,
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

  /** A música já está decodificada: trocar para ela é na hora. */
  naMemoria(musica: F) {
    return this.prontas.has(musica.id);
  }

  definirFila(musicas: F[]) {
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
  seguir(musica: F) {
    if (musica.id === this.estadoAtual.musica?.id) return;
    void this.abrir(musica);
  }

  /** Na abertura do jogo: sorteia uma música da fila e a toca num ponto do meio. Se já há música, fica nela. */
  sortearInicio() {
    if (this.estadoAtual.musica) return;
    const sorteada = this.fila[indiceSorteado(this.fila.length, this.sortear())];
    if (sorteada) this.seguirMapa(sorteada);
  }

  /** O mapa escolhido na seleção: uma música nova entra num ponto sorteado do meio dela. */
  seguirMapa(musica: F) {
    if (musica.id === this.estadoAtual.musica?.id) return;
    void this.abrir(musica, (duracao) => pontoAleatorioDeInicio(duracao, this.sortear()));
  }

  /** Depois da partida, a trilha volta para a música dela, no ponto que a saída pede. */
  voltarDaPartida(musica: F, saida: SaidaDaPartida) {
    const ponto: PontoDeAbertura = (duracao) => pontoDeVolta(saida, duracao, this.sortear());
    if (musica.id !== this.estadoAtual.musica?.id) return void this.abrir(musica, ponto);
    if (this.estadoAtual.carregando) this.pontoAoCarregar = ponto;
    else this.irPara(ponto(this.estadoAtual.duracao));
  }

  /** Como `seguir`, mas tira do pause quando é a mesma música: é o botão de ouvir a prévia. */
  ouvir(musica: F) {
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

  /**
   * Na partida a pista toca a própria música, e na troca de modo o outro modo toca a dele:
   * o player cala e volta de onde parou depois. Com `esmaecer`, o volume some e volta aos poucos.
   */
  suspender(suspenso: boolean, { esmaecer = false }: { esmaecer?: boolean } = {}) {
    if (suspenso === this.suspenso) return;
    clearTimeout(this.esmaecendo);
    if (suspenso) {
      this.tocavaAntesDeSuspender = this.estadoAtual.tocando;
      this.suspenso = true;
      if (!esmaecer || !this.estadoAtual.tocando) return this.pausar();
      this.rampa(0);
      this.esmaecendo = setTimeout(() => {
        this.pausar();
        this.rampa(this.volume, 0);
      }, ESMAECER_MS);
      return;
    }
    this.suspenso = false;
    if (!this.tocavaAntesDeSuspender) return;
    if (esmaecer) this.rampa(0, 0);
    if (!this.estadoAtual.tocando) this.continuar();
    if (esmaecer) this.rampa(this.volume);
  }

  private esmaecendo: ReturnType<typeof setTimeout> | undefined;

  /** Leva o volume ao valor pedido, aos poucos. */
  private rampa(valor: number, duracaoMs = ESMAECER_MS) {
    const ganho = this.ganho().gain;
    const agora = this.contexto().currentTime;
    ganho.cancelScheduledValues?.(agora);
    ganho.setValueAtTime(ganho.value, agora);
    if (duracaoMs <= 0) ganho.setValueAtTime(valor, agora);
    else ganho.linearRampToValueAtTime(valor, agora + duracaoMs / 1000);
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

  private async abrir(musica: F, ponto: PontoDeAbertura | null = null) {
    const pedido = ++this.pedido;
    this.pontoAoCarregar = ponto;
    this.pararFonte();
    this.buffer = null;
    this.deslocamento = 0;
    this.mudar({ musica, tocando: false, carregando: true, duracao: 0 });
    try {
      const buffer = await this.carregarGuardando(musica);
      if (pedido !== this.pedido) return;
      this.buffer = buffer;
      if (this.pontoAoCarregar) this.deslocamento = Math.min(Math.max(this.pontoAoCarregar(buffer.duration), 0), buffer.duration);
      this.mudar({ carregando: false, duracao: buffer.duration });
      primeiraMusica.marcar();
      // Música aberta durante a partida fica pronta para tocar quando a partida acabar.
      if (this.suspenso) this.tocavaAntesDeSuspender = true;
      this.continuar();
      void this.preCarregarVizinhas(musica);
    } catch {
      if (pedido === this.pedido) this.mudar({ carregando: false });
      primeiraMusica.marcar();
    }
  }

  /** Carrega uma vez só: o carrossel volta e vai entre as mesmas músicas. */
  private carregarGuardando(musica: F) {
    let carregando = this.carregadas.ler(musica.id);
    if (!carregando) {
      carregando = this.carregar(musica);
      this.carregadas.guardar(musica.id, carregando);
      carregando.then(
        () => this.carregadas.ler(musica.id) === carregando && this.prontas.add(musica.id),
        () => this.carregadas.apagar(musica.id),
      );
    }
    // Só fica marcada como pronta enquanto continua no cache.
    for (const id of this.prontas) if (!this.carregadas.tem(id)) this.prontas.delete(id);
    return carregando;
  }

  /** Uma de cada vez, para não disputar o processador com a música que acabou de abrir. */
  private async preCarregarVizinhas(musica: F) {
    const pedido = this.pedido;
    const atual = this.fila.findIndex((m) => m.id === musica.id);
    for (const indice of vizinhasParaPreCarregar(this.fila.length, atual, VIZINHAS_PRE_CARREGADAS)) {
      if (pedido !== this.pedido) return;
      await this.carregarGuardando(this.fila[indice]).catch(() => undefined);
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

  private mudar(parte: Partial<EstadoDoPlayerDeMusica<F>>) {
    this.estadoAtual = { ...this.estadoAtual, ...parte };
    this.avisar();
  }

  private avisar() {
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}
