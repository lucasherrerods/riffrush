import { AudioBufferFalso, AudioContextFalso, type FonteFalsa } from "@/test/audioFalso";
import { PlayerDeMusica } from "./playerDeMusica";

const musica = (id: string) => ({ id, titulo: id });
type Musica = ReturnType<typeof musica>;
const fila = [musica("a"), musica("b"), musica("c")];
const buffer = (duracao = 100) => new AudioBufferFalso([new Float32Array(duracao)], 1) as unknown as AudioBuffer;
const esperar = () => new Promise((r) => setTimeout(r));
/** Quantas vezes a música foi carregada: as vizinhas também carregam, de antemão. */
const vezes = (carregar: unknown, id: string) => vi.mocked(carregar as (m: Musica) => Promise<AudioBuffer>).mock.calls.filter(([m]) => m.id === id).length;
type Fonte = FonteFalsa & { onended?: () => void };

function montar(carregar: (m: Musica) => Promise<AudioBuffer> = vi.fn(async () => buffer()), sortear = () => 0.5) {
  const contexto = new AudioContextFalso();
  const player = new PlayerDeMusica(() => contexto as unknown as AudioContext, carregar, sortear);
  player.definirFila(fila);
  const ultimaFonte = () => contexto.fontes.at(-1) as Fonte;
  return { contexto, player, carregar, ultimaFonte };
}

