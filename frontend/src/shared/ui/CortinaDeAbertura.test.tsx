import { act, render, screen } from "@testing-library/react";
import { CortinaDeAbertura } from "./CortinaDeAbertura";

describe("CortinaDeAbertura", () => {
  it("cobre a tela com um carregando enquanto não está pronto", () => {
    render(<CortinaDeAbertura pronto={false} />);
    expect(screen.getByRole("status", { name: "Abrindo o jogo" })).toBeInTheDocument();
  });

  it("some quando fica pronto", async () => {
    const { rerender } = render(<CortinaDeAbertura pronto={false} />);
    rerender(<CortinaDeAbertura pronto />);
    await act(() => new Promise((r) => setTimeout(r, 600)));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
