import { render } from "@testing-library/react";
import { TEMAS } from "@/shared/styles/tokens";
import { Volvelle } from "./Volvelle";

const abrir = ({ virada = false, girando = false } = {}) =>
  render(
    <Volvelle
      cima={{ cena: <p>rock</p>, tema: TEMAS.riffRush, titulo: <h1>Rock</h1> }}
      baixo={{ cena: <p>mania</p>, tema: TEMAS.mania, titulo: <h1>Mania</h1> }}
      virada={virada}
      girando={girando}
      posicaoDoTitulo={{ x: 10, y: 20, largura: 200 }}
    />,
  );

describe("Volvelle", () => {
  it("parado, monta só a cena que aparece", () => {
    const { queryByText } = abrir();
    expect(queryByText("rock")).toBeInTheDocument();
    expect(queryByText("mania")).not.toBeInTheDocument();
  });

  it("girando, monta as duas cenas, uma em cada metade", () => {
    const { getByText, container } = abrir({ girando: true });
    expect(getByText("rock")).toBeInTheDocument();
    expect(getByText("mania")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-parte='metade']")).toHaveLength(2);
  });

  it("cada metade veste o tema do seu modo, ao mesmo tempo", () => {
    const { container } = abrir({ girando: true });
    const [cima, baixo] = container.querySelectorAll<HTMLElement>("[data-parte='metade']");
    expect(cima.style.getPropertyValue("--cor-fundo")).toBe(TEMAS.riffRush.cores.fundo);
    expect(baixo.style.getPropertyValue("--cor-fundo")).toBe(TEMAS.mania.cores.fundo);
  });

  it("virado, o disco dá meia volta", () => {
    const { container } = abrir({ virada: true });
    expect(container.querySelector<HTMLElement>("[data-parte='disco']")!.style.transform).toBe("rotate(180deg)");
  });

  it("os títulos só aparecem no giro, para a linha cortar um e revelar o outro", () => {
    const parado = abrir();
    for (const t of parado.container.querySelectorAll("[data-parte='titulo']")) expect(t.parentElement).toHaveClass("invisible");
    parado.unmount();
    const { container } = abrir({ girando: true });
    for (const t of container.querySelectorAll("[data-parte='titulo']")) expect(t.parentElement).not.toHaveClass("invisible");
  });

  it("é só decoração para os leitores de tela", () => {
    const { container } = abrir();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
