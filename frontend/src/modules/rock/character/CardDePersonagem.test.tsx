import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardDePersonagem } from "./CardDePersonagem";

describe("CardDePersonagem", () => {
  it("mostra a arte e o nome, e avisa quando está escolhido", () => {
    render(<CardDePersonagem rotulo="Faísca" card="/faisca.webp" escolhido aoEscolher={vi.fn()} />);
    const card = screen.getByRole("radio", { name: "Faísca" });
    expect(card).toBeChecked();
    expect(card.querySelector("img")).toHaveAttribute("src", "/faisca.webp");
  });

  it("sem arte, mostra só o nome", () => {
    render(<CardDePersonagem rotulo="Baixista" card={null} escolhido={false} aoEscolher={vi.fn()} />);
    const card = screen.getByRole("radio", { name: "Baixista" });
    expect(card).not.toBeChecked();
    expect(card.querySelector("img")).toBeNull();
    expect(card).toHaveTextContent("Baixista");
  });

  it("escolhe ao clicar", async () => {
    const aoEscolher = vi.fn();
    render(<CardDePersonagem rotulo="Faísca" card="/faisca.webp" escolhido={false} aoEscolher={aoEscolher} />);
    await userEvent.click(screen.getByRole("radio", { name: "Faísca" }));
    expect(aoEscolher).toHaveBeenCalled();
  });
});
