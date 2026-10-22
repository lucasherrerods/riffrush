import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PALETAS } from "./catalogo";
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

  it("muda a prévia ao escolher um instrumento", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Instrumento/ }));
    await usuario.click(screen.getByRole("radio", { name: "Bateria" }));
    expect(screen.getByRole("radio", { name: "Bateria" })).toBeChecked();
    expect(screen.getByRole("img", { name: "Personagem Rockstar" })).toHaveAttribute("data-instrumento", "bateria");
  });

  it("separa a customização em abas de corpo, rosto, cabelo, roupa e instrumento", () => {
    abrir();
    for (const aba of ["Corpo", "Rosto", "Cabelo", "Roupa", "Instrumento"]) expect(screen.getByRole("tab", { name: new RegExp(aba) })).toBeInTheDocument();
  });

  it("ajusta o corpo com sliders", () => {
    abrir();
    expect(screen.getByRole("slider", { name: "Altura" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Porte físico" })).toBeInTheDocument();
  });

  it("salva o personagem com as mudanças", async () => {
    const { aoSalvar, usuario } = abrir();
    await usuario.clear(screen.getByLabelText("Nome"));
    await usuario.type(screen.getByLabelText("Nome"), "Vitor");
    await usuario.click(screen.getByRole("tab", { name: /Rosto/ }));
    await usuario.click(screen.getByRole("radio", { name: "Alegre" }));
    await usuario.click(screen.getByRole("tab", { name: /Roupa/ }));
    await usuario.click(screen.getByRole("radio", { name: "Roupa 2" }));
    await usuario.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(aoSalvar).toHaveBeenCalledWith({ ...PERSONAGEM_PADRAO, nome: "Vitor", expressao: "alegre", cores: { ...PERSONAGEM_PADRAO.cores, roupa: PALETAS.roupa[1] } });
  });

  it("volta uma cor para a original do modelo", async () => {
    const { aoSalvar, usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: /Cabelo/ }));
    await usuario.click(screen.getByRole("radio", { name: "Cor do cabelo 1" }));
    await usuario.click(screen.getByRole("radio", { name: "Original" }));
    await usuario.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(aoSalvar).toHaveBeenCalledWith(PERSONAGEM_PADRAO);
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
    expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ nome: "Rockstar", instrumento: "vocal", expressao: "alegre" }));
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
