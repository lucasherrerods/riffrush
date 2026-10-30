import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Resultado } from "@/modules/rock/gameplay";
import { ResultadoDaTelaDividida } from "./ResultadoDaTelaDividida";

const resultado = (pontos: number, precisao: number): Resultado => ({ musicaId: "m", dificuldade: "medio", pontos, acertos: 5, total: 10, precisao, maiorSequencia: 4, derrota: false });

function montar() {
  const aoRepetir = vi.fn();
  const aoContinuar = vi.fn();
  render(
    <ResultadoDaTelaDividida
      titulo="Neon Highway"
      artista="Banda"
      resultados={[
        { nome: "P1", resultado: resultado(1200, 0.5) },
        { nome: "P2", resultado: resultado(3400, 0.9) },
      ]}
      aoRepetir={aoRepetir}
      aoContinuar={aoContinuar}
    />,
  );
  return { aoRepetir, aoContinuar };
}

describe("ResultadoDaTelaDividida", () => {
  it("mostra cada jogador do primeiro ao último, com pontos e precisão", () => {
    montar();
    const linhas = screen.getAllByRole("listitem");
    expect(within(linhas[0]).getByText("P2")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("3.400")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("90%")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("P1")).toBeInTheDocument();
  });

  it("tocar de novo e escolher outra música avisam a tela de cima", async () => {
    const { aoRepetir, aoContinuar } = montar();
    await userEvent.click(screen.getByRole("button", { name: /Tocar de novo/ }));
    await userEvent.click(screen.getByRole("button", { name: /Outra música/ }));
    expect(aoRepetir).toHaveBeenCalled();
    expect(aoContinuar).toHaveBeenCalled();
  });
});
