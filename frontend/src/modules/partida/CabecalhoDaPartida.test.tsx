import { render, screen } from "@testing-library/react";
import { CabecalhoDaPartida } from "./CabecalhoDaPartida";
import { CarregandoPartida } from "./CarregandoPartida";
import { BarraDeUrDaPartida } from "./BarraDeUrDaPartida";

const base = { titulo: "Shine", artista: "Spektrem", detalhe: "Expert · Guitarra", capa: <span data-testid="capa" />, precisao: 0.9876, progresso: 0.25 };

it("mostra capa, nome da música, artista e detalhe no canto esquerdo", () => {
  render(<CabecalhoDaPartida {...base} />);
  const canto = screen.getByTestId("info-da-musica");
  expect(canto).toContainElement(screen.getByTestId("capa"));
  expect(canto).toHaveTextContent("Shine");
  expect(canto).toHaveTextContent("Spektrem");
  expect(canto).toHaveTextContent("Expert · Guitarra");
});

it("mostra a precisão e o progresso no topo à direita, sem a barra de UR", () => {
  render(<CabecalhoDaPartida {...base} />);
  const centro = screen.getByTestId("direita-do-topo");
  expect(centro).toContainElement(screen.getByLabelText("Precisão"));
  expect(screen.getByLabelText("Precisão")).toHaveTextContent("98,76%");
  expect(centro).toContainElement(screen.getByLabelText("Progresso da música"));
  expect(screen.queryByLabelText("Barra de UR")).toBeNull();
});

it("a barra de UR fica embaixo, no centro da tela", () => {
  render(<BarraDeUrDaPartida ler={() => null} cores={["#fff"]} />);
  expect(screen.getByLabelText("Barra de UR").parentElement).toHaveClass("bottom-1", "left-1/2");
});

it("com aoIrPara, a barra de progresso vira controle", () => {
  render(<CabecalhoDaPartida {...base} aoIrPara={() => {}} />);
  expect(screen.getByLabelText("Posição da música")).toBeInTheDocument();
});

it("o carregamento mostra a mensagem e a música dos dois modos do mesmo jeito", () => {
  render(<CarregandoPartida mensagem="Carregando o mapa…" titulo="Shine" detalhe="Hard" />);
  expect(screen.getByRole("status")).toHaveTextContent("Carregando o mapa…");
  expect(screen.getByRole("status")).toHaveTextContent("Shine · Hard");
});
