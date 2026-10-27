import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ModalDeModificadores } from "./ModalDeModificadores";

function Abrir({ inicial = 1 }: { inicial?: number }) {
  const [velocidadeDaMusica, setVelocidade] = useState(inicial);
  return <ModalDeModificadores aberto aoMudarAberto={() => {}} velocidadeDaMusica={velocidadeDaMusica} aoMudarVelocidade={setVelocidade} />;
}

describe("ModalDeModificadores", () => {
  it("começa sem modificador ativo e com multiplicador 1x", () => {
    render(<Abrir />);
    expect(screen.getByText("Multiplicador de pontos: 1x")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Velocidade/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("cada clique na velocidade muda o nível, mostra a velocidade ao lado e o multiplicador no topo", async () => {
    const usuario = userEvent.setup();
    render(<Abrir />);
    const velocidade = screen.getByRole("button", { name: /Velocidade/ });

    await usuario.click(velocidade);
    expect(velocidade).toHaveAttribute("aria-pressed", "true");
    expect(velocidade).toHaveTextContent("1,25x");
    expect(screen.getByText("Multiplicador de pontos: 1,25x")).toBeInTheDocument();

    await usuario.click(velocidade);
    await usuario.click(velocidade);
    expect(velocidade).toHaveTextContent("0,5x");
    expect(screen.getByText("Multiplicador de pontos: 0,5x")).toBeInTheDocument();
  });

  it("o botão direito volta um nível", async () => {
    const usuario = userEvent.setup();
    render(<Abrir inicial={1.25} />);
    await usuario.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: /Velocidade/ }) });
    expect(screen.getByRole("button", { name: /Velocidade/ })).toHaveAttribute("aria-pressed", "false");
  });
});
