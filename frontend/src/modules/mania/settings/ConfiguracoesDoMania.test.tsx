import { fireEvent, render, screen } from "@testing-library/react";
import { ConfiguracoesDoMania } from "./ConfiguracoesDoMania";
import { carregarConfiguracoesDoMania } from "./configuracoesMania";

it("salva cada mudança feita na janela", () => {
  const antes = carregarConfiguracoesDoMania();
  render(<ConfiguracoesDoMania aoFechar={vi.fn()} />);
  const faixa = screen.getAllByRole("slider")[0] as HTMLInputElement;
  const novo = Number(faixa.value) === Number(faixa.min) ? Number(faixa.value) + Number(faixa.step) : Number(faixa.min);
  fireEvent.change(faixa, { target: { value: String(novo) } });
  expect(carregarConfiguracoesDoMania()).not.toEqual(antes);
});
