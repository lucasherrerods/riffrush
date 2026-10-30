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
  it("mostra a prévia do personagem atual, com o instrumento dele", () => {
    abrir();
    expect(screen.getByRole("img", { name: "Personagem Rockstar" })).toHaveAttribute("data-instrumento", "guitarra");
    expect(screen.getByRole("radio", { name: "Faísca" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Clássico" })).toBeChecked();
  });

  it("não tem mais customização de corpo, cores ou roupa", () => {
    abrir();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("salva o nome com o personagem escolhido", async () => {
    const { aoSalvar, usuario } = abrir();
    await usuario.clear(screen.getByLabelText("Nome"));
    await usuario.type(screen.getByLabelText("Nome"), "Vitor");
    await usuario.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(aoSalvar).toHaveBeenCalledWith({ versao: 4, nome: "Vitor", personagem: "faisca", skin: "classico" });
  });

  it("não deixa salvar sem nome", async () => {
    const { usuario } = abrir();
    await usuario.clear(screen.getByLabelText("Nome"));
    expect(screen.getByRole("button", { name: /Salvar/ })).toBeDisabled();
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

  it("com a conta conectada, mostra o nome do Google sem deixar trocar", () => {
    render(<TelaDePersonagem personagem={PERSONAGEM_PADRAO} nomeDaConta="Lucas Herrero" aoSalvar={vi.fn()} aoVoltar={vi.fn()} />);
    const campo = screen.getByLabelText("Nome");
    expect(campo).toHaveValue("Lucas Herrero");
    expect(campo).toBeDisabled();
    expect(screen.getByText("Lucas Herrero")).toBeInTheDocument();
  });
});