describe("PlayerDeMusica", () => {
  it("toca a música pedida assim que carrega", async () => {
    const { player, ultimaFonte } = montar();
    player.seguir(fila[0]);
    expect(player.estado()).toMatchObject({ musica: fila[0], carregando: true, tocando: false });
    await esperar();
    expect(player.estado()).toMatchObject({ carregando: false, tocando: true, duracao: 100 });
    expect(ultimaFonte().deslocamento).toBe(0);
  });

  it("pedir a mesma música não recomeça", async () => {
    const { player, carregar } = montar();
    player.seguir(fila[0]);
    await esperar();
    player.seguir(fila[0]);
    expect(vezes(carregar, "a")).toBe(1);
  });

  it("ouvir a música que já está pausada continua de onde parou; outra música começa do início", async () => {
    const { player, carregar } = montar();
    player.seguir(fila[0]);
    await esperar();
    player.alternar();
    player.ouvir(fila[0]);
    expect(player.estado()).toMatchObject({ musica: fila[0], tocando: true });
    expect(vezes(carregar, "a")).toBe(1);
    player.ouvir(fila[1]);
    await esperar();
    expect(player.estado()).toMatchObject({ musica: fila[1], tocando: true });
  });

  it("descarta a música que terminou de carregar depois de outro pedido", async () => {
    let soltarA!: (b: AudioBuffer) => void;
    const { player } = montar((m) => (m.id === "a" ? new Promise<AudioBuffer>((r) => (soltarA = r)) : Promise.resolve(buffer(50))));
    player.seguir(fila[0]);
    player.seguir(fila[1]);
    await esperar();
    soltarA(buffer(100));
    await esperar();
    expect(player.estado()).toMatchObject({ musica: fila[1], duracao: 50 });
  });

  it("pausa e continua de onde parou", async () => {
    const { player, contexto, ultimaFonte } = montar();
    player.seguir(fila[0]);
    await esperar();
    contexto.currentTime = 20;
    player.alternar();
    expect(player.estado().tocando).toBe(false);
    expect(ultimaFonte().parada).toBe(true);
    contexto.currentTime = 50;
    expect(player.posicao()).toBe(20);
    player.alternar();
    expect(ultimaFonte().deslocamento).toBe(20);
  });

  it("avança e volta pela fila, dando a volta nas pontas", async () => {
    const { player } = montar();
    player.seguir(fila[2]);
    await esperar();
    player.proxima();
    expect(player.estado().musica).toBe(fila[0]);
    await esperar();
    player.anterior();
    expect(player.estado().musica).toBe(fila[2]);
  });

  it("voltar depois de alguns segundos reinicia a mesma música", async () => {
    const { player, contexto, ultimaFonte } = montar();
    player.seguir(fila[1]);
    await esperar();
    contexto.currentTime = 10;
    player.anterior();
    expect(player.estado().musica).toBe(fila[1]);
    expect(ultimaFonte().deslocamento).toBe(0);
  });

  it("o slider leva a música para o tempo escolhido", async () => {
    const { player, ultimaFonte } = montar();
    player.seguir(fila[0]);
    await esperar();
    player.irPara(60);
    expect(ultimaFonte().deslocamento).toBe(60);
  });

  it("quando a música acaba, toca a próxima", async () => {
    const { player, ultimaFonte } = montar();
    player.seguir(fila[0]);
    await esperar();
    ultimaFonte().onended?.();
    expect(player.estado().musica).toBe(fila[1]);
  });

  it("parar a fonte de propósito não pula de música", async () => {
    const { player, ultimaFonte } = montar();
    player.seguir(fila[0]);
    await esperar();
    const fonte = ultimaFonte();
    player.alternar();
    fonte.onended?.();
    expect(player.estado().musica).toBe(fila[0]);
  });

  it("suspenso na partida, cala e depois volta tocando", async () => {
    const { player } = montar();
    player.seguir(fila[0]);
    await esperar();
    player.suspender(true);
    expect(player.estado().tocando).toBe(false);
    player.alternar();
    expect(player.estado().tocando).toBe(false);
    player.suspender(false);
    expect(player.estado().tocando).toBe(true);
  });

  it("ao abrir o jogo, sorteia uma música da fila e a toca num ponto do meio", async () => {
    const { player, ultimaFonte } = montar(undefined, () => 0.5);
    player.sortearInicio();
    await esperar();
    expect(player.estado().musica).toBe(fila[1]);
    expect(ultimaFonte().deslocamento).toBe(50);
  });

  it("com uma música já tocando, o sorteio da abertura não faz nada", async () => {
    const { player } = montar();
    player.seguir(fila[2]);
    player.sortearInicio();
    expect(player.estado().musica).toBe(fila[2]);
  });

  it("ao trocar de mapa, a música nova começa num ponto sorteado entre 30% e 70%", async () => {
    const { player, ultimaFonte } = montar(undefined, () => 0.25);
    player.seguirMapa(fila[1]);
    await esperar();
    expect(ultimaFonte().deslocamento).toBe(40);
  });

  it("o mapa que já está tocando não pula para outro ponto", async () => {
    const { player, carregar } = montar();
    player.seguir(fila[0]);
    await esperar();
    player.seguirMapa(fila[0]);
    expect(vezes(carregar, "a")).toBe(1);
  });

  it("depois da partida, continua a música dela de onde o jogador saiu", async () => {
    const { player, ultimaFonte } = montar();
    player.seguirMapa(fila[0]);
    await esperar();
    player.suspender(true);
    player.voltarDaPartida(fila[0], 72);
    player.suspender(false);
    expect(player.estado().tocando).toBe(true);
    expect(ultimaFonte().deslocamento).toBe(72);
  });

  it("se a partida foi de outra música, abre ela no ponto da saída", async () => {
    const { player, ultimaFonte } = montar();
    player.seguir(fila[0]);
    await esperar();
    player.suspender(true);
    player.voltarDaPartida(fila[2], 15);
    await esperar();
    player.suspender(false);
    expect(player.estado()).toMatchObject({ musica: fila[2], tocando: true });
    expect(ultimaFonte().deslocamento).toBe(15);
  });

  it("se a música não carrega, para de carregar sem tocar", async () => {
    const { player } = montar(() => Promise.reject(new Error("sem áudio")));
    player.seguir(fila[0]);
    await esperar();
    expect(player.estado()).toMatchObject({ carregando: false, tocando: false });
  });

  it("aplica o volume da música", async () => {
    const { player, contexto } = montar();
    player.definirVolume(0.3);
    player.seguir(fila[0]);
    await esperar();
    expect(contexto.ganhos[0].gain.value).toBe(0.3);
  });

  it("com uma navegação definida, avançar e voltar ficam com a tela", async () => {
    const { player } = montar();
    const navegar = vi.fn();
    player.seguir(fila[0]);
    await esperar();
    player.definirNavegacao(navegar);
    player.proxima();
    player.anterior();
    expect(navegar.mock.calls).toEqual([[1], [-1]]);
    expect(player.estado().musica).toBe(fila[0]);
    player.definirNavegacao(null);
    player.proxima();
    expect(player.estado().musica).toBe(fila[1]);
  });

  it("depois de tocar, deixa as vizinhas da fila prontas: trocar para elas não carrega de novo", async () => {
    const { player, carregar } = montar();
    player.seguir(fila[0]);
    await esperar();
    await esperar();
    await esperar();
    expect(vi.mocked(carregar).mock.calls.map(([m]) => m.id)).toEqual(["a", "b", "c"]);
    expect(player.naMemoria(fila[1])).toBe(true);
    player.seguir(fila[1]);
    expect(player.estado()).toMatchObject({ musica: fila[1] });
    await esperar();
    expect(player.estado()).toMatchObject({ tocando: true });
    expect(carregar).toHaveBeenCalledTimes(3);
  });

  it("pré-carregar uma música que falha não quebra nada e tenta de novo quando pedida", async () => {
    const carregar = vi.fn(async (m: Musica) => {
      if (m.id === "b" && carregar.mock.calls.filter(([x]) => x.id === "b").length === 1) throw new Error("falhou");
      return buffer();
    });
    const { player } = montar(carregar);
    player.seguir(fila[0]);
    for (let i = 0; i < 4; i++) await esperar();
    expect(player.naMemoria(fila[1])).toBe(false);
    player.seguir(fila[1]);
    await esperar();
    expect(player.estado()).toMatchObject({ musica: fila[1], tocando: true });
  });
});

describe("primeira música", () => {
  it("avisa quando a primeira música de um player termina de abrir, mesmo que falhe", async () => {
    const { primeiraMusica } = await import("./playerDeMusica");
    primeiraMusica.reiniciar();
    const { player } = montar(async () => {
      throw new Error("sem áudio");
    });
    expect(primeiraMusica.pronta()).toBe(false);
    player.seguir(fila[0]);
    await esperar();
    expect(primeiraMusica.pronta()).toBe(true);
  });
});
