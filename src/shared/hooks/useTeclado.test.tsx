import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnimatePresence, motion } from "framer-motion";
import { useTeclado } from "./useTeclado";

function Tela({ aoApertar }: { aoApertar: (e: KeyboardEvent) => void }) {
  useTeclado(aoApertar);
  return <p>tela</p>;
}

const comTransicao = (visivel: boolean, aoApertar: () => void) => (
  <AnimatePresence>
    {visivel && (
      <motion.div key="tela" exit={{ opacity: 0 }} transition={{ duration: 10 }}>
        <Tela aoApertar={aoApertar} />
      </motion.div>
    )}
  </AnimatePresence>
);

describe("useTeclado", () => {
  it("recebe as teclas apertadas", async () => {
    const aoApertar = vi.fn();
    render(<Tela aoApertar={aoApertar} />);
    await userEvent.keyboard("{Enter}");
    expect(aoApertar).toHaveBeenCalledWith(expect.objectContaining({ code: "Enter" }));
  });

  // Bug do projeto antigo: durante a animação de saída a tela velha ainda recebia as teclas.
  it("ignora as teclas enquanto a tela está saindo", async () => {
    const aoApertar = vi.fn();
    const { rerender } = render(comTransicao(true, aoApertar));
    rerender(comTransicao(false, aoApertar));
    await userEvent.keyboard("{Enter}");
    expect(aoApertar).not.toHaveBeenCalled();
  });

  it("para de escutar quando a tela some", async () => {
    const aoApertar = vi.fn();
    const { unmount } = render(<Tela aoApertar={aoApertar} />);
    unmount();
    await userEvent.keyboard("{Enter}");
    expect(aoApertar).not.toHaveBeenCalled();
  });
});
