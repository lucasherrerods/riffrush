import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EscolhaDoTreino } from "./EscolhaDoTreino";

const trechos = [
  { nome: "Intro", inicio: 0, fim: 8 },
  { nome: "Riff", inicio: 8, fim: 75 },
];

describe("EscolhaDoTreino", () => {
  it("lista os trechos com a duração e começa o escolhido", async () => {
    const aoComecar = vi.fn();
    render(<EscolhaDoTreino trechos={trechos} velocidade={1} contagem aoContagem={vi.fn()} aoComecar={aoComecar} aoSair={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Riff.*1:07/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Intro/ }));
    expect(aoComecar).toHaveBeenCalledWith(trechos[0]);
  });

  it("liga e desliga a contagem antes de repetir", async () => {
    const aoContagem = vi.fn();
    render(<EscolhaDoTreino trechos={trechos} velocidade={0.75} contagem aoContagem={aoContagem} aoComecar={vi.fn()} aoSair={vi.fn()} />);
    expect(screen.getByText(/0,75x/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Contagem antes de repetir" }));
    expect(aoContagem).toHaveBeenCalledWith(false);
  });
});
