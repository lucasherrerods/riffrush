import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { OPCOES_PADRAO_DA_PARTIDA, hashDoChart } from "@/modules/gameplay";
import { carregarMusica, idDoRanking, type Nota } from "@/modules/songs";
import { AudioContextFalso } from "@/test/audioFalso";
import { MUSICAS_DE_TESTE } from "@/test/musicas";
import { WebSocketFalso } from "@/test/websocketFalso";
import { inicioParaAssistir, precisaSincronizar } from "./espectador";
import type { PessoaOnline } from "./protocolo";
import { TelaDeEspectador } from "./TelaDeEspectador";

vi.mock("@/modules/songs", async (original) => ({
  ...(await original<typeof import("@/modules/songs")>()),
  carregarMusica: vi.fn(),
}));
vi.stubGlobal("AudioContext", AudioContextFalso);

const notas: Nota[] = [{ tempo: 0.5, pista: 0, duracao: 0, frase: -1 }];
const musica = MUSICAS_DE_TESTE[0];
const ana: PessoaOnline = {
  id: "conta-ana",
  nome: "Ana",
  avatar: null,
  estado: { tipo: "tocando", musica: idDoRanking(musica), titulo: musica.titulo, artista: musica.artista, dificuldade: "medio", instrumento: "guitarra", transmitindo: true },
};

function abrir({ musicas = MUSICAS_DE_TESTE, aoBaixar = vi.fn(async () => {}) } = {}) {
  const aoSair = vi.fn();
  const elemento = (lista: typeof musicas) => (
    <TelaDeEspectador
      pessoa={ana}
      musicas={lista}
      opcoes={OPCOES_PADRAO_DA_PARTIDA}
      personagem={PERSONAGEM_PADRAO}
      aoSair={aoSair}
      aoBuscarMusicas={vi.fn()}
      aoBaixar={aoBaixar}
      urlDoRelay="wss://relay"
      criarSocket={criarSocket}
    />
  );
  const { rerender } = render(elemento(musicas));
  return { aoSair, aoBaixar, socket: WebSocketFalso.ultimo!, trocarMusicas: (lista: typeof musicas) => rerender(elemento(lista)) };
}

// Fora do componente: a mesma função entre renderizações não reabre a conexão.
const criarSocket = (url: string) => new WebSocketFalso(url);

beforeEach(() => vi.mocked(carregarMusica).mockResolvedValue({ audio: {} as AudioBuffer, notas, batidas: [], duracao: 10 }));

describe("TelaDeEspectador", () => {
  it("abre a transmissão da pessoa sem ficha, só para receber", () => {
    const { socket } = abrir();
    expect(socket.url).toBe("wss://relay/transmissao/conta-ana");
  });

  it("com o início e o primeiro lote, monta a mesma partida ao vivo", async () => {
    const { socket } = abrir();
    const partida = { musica: idDoRanking(musica), dificuldade: "medio", instrumento: "guitarra", hashDoChart: await hashDoChart(notas), semFalha: false };
    act(() => socket.entregar({ tipo: "inicio", partida }));
    act(() => socket.entregar({ tipo: "lote", ate: 3, entradas: [[500, 0]] }));
    expect(await screen.findByText("AO VIVO")).toBeInTheDocument();
    expect(screen.getByText("Assistindo Ana")).toBeInTheDocument();
  });

  it("música que eu não tenho: avisa em vez de tocar", () => {
    const { socket } = abrir();
    act(() => socket.entregar({ tipo: "inicio", partida: { musica: "encore:naotenho", dificuldade: "medio", instrumento: "guitarra", hashDoChart: "a".repeat(32), semFalha: false } }));
    expect(screen.getByText(/precisa ter a música/)).toBeInTheDocument();
  });

  it("sem partida no ar, avisa", () => {
    const { socket } = abrir();
    act(() => socket.entregar({ tipo: "semPartida" }));
    expect(screen.getByText("Ana não está transmitindo uma partida agora.")).toBeInTheDocument();
  });

  it("quem joga pausou: mostra a pausa", async () => {
    const { socket } = abrir();
    act(() => socket.entregar({ tipo: "inicio", partida: { musica: idDoRanking(musica), dificuldade: "medio", instrumento: "guitarra", hashDoChart: "a".repeat(32), semFalha: false } }));
    act(() => socket.entregar({ tipo: "pausa", pausado: true }));
    expect(screen.getByText("Ana pausou a partida.")).toBeInTheDocument();
  });
});

describe("baixar e assistir", () => {
  const md5 = "0123456789abcdef0123456789abcdef";
  const url = `https://files.enchor.us/${md5}.sng`;
  const partidaDoEncore = async (urlDoEncore: string) => ({
    musica: `encore:${md5}`,
    dificuldade: "medio",
    instrumento: "guitarra",
    hashDoChart: await hashDoChart(notas),
    semFalha: false,
    urlDoEncore,
  });

  it("com o link do chart, baixa com um clique e entra ao vivo quando a música chega", async () => {
    const { socket, aoBaixar, trocarMusicas } = abrir();
    const partida = await partidaDoEncore(url);
    act(() => socket.entregar({ tipo: "inicio", partida }));
    act(() => socket.entregar({ tipo: "lote", ate: 3, entradas: [[500, 0]] }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Baixar e assistir" }));
    expect(aoBaixar).toHaveBeenCalledWith(url, md5);

    trocarMusicas([...MUSICAS_DE_TESTE, { ...musica, id: "baixada", md5DoEncore: md5 }]);
    act(() => socket.entregar({ tipo: "lote", ate: 4, entradas: [] }));
    expect(await screen.findByText("AO VIVO")).toBeInTheDocument();
  });

  it("link que não é do Encore ou é de outra música não vira botão", async () => {
    for (const ruim of ["https://evil.com/x.sng", `https://files.enchor.us/${"f".repeat(32)}.sng`]) {
      const { socket } = abrir();
      const partida = await partidaDoEncore(ruim);
      act(() => socket.entregar({ tipo: "inicio", partida }));
      expect(screen.queryByRole("button", { name: "Baixar e assistir" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Buscar músicas/ })).toBeInTheDocument();
      cleanup();
    }
  });

  it("se o download falhar, mostra o motivo", async () => {
    const { socket } = abrir({ aoBaixar: vi.fn(async () => Promise.reject(new Error("Esse chart não está mais no Encore."))) });
    const partida = await partidaDoEncore(url);
    act(() => socket.entregar({ tipo: "inicio", partida }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Baixar e assistir" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esse chart não está mais no Encore.");
  });
});

describe("sincronização", () => {
  it("quem assiste fica 2 s atrás de quem joga", () => {
    expect(inicioParaAssistir(10_000, 5)).toBe(7_000);
  });

  it("só recomeça quando sai mais de 1,5 s do ponto certo", () => {
    const inicio = inicioParaAssistir(10_000, 5);
    expect(precisaSincronizar(11_000, inicio, 6)).toBe(false);
    expect(precisaSincronizar(11_000, inicio, 6.4)).toBe(false);
    expect(precisaSincronizar(11_000, inicio, 8)).toBe(true);
  });
});
