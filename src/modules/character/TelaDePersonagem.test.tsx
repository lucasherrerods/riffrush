import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERSONAGEM_PADRAO } from "./personagem";
import { TelaDePersonagem } from "./TelaDePersonagem";

function abrir() {
  const aoSalvar = vi.fn();
  const aoVoltar = vi.fn();
  render(<TelaDePersonagem personagem={PERSONAGEM_PADRAO} aoSalvar={aoSalvar} aoVoltar={aoVoltar} />);
  return { aoSalvar, aoVoltar, usuario: userEvent.setup() };
}

describe("TelaDePersonagem", () => {
  it("mostra a prévia do personagem atual", () => {
    abrir();
    expect(screen.getByRole("img", { name: "Personagem Rockstar" })).toBeInTheDocument();
  });

  it("muda a prévia ao escolher uma opção", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("radio", { name: "Bateria" }));
    expect(screen.getByRole("radio", { name: "Bateria" })).toBeChecked();
    expect(document.querySelector('[data-parte="instrumento-bateria"]')).not.toBeNull();
  });

  it("salva o personagem com as mudanças", async () => {
    const { aoSalvar, usuario } = abrir();
    await usuario.clear(screen.getByLabelText("Nome"));
    await usuario.type(screen.getByLabelText("Nome"), "Vitor");
    await usuario.click(screen.getByRole("radio", { name: "Coroa" }));
    await usuario.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(aoSalvar).toHaveBeenCalledWith({ ...PERSONAGEM_PADRAO, nome: "Vitor", acessorio: "coroa" });
  });

  it("não deixa salvar sem nome", async () => {
    const { usuario } = abrir();
    await usuario.clear(screen.getByLabelText("Nome"));
    expect(screen.getByRole("button", { name: /Salvar/ })).toBeDisabled();
  });

  it("sorteia um visual novo mantendo o nome", async () => {
    const sorteio = vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { aoSalvar, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: /Aleatório/ }));
    await usuario.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ nome: "Rockstar", instrumento: "vocal", acessorio: "coroa" }));
    sorteio.mockRestore();
  });

  it("Esc volta, mas não enquanto digita o nome", async () => {
    const { aoVoltar, usuario } = abrir();
    await usuario.click(screen.getByLabelText("Nome"));
    await usuario.keyboard("{Escape}");
    expect(aoVoltar).not.toHaveBeenCalled();
    await usuario.click(document.body);
    await usuario.keyboard("{Escape}");
    expect(aoVoltar).toHaveBeenCalled();
  });
});
