import { render, screen } from "@testing-library/react";
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
};

function abrir(api: Pick<ApiDoRanking, "partida">) {
  const aoVoltar = vi.fn();
  render(<TelaDePartidaDoRanking partidaId="p1" titulo="Paint It Black" artista="The Rolling Stones" aoVoltar={aoVoltar} api={api} />);
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
