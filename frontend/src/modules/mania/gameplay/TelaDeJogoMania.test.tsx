import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { obterContextoDeAudio } from "@/modules/audio";
import { AudioContextFalso } from "@/test/audioFalso";
import { osu } from "@/test/beatmaps";
import { TelaDeJogoMania, type MapaParaJogar } from "./TelaDeJogoMania";

vi.stubGlobal("AudioContext", AudioContextFalso);

const ENTRADA = 2;
const audio = () => obterContextoDeAudio() as unknown as AudioContextFalso;
/** Faz o relógio do áudio chegar no ms `tempo` do mapa e espera um quadro. */
const irPara = async (tempoMs: number) => {
  await act(async () => {
    audio().currentTime = ENTRADA + tempoMs / 1000;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });
};

// O mapa de teste: nota simples na coluna 0 em 1000 ms e nota longa na coluna 1 de 1500 a 2000 ms.
const mapa: MapaParaJogar = { titulo: "Musica", dificuldade: "Hard", texto: osu(), hash: "abc", audio: new Uint8Array([1]) };
const decodificar = vi.fn(async () => ({}) as AudioBuffer);

let fontesAntes = 0;
beforeEach(() => {
  fontesAntes = audio().fontes.length;
  audio().currentTime = 0;
  vi.clearAllMocks();
});

function abrir(mods = 0) {
  const aoTerminar = vi.fn();
  const aoSair = vi.fn();
  render(<TelaDeJogoMania mapa={mapa} mods={mods} aoTerminar={aoTerminar} aoSair={aoSair} decodificar={decodificar} />);
  return { aoTerminar, aoSair };
}

const pronta = () => waitFor(() => expect(audio().fontes.length).toBeGreaterThan(fontesAntes));

describe("TelaDeJogoMania", () => {
  it("mostra o mapa e toca a música depois da entrada", async () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Musica" })).toBeInTheDocument();
    await pronta();
    const fonte = audio().fontes.at(-1)!;
    expect(fonte.inicio).toBe(ENTRADA);
    expect(fonte.playbackRate.value).toBe(1);
  });

  it("joga o mapa inteiro com as teclas e entrega o resultado com as entradas", async () => {
    const { aoTerminar } = abrir();
    await pronta();
    await irPara(1000);
    fireEvent.keyDown(window, { code: "KeyD" });
    fireEvent.keyUp(window, { code: "KeyD" });
    await irPara(1500);
    fireEvent.keyDown(window, { code: "KeyF" });
    await irPara(2000);
    fireEvent.keyUp(window, { code: "KeyF" });
    await irPara(3300);
    await waitFor(() => expect(aoTerminar).toHaveBeenCalledTimes(1));
    const resultado = aoTerminar.mock.calls[0][0];
    expect(resultado).toMatchObject({ pontuacao: 1_000_000, classificacao: "SS", contagem: [3, 0, 0, 0, 0, 0], maiorCombo: 3, derrota: false, hash: "abc" });
    expect(resultado.entradas.map(([, coluna, toca]: number[]) => [coluna, toca])).toEqual([
      [0, 1],
      [0, 0],
      [1, 1],
      [1, 0],
    ]);
    expect(audio().fontes.at(-1)!.parada).toBe(true);
  });

  it("segurar a tecla não toca de novo", async () => {
    const { aoTerminar } = abrir();
    await pronta();
    await irPara(1000);
    fireEvent.keyDown(window, { code: "KeyD" });
    fireEvent.keyDown(window, { code: "KeyD", repeat: true });
    await irPara(3300);
    await waitFor(() => expect(aoTerminar).toHaveBeenCalled());
    expect(aoTerminar.mock.calls[0][0].entradas).toHaveLength(1);
  });

  it("com DT a música toca a 1,5x", async () => {
    abrir(16);
    await pronta();
    expect(audio().fontes.at(-1)!.playbackRate.value).toBe(1.5);
  });

  it("Esc sai da partida e para a música", async () => {
    const { aoSair, aoTerminar } = abrir();
    await pronta();
    fireEvent.keyDown(window, { code: "Escape" });
    expect(aoSair).toHaveBeenCalled();
    expect(aoTerminar).not.toHaveBeenCalled();
    expect(audio().fontes.at(-1)!.parada).toBe(true);
  });

  describe("treino", () => {
    const abrirTreino = () => {
      const aoTerminar = vi.fn();
      const comDuracao = vi.fn(async () => ({ duration: 10 }) as AudioBuffer);
      render(<TelaDeJogoMania mapa={mapa} aoTerminar={aoTerminar} aoSair={vi.fn()} decodificar={comDuracao} treino />);
      return { aoTerminar, comDuracao };
    };

    it("a música só começa depois de escolher a parte, e a escolha não decodifica o áudio de novo", async () => {
      const { comDuracao } = abrirTreino();
      const parte = await screen.findByRole("button", { name: /Compassos 1–5/ });
      expect(audio().fontes.length).toBe(fontesAntes);
      fireEvent.click(parte);
      await pronta();
      expect(audio().fontes.at(-1)!.inicio).toBe(ENTRADA);
      expect(screen.getByText(/TREINO · Compassos 1–5/)).toBeInTheDocument();
      expect(comDuracao).toHaveBeenCalledTimes(1);
    });

    it("no fim da parte volta para o começo com uma partida nova, conta 3, 2, 1 e nunca entrega resultado", async () => {
      const { aoTerminar } = abrirTreino();
      fireEvent.click(await screen.findByRole("button", { name: /Compassos 1–5/ }));
      await pronta();
      await irPara(1000);
      fireEvent.keyDown(window, { code: "KeyD" });
      fireEvent.keyUp(window, { code: "KeyD" });
      const fontesDaPrimeira = audio().fontes.length;
      await irPara(9600);
      await waitFor(() => expect(audio().fontes.length).toBe(fontesDaPrimeira + 1));
      expect(audio().fontes.at(-2)!.parada).toBe(true);
      expect(audio().fontes.at(-1)!.inicio).toBeCloseTo(ENTRADA + 9.6 + 3);
      await waitFor(() => expect(screen.getByText(/volta 2 · última/)).toBeInTheDocument());
      await irPara(9700);
      expect(screen.getByRole("timer")).toHaveTextContent("3");
      expect(aoTerminar).not.toHaveBeenCalled();
    });

    it("Trocar trecho volta para a escolha e para a música", async () => {
      abrirTreino();
      fireEvent.click(await screen.findByRole("button", { name: /Compassos 1–5/ }));
      await pronta();
      fireEvent.click(screen.getByRole("button", { name: "Trocar trecho" }));
      expect(await screen.findByRole("heading", { name: "Treinar" })).toBeInTheDocument();
      expect(audio().fontes.at(-1)!.parada).toBe(true);
    });
  });

  it("mostra o erro quando o mapa não abre", async () => {
    render(<TelaDeJogoMania mapa={{ ...mapa, texto: "quebrado" }} aoTerminar={vi.fn()} aoSair={vi.fn()} decodificar={decodificar} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não é um arquivo .osu.");
  });
});
