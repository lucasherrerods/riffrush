import { render } from "@testing-library/react";
import { TEMAS } from "@/shared/styles/tokens";
import { CapaDaVolvelle, Volvelle } from "./Volvelle";

const rock = { cena: <p>rock</p>, tema: TEMAS.riffRush };
const mania = { cena: <p>mania</p>, tema: TEMAS.mania };

describe("Volvelle", () => {
  it("parada, monta só o cenário que aparece", () => {
    const { queryByText } = render(<Volvelle cima={rock} baixo={mania} virada={false} girando={false} />);
    expect(queryByText("rock")).toBeInTheDocument();
    expect(queryByText("mania")).not.toBeInTheDocument();
  });

  it("girando, monta os dois cenários, cada um com o tema do seu modo", () => {
    const { container, getByText } = render(<Volvelle cima={rock} baixo={mania} virada={false} girando />);
    expect(getByText("mania")).toBeInTheDocument();
    const [cima, baixo] = container.querySelectorAll<HTMLElement>("[data-parte='metade']");
    expect(cima.style.getPropertyValue("--cor-fundo")).toBe(TEMAS.riffRush.cores.fundo);
    expect(baixo.style.getPropertyValue("--cor-fundo")).toBe(TEMAS.mania.cores.fundo);
  });

  it("girando, não desenha a metade do modo que sai, que fica embaixo da capa o giro inteiro", () => {
    const { queryByText } = render(<Volvelle cima={rock} baixo={mania} virada={false} girando coberta="cima" />);
    expect(queryByText("rock")).not.toBeInTheDocument();
    expect(queryByText("mania")).toBeInTheDocument();
  });

  it("virada, o disco dá meia volta", () => {
    const { container } = render(<Volvelle cima={rock} baixo={mania} virada girando={false} />);
    expect(container.querySelector<HTMLElement>("[data-parte='disco']")!.style.transform).toBe("rotate(180deg)");
  });

  it("é só decoração para os leitores de tela", () => {
    const { container } = render(<Volvelle cima={rock} baixo={mania} virada={false} girando={false} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("CapaDaVolvelle", () => {
  it("sem troca, fica vazia, só guardando a posição do disco", () => {
    const { container } = render(<CapaDaVolvelle virada={false} />);
    expect(container.querySelector("[data-parte='metade']")).not.toBeInTheDocument();
  });

  it("na troca, leva o cenário e a foto da tela do modo que saiu", () => {
    const elemento = document.createElement("p");
    elemento.textContent = "tela do rock";
    const { getByText } = render(<CapaDaVolvelle virada saindo={{ lado: rock, emCima: true, foto: { elemento, retangulo: { x: 0, y: 0, largura: 800, altura: 600 } } }} />);
    expect(getByText("rock")).toBeInTheDocument();
    expect(getByText("tela do rock")).toBeInTheDocument();
  });

  it("a foto da tela que saiu fica fora do disco que gira, parada e recortada na linha", () => {
    const elemento = document.createElement("p");
    elemento.textContent = "tela do rock";
    const { getByText } = render(<CapaDaVolvelle virada saindo={{ lado: rock, emCima: true, foto: { elemento, retangulo: { x: 0, y: 0, largura: 800, altura: 600 } } }} />);
    const foto = getByText("tela do rock").closest<HTMLElement>("[data-parte='foto']")!;
    expect(foto.closest("[data-parte='disco']")).toBeNull();
    expect(foto.style.clipPath).toMatch(/^polygon\(/);
  });
});
