import { AudioBufferFalso, AudioContextFalso, type FonteFalsa } from "@/test/audioFalso";
import type { Musica } from "@/modules/songs";
import { PlayerDeMusica } from "./playerDeMusica";

const musica = (id: string) => ({ id, titulo: id }) as Musica;
const fila = [musica("a"), musica("b"), musica("c")];
const buffer = (duracao = 100) => new AudioBufferFalso([new Float32Array(duracao)], 1) as unknown as AudioBuffer;
const esperar = () => new Promise((r) => setTimeout(r));
type Fonte = FonteFalsa & { onended?: () => void };

function montar(carregar: (m: Musica) => Promise<AudioBuffer> = vi.fn(async () => buffer())) {
  const contexto = new AudioContextFalso();
  const player = new PlayerDeMusica(() => contexto as unknown as AudioContext, carregar);
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
    expect(carregar).toHaveBeenCalledTimes(1);
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
    const { player, carregar } = montar();
    const navegar = vi.fn();
    player.seguir(fila[0]);
    await esperar();
    player.definirNavegacao(navegar);
    player.proxima();
    player.anterior();
    expect(navegar.mock.calls).toEqual([[1], [-1]]);
    expect(carregar).toHaveBeenCalledTimes(1);
    player.definirNavegacao(null);
    player.proxima();
    expect(player.estado().musica).toBe(fila[1]);
  });
});
