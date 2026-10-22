import { render, screen, within } from "@testing-library/react";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { estadoInicial, type EstadoDaSala } from "../protocolo";
import { Placar } from "./Placar";

const nomes = ["Lucas", "Vitor", "Ana"];
const jogada = (pontos: number, terminou = true, derrota = false) => ({ pontos, vida: 0.5, sequencia: 0, pulso: 0, derrota, terminou });

function sala(adversarios: EstadoDaSala["adversarios"]): EstadoDaSala {
  return {
    ...estadoInicial(PERSONAGEM_PADRAO, true),
    meuId: 1,
    jogadores: nomes.map((nome, i) => ({ id: i + 1, personagem: { ...PERSONAGEM_PADRAO, nome } })),
    adversarios,
  };
}

describe("Placar", () => {
  it("ordena os jogadores por pontos, usando o meu resultado final", () => {
    render(<Placar sala={sala({ 2: jogada(900), 3: jogada(1500) })} meusPontos={1200} minhaDerrota={false} />);
    const linhas = screen.getAllByRole("listitem").map((l) => within(l).getByText(/Lucas|Vitor|Ana/).textContent);
    expect(linhas).toEqual(["Ana", "Lucas", "Vitor"]);
  });

  it("enquanto alguém ainda toca, espera e não coroa ninguém", () => {
    render(<Placar sala={sala({ 2: jogada(900, false), 3: jogada(100) })} meusPontos={1200} minhaDerrota={false} />);
    expect(screen.getByText(/Esperando os outros terminarem/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Vencedor")).toBeNull();
  });

  it("quando todos terminam, coroa o primeiro", () => {
    render(<Placar sala={sala({ 2: jogada(900), 3: jogada(100) })} meusPontos={1200} minhaDerrota={false} />);
    expect(within(screen.getAllByRole("listitem")[0]).getByLabelText("Vencedor")).toBeInTheDocument();
  });

  it("marca quem foi vaiado", () => {
    render(<Placar sala={sala({ 2: jogada(0, true, true), 3: jogada(100) })} meusPontos={10} minhaDerrota={false} />);
    expect(screen.getByText("Vaiado")).toBeInTheDocument();
  });
});
