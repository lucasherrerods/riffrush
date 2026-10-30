import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { marcarComoDoControle } from "@/modules/gamepad";
import { EscolhaDeDispositivos } from "./EscolhaDeDispositivos";

const apertar = (code: string, controle?: number) =>
  act(() => {
    const evento = new KeyboardEvent("keydown", { code, bubbles: true });
    if (controle !== undefined) marcarComoDoControle(evento, controle);
    window.dispatchEvent(evento);
  });

function montar() {
  const aoComecar = vi.fn();
  const aoVoltar = vi.fn();
  render(<EscolhaDeDispositivos aoComecar={aoComecar} aoVoltar={aoVoltar} />);
  return { aoComecar, aoVoltar };
}

describe("EscolhaDeDispositivos", () => {
  it("cada jogador entra apertando uma tecla do seu lado ou um botão do controle", () => {
    montar();
    apertar("KeyA");
    apertar("Enter", 1);
    expect(screen.getByText(/Teclado · lado esquerdo/)).toBeInTheDocument();
    expect(screen.getByText("Controle 2")).toBeInTheDocument();
    expect(screen.getAllByText("Aperte um traste para entrar")).toHaveLength(2);
  });

  it("só começa com dois jogadores ou mais, na ordem em que entraram", async () => {
    const { aoComecar } = montar();
    const comecar = screen.getByRole("button", { name: /Começar/ });
    expect(comecar).toBeDisabled();
    apertar("Enter", 0);
    apertar("KeyJ");
    await userEvent.click(comecar);
    expect(aoComecar).toHaveBeenCalledWith([
      { tipo: "controle", indice: 0 },
      { tipo: "teclado", lado: "direita" },
    ]);
  });

  it("avisa do limite do teclado com duas pessoas nele", () => {
    montar();
    apertar("KeyA");
    expect(screen.queryByRole("alert")).toBeNull();
    apertar("KeyJ");
    expect(screen.getByRole("alert")).toHaveTextContent(/teclas ao mesmo tempo/);
  });

  it("tira um jogador pelo botão e volta com o Esc", async () => {
    const { aoVoltar } = montar();
    apertar("KeyA");
    await userEvent.click(screen.getByRole("button", { name: "Tirar o jogador 1" }));
    expect(screen.getAllByText("Aperte um traste para entrar")).toHaveLength(4);
    apertar("Escape");
    expect(aoVoltar).toHaveBeenCalled();
  });
});
