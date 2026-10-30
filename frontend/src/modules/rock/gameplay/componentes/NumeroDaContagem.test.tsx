import { render, screen } from "@testing-library/react";
import { AnimatePresence } from "framer-motion";
import { NumeroDaContagem } from "./NumeroDaContagem";

const contagem = (valor: number) => <AnimatePresence>{valor > 0 && <NumeroDaContagem key={valor} valor={valor} />}</AnimatePresence>;

describe("NumeroDaContagem", () => {
  // O 1 encolhendo na saída ficava na tela com a música já tocando.
  it("some na hora em que a contagem acaba, sem animação de saída", () => {
    const { rerender } = render(contagem(1));
    expect(screen.getByRole("timer")).toHaveTextContent("1");
    rerender(contagem(0));
    expect(screen.queryByRole("timer")).toBeNull();
  });
});
