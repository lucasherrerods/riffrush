import { render, screen, within } from "@testing-library/react";
import { Placar, type LinhaDoPlacar } from "./Placar";

const linha = (id: number, nome: string, pontos: number, extra: Partial<LinhaDoPlacar> = {}): LinhaDoPlacar => ({
  id,
  nome,
  pontos,
  meu: false,
  derrota: false,
  fantasma: false,
  terminou: true,
  ...extra,
});

describe("Placar", () => {
  it("ordena as linhas por pontos e mostra o avatar que o modo mandou", () => {
    render(<Placar linhas={[linha(1, "Lucas", 10, { avatar: <span>avatar do Lucas</span> }), linha(2, "Ana", 50)]} />);
    const linhas = screen.getAllByRole("listitem");
    expect(within(linhas[0]).getByText("Ana")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("avatar do Lucas")).toBeInTheDocument();
  });

  it("usa o rótulo de derrota que o modo escolher", () => {
    render(<Placar linhas={[linha(1, "Lucas", 0, { derrota: true })]} rotuloDaDerrota="Falhou" />);
    expect(screen.getByText("Falhou")).toBeInTheDocument();
  });

  it("enquanto alguém ainda joga, espera e não coroa ninguém", () => {
    render(<Placar linhas={[linha(1, "Lucas", 10), linha(2, "Ana", 5, { terminou: false })]} />);
    expect(screen.getByText(/Esperando os outros terminarem/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Vencedor")).toBeNull();
  });

  it("mostra o detalhe de cada linha, como a precisão", () => {
    render(<Placar linhas={[linha(1, "Lucas", 10, { detalhe: "98,50%" })]} />);
    expect(screen.getByText("98,50%")).toBeInTheDocument();
  });

  it("ao vivo, no meio da partida, não fala em esperar nem coroa ninguém", () => {
    render(<Placar aoVivo linhas={[linha(1, "Lucas", 10, { terminou: false }), linha(2, "Ana", 5, { terminou: false })]} />);
    expect(screen.queryByText(/Esperando/)).toBeNull();
    expect(screen.queryByLabelText("Ainda tocando")).toBeNull();
  });
});
