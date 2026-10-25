import { act, render, screen } from "@testing-library/react";
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

function abrir() {
  const aoSair = vi.fn();
  render(
    <TelaDeEspectador
      pessoa={ana}
      musicas={MUSICAS_DE_TESTE}
      opcoes={OPCOES_PADRAO_DA_PARTIDA}
      personagem={PERSONAGEM_PADRAO}
      aoSair={aoSair}
      aoBuscarMusicas={vi.fn()}
      urlDoRelay="wss://relay"
      criarSocket={(url) => new WebSocketFalso(url)}
    />,
  );
  return { aoSair, socket: WebSocketFalso.ultimo! };
}

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
