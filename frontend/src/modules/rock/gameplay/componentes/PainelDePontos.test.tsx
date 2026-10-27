import { render, screen } from "@testing-library/react";
import { PainelDePontos } from "./PainelDePontos";

const base = { pontos: 12345, sequencia: 27, multiplicador: 3, precisao: 0.968, estrelaAtiva: false };

describe("PainelDePontos", () => {
  it("mostra pontos, combo, multiplicador e precisão", () => {
    render(<PainelDePontos {...base} />);
    expect(screen.getByLabelText("Pontos")).toHaveTextContent("012345");
    expect(screen.getByLabelText("Sequência")).toHaveTextContent("27");
    expect(screen.getByLabelText("Multiplicador")).toHaveTextContent("x3");
    expect(screen.getByLabelText("Precisão")).toHaveTextContent("97%");
  });

  it("os pontos aparecem num visor digital de 6 dígitos, como no arcade", () => {
    render(<PainelDePontos {...base} pontos={987} />);
    expect(screen.getByLabelText("Pontos")).toHaveTextContent(/^000987$/);
  });

  it("o visor tem os segmentos apagados ao fundo, como um display de fliperama", () => {
    render(<PainelDePontos {...base} />);
    expect(screen.getByTestId("segmentos-apagados")).toHaveTextContent("888888");
    expect(screen.getByTestId("segmentos-apagados")).toHaveAttribute("aria-hidden", "true");
  });

  it("pontuação maior que o visor aparece inteira", () => {
    render(<PainelDePontos {...base} pontos={1234567} />);
    expect(screen.getByLabelText("Pontos")).toHaveTextContent(/^1234567$/);
  });

  it("no desktop é um amplificador, com o multiplicador na grade do alto-falante", () => {
    render(<PainelDePontos {...base} />);
    expect(screen.getByTestId("grade")).toContainElement(screen.getByLabelText("Multiplicador"));
  });

  it("os pontos ficam num visor de LCD em cima do amplificador", () => {
    render(<PainelDePontos {...base} />);
    expect(screen.getByTestId("lcd")).toContainElement(screen.getByLabelText("Pontos"));
    expect(screen.getByTestId("grade")).toContainElement(screen.getByTestId("lcd"));
  });

  it("o multiplicador fica num mostrador redondo, com o x pequeno ao lado do número", () => {
    render(<PainelDePontos {...base} />);
    const mostrador = screen.getByTestId("mostrador");
    expect(mostrador).toContainElement(screen.getByLabelText("Multiplicador"));
    expect(mostrador).toContainElement(screen.getByRole("progressbar", { name: "Próximo multiplicador" }));
    expect(screen.getByTestId("numero-do-multiplicador")).toHaveTextContent(/^3$/);
  });

  it("combo e precisão ficam fora do amplificador, logo abaixo", () => {
    render(<PainelDePontos {...base} />);
    expect(screen.getByTestId("grade")).not.toContainElement(screen.getByLabelText("Sequência"));
    expect(screen.getByTestId("grade")).not.toContainElement(screen.getByLabelText("Precisão"));
  });

  it("o amplificador é a imagem, decorativa, por trás do visor e do mostrador", () => {
    const { container } = render(<PainelDePontos {...base} />);
    const imagem = container.querySelector("img");
    expect(imagem).toHaveAttribute("alt", "");
    expect(imagem?.getAttribute("src")).toMatch(/amplificador.*\.png/);
    expect(screen.getByTestId("grade")).toContainElement(imagem);
  });

  it("mostra quanto falta para o próximo multiplicador", () => {
    render(<PainelDePontos {...base} />);
    expect(screen.getByRole("progressbar", { name: "Próximo multiplicador" })).toHaveAttribute("aria-valuenow", "70");
  });

  it("no modo compacto continua mostrando os quatro números", () => {
    render(<PainelDePontos {...base} compacto />);
    for (const rotulo of ["Pontos", "Sequência", "Multiplicador", "Precisão"]) expect(screen.getByLabelText(rotulo)).toBeInTheDocument();
  });

  it("mostra o aviso do último acerto logo acima da precisão", () => {
    render(<PainelDePontos {...base} aviso={<span>PERFEITO</span>} />);
    const aviso = screen.getByText("PERFEITO");
    const precisao = screen.getByLabelText("Precisão");
    expect(aviso.compareDocumentPosition(precisao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
