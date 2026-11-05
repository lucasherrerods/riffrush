import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TUTORIAIS } from "./conteudo";
import { ModalDeTutoriais } from "./ModalDeTutoriais";

describe("ModalDeTutoriais", () => {
  it("abre nos modos de jogo, com o primeiro tópico e a pista animada", () => {
    render(<ModalDeTutoriais aberto aoFechar={() => {}} />);
    expect(screen.getByRole("heading", { name: "Jogar sozinho" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Demonstração: Jogar sozinho" })).toBeInTheDocument();
  });

  it("troca de tópico e de aba", async () => {
    const usuario = userEvent.setup();
    render(<ModalDeTutoriais aberto aoFechar={() => {}} />);
    await usuario.click(screen.getByRole("button", { name: "Jeito de jogar: Palhetada" }));
    expect(screen.getByRole("heading", { name: "Jeito de jogar: Palhetada" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("tab", { name: "Mecânicas" }));
    await usuario.click(screen.getByRole("button", { name: "Âncora (anchoring)" }));
    expect(screen.getByText(/Through the Fire and Flames/)).toBeInTheDocument();
  });

  it("todo tópico tem texto, e todo roteiro tem as notas em ordem dentro do laço", () => {
    for (const t of TUTORIAIS) {
      expect(t.texto.length).toBeGreaterThan(0);
      if (!t.demo) continue;
      const tempos = t.demo.notas.map((n) => n.tempo + (n.duracao ?? 0));
      expect(Math.max(...tempos)).toBeLessThan(t.demo.duracao);
      expect(t.demo.entradas.every((e, i, todas) => i === 0 || todas[i - 1].tempo <= e.tempo)).toBe(true);
    }
  });
});
