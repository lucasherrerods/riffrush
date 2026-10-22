import { render, screen } from "@testing-library/react";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { estadoInicial, type EstadoDaSala } from "../protocolo";
import { Adversarios } from "./Adversarios";

const vitor = { ...PERSONAGEM_PADRAO, nome: "Vitor" };
const lucas = { ...PERSONAGEM_PADRAO, nome: "Lucas" };

function sala(extra: Partial<EstadoDaSala> = {}): EstadoDaSala {
  return {
    ...estadoInicial(lucas, true),
    status: "jogando",
    meuId: 1,
    hostId: 1,
    jogadores: [
      { id: 1, personagem: lucas },
      { id: 2, personagem: vitor },
    ],
    ...extra,
  };
}

describe("Adversarios", () => {
  it("mostra só os outros jogadores, com chibi, pontos e vida", () => {
    render(<Adversarios sala={sala({ adversarios: { 2: { pontos: 1234, vida: 0.3, sequencia: 5, pulso: 9, derrota: false, terminou: false } } })} />);
    expect(screen.queryByRole("img", { name: "Personagem Lucas" })).toBeNull();
    expect(screen.getByRole("img", { name: "Personagem Vitor" })).toBeInTheDocument();
    expect(screen.getByText("1.234")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Vida de Vitor" })).toHaveAttribute("aria-valuenow", "30");
  });

  it("antes do primeiro estado, mostra zero pontos e vida pela metade", () => {
    render(<Adversarios sala={sala()} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Vida de Vitor" })).toHaveAttribute("aria-valuenow", "50");
  });

  it("marca quem foi vaiado", () => {
    render(<Adversarios sala={sala({ adversarios: { 2: { pontos: 0, vida: 0, sequencia: 0, pulso: 0, derrota: true, terminou: true } } })} />);
    expect(screen.getByText("Vaiado")).toBeInTheDocument();
  });

  it("jogando sozinho na sala, não mostra nada", () => {
    const { container } = render(<Adversarios sala={sala({ jogadores: [{ id: 1, personagem: lucas }] })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
