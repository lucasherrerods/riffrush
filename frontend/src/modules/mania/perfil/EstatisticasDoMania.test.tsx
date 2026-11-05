import { render, screen } from "@testing-library/react";
import type { EstatisticasDoMania as Estatisticas } from "../ranking/api";
import { EstatisticasDoMania } from "./EstatisticasDoMania";

const numeros: Estatisticas = { partidas: 4, mapas: 2, precisao_media: 0.97, maior_combo: 512, pontuacao_total: 3_000_000, ss: 1, s: 2, no_top: 3, contagem: [100, 50, 10, 5, 2, 1] };

describe("EstatisticasDoMania", () => {
  it("mostra os números do Mania nos cartões do perfil", async () => {
    render(<EstatisticasDoMania carregar={async () => numeros} />);
    expect(await screen.findByRole("region", { name: "Números do Mania" })).toBeInTheDocument();
    expect(screen.getByText("512")).toBeInTheDocument();
    expect(screen.getByText("2 mapas")).toBeInTheDocument();
    expect(screen.getByText("1 SS · 2 S")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Julgamentos" })).toBeInTheDocument();
  });

  it("sem partidas, convida a jogar", async () => {
    render(<EstatisticasDoMania carregar={async () => ({ ...numeros, partidas: 0, mapas: 0, contagem: [0, 0, 0, 0, 0, 0] })} />);
    expect(await screen.findByText(/Nenhuma partida no Mania ainda/)).toBeInTheDocument();
  });
});
