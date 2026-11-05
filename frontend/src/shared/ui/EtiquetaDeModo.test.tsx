import { render, screen } from "@testing-library/react";
import { TEMAS } from "@/shared/styles/tokens";
import { EtiquetaDeModo } from "./EtiquetaDeModo";

describe("EtiquetaDeModo", () => {
  it("mostra o nome do modo com as cores do tema dele", () => {
    render(<EtiquetaDeModo modo="mania" />);
    const etiqueta = screen.getByText("Mania");
    expect(etiqueta.style.getPropertyValue("--cor-primaria")).toBe(TEMAS.mania.cores.primaria);
  });

  it("o Rock leva as cores do Rock", () => {
    render(<EtiquetaDeModo modo="rock" />);
    expect(screen.getByText("Rock").style.getPropertyValue("--cor-primaria")).toBe(TEMAS.riffRush.cores.primaria);
  });
});
