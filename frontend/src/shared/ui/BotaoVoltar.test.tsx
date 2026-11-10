import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BotaoVoltar } from "./BotaoVoltar";

describe("BotaoVoltar", () => {
  it("volta pelo clique", async () => {
    const aoVoltar = vi.fn();
    render(<BotaoVoltar aoVoltar={aoVoltar} />);
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(aoVoltar).toHaveBeenCalledOnce();
  });

  it("volta com o Esc, mesmo com o foco num campo", async () => {
    const aoVoltar = vi.fn();
    render(
      <>
        <BotaoVoltar aoVoltar={aoVoltar} />
        <input aria-label="busca" />
      </>,
    );
    await userEvent.click(screen.getByLabelText("busca"));
    await userEvent.keyboard("{Escape}");
    expect(aoVoltar).toHaveBeenCalledOnce();
  });

  it("com dois na tela, só o mais recente responde ao Esc", async () => {
    const tela = vi.fn();
    const painel = vi.fn();
    const { rerender } = render(<BotaoVoltar aoVoltar={tela} />);
    rerender(
      <>
        <BotaoVoltar aoVoltar={tela} />
        <BotaoVoltar aoVoltar={painel} rotulo="Voltar às músicas" />
      </>,
    );
    await userEvent.keyboard("{Escape}");
    expect(painel).toHaveBeenCalledOnce();
    expect(tela).not.toHaveBeenCalled();

    rerender(<BotaoVoltar aoVoltar={tela} />);
    await userEvent.keyboard("{Escape}");
    expect(tela).toHaveBeenCalledOnce();
  });

  it("não volta com um diálogo aberto: o Esc é dele", async () => {
    const aoVoltar = vi.fn();
    render(
      <>
        <BotaoVoltar aoVoltar={aoVoltar} />
        <div role="dialog" />
      </>,
    );
    await userEvent.keyboard("{Escape}");
    expect(aoVoltar).not.toHaveBeenCalled();
  });
});
