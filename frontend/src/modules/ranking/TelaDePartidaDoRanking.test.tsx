import { render, screen, waitFor } from "@testing-library/react";
import { AudioContextFalso } from "@/test/audioFalso";
import type { ApiDoRanking, PartidaDoRanking } from "./api";
import { TelaDePartidaDoRanking } from "./TelaDePartidaDoRanking";

const partida: PartidaDoRanking = {
  id: "p1",
  nome: "Srr 4",
  avatar: null,
  musica_id: "encore:abc",
  dificuldade: "expert",
  instrumento: "baixo",
  pontos: 1_099_340,
  acertos: 990,
  total: 1000,
  maior_sequencia: 512,
  derrota: false,
  fantasma: false,
  jogada_em: "2026-10-20T10:00:00Z",
  tem_replay: false,
};

function abrir(api: Partial<Pick<ApiDoRanking, "partida" | "replay">>, aoAssistir = vi.fn()) {
  const aoVoltar = vi.fn();
  const completa = { partida: vi.fn(async () => partida), replay: vi.fn(async () => Uint8Array.of(1)), ...api };
  render(<TelaDePartidaDoRanking partidaId="p1" titulo="Paint It Black" artista="The Rolling Stones" aoVoltar={aoVoltar} aoAssistir={aoAssistir} api={completa} />);
  return aoVoltar;
}

beforeEach(() => vi.stubGlobal("AudioContext", AudioContextFalso));

describe("TelaDePartidaDoRanking", () => {
  it("busca a partida e mostra as estatísticas de quem jogou", async () => {
    const api = { partida: vi.fn(async () => partida) };
    abrir(api);
    expect(await screen.findByText("Partida de Srr 4")).toBeInTheDocument();
    expect(api.partida).toHaveBeenCalledWith("p1", expect.anything());
    expect(screen.getByText("990 / 1000")).toBeInTheDocument();
    expect(screen.getByText("512")).toBeInTheDocument();
    expect(screen.getByLabelText("1.099.340 pontos")).toBeInTheDocument();
    expect(screen.queryByText(/Tocar de novo/)).not.toBeInTheDocument();
  });

  it("com replay, Assistir baixa o replay e entrega para quem vai tocar", async () => {
    const aoAssistir = vi.fn();
    const replay = vi.fn(async () => Uint8Array.of(1, 2));
    abrir({ partida: vi.fn(async () => ({ ...partida, tem_replay: true })), replay }, aoAssistir);
    (await screen.findByRole("button", { name: /Assistir replay/ })).click();
    await waitFor(() => expect(aoAssistir).toHaveBeenCalledWith(Uint8Array.of(1, 2), expect.objectContaining({ id: "p1", instrumento: "baixo" })));
    expect(replay).toHaveBeenCalledWith("p1");
  });

  it("sem replay, não mostra o botão", async () => {
    abrir({});
    await screen.findByText("Partida de Srr 4");
    expect(screen.queryByRole("button", { name: /Assistir replay/ })).not.toBeInTheDocument();
  });

  it("voltar sai da tela", async () => {
    const aoVoltar = abrir({ partida: vi.fn(async () => partida) });
    (await screen.findByRole("button", { name: /Voltar/ })).click();
    expect(aoVoltar).toHaveBeenCalled();
  });

  it("se a API falhar, avisa e deixa tentar de novo", async () => {
    abrir({ partida: vi.fn(async () => Promise.reject(new Error("fora do ar"))) });
    expect(await screen.findByText(/Não deu para carregar a partida/)).toBeInTheDocument();
  });
});
