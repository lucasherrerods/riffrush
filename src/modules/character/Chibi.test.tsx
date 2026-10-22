import { render, screen } from "@testing-library/react";
import { Chibi } from "./Chibi";
import { ACESSORIOS, CABELOS, INSTRUMENTOS, PERSONAGEM_PADRAO, type Personagem } from "./personagem";

const desenhar = (mudancas: Partial<Personagem> = {}, props: Partial<Parameters<typeof Chibi>[0]> = {}) =>
  render(<Chibi personagem={{ ...PERSONAGEM_PADRAO, ...mudancas }} {...props} />).container;

const parte = (container: HTMLElement, nome: string) => container.querySelector(`[data-parte="${nome}"]`);

describe("Chibi", () => {
  it("tem o nome do personagem como descrição acessível", () => {
    desenhar({ nome: "Vitor" });
    expect(screen.getByRole("img", { name: "Personagem Vitor" })).toBeInTheDocument();
  });

  // Bug do projeto antigo: o cabelo longo era desenhado por cima do corpo e cobria o chibi inteiro.
  it.each(CABELOS.map((c) => c.id))("o cabelo %s de trás fica atrás do corpo", (cabelo) => {
    const container = desenhar({ cabelo });
    const cabeloDeTras = parte(container, "cabelo-de-tras")!;
    const corpo = parte(container, "corpo")!;
    expect(cabeloDeTras.compareDocumentPosition(corpo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(INSTRUMENTOS.map((i) => i.id))("desenha o instrumento %s", (instrumento) => {
    expect(parte(desenhar({ instrumento }), `instrumento-${instrumento}`)).not.toBeNull();
  });

  it.each(ACESSORIOS.filter((a) => a.id !== "nenhum").map((a) => a.id))("desenha o acessório %s", (acessorio) => {
    expect(parte(desenhar({ acessorio }), `acessorio-${acessorio}`)).not.toBeNull();
  });

  it("sem acessório não desenha nenhum", () => {
    expect(desenhar({ acessorio: "nenhum" }).querySelector('[data-parte^="acessorio-"]')).toBeNull();
  });

  it("fica triste quando pedido", () => {
    expect(parte(desenhar({}, { triste: true }), "olhos-tristes")).not.toBeNull();
  });

  // Bug do projeto antigo: as duas baquetas da bateria usavam a mesma key.
  it("a bateria não gera chaves duplicadas no React", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<Chibi personagem={{ ...PERSONAGEM_PADRAO, instrumento: "bateria" }} pulso={1} />);
    rerender(<Chibi personagem={{ ...PERSONAGEM_PADRAO, instrumento: "bateria" }} pulso={2} />);
    expect(erro.mock.calls.flat().join(" ")).not.toMatch(/same key/);
    erro.mockRestore();
  });

  // design.md, regra 1.
  it("não usa preto nem branco puros", () => {
    for (const instrumento of INSTRUMENTOS.map((i) => i.id)) {
      for (const acessorio of ACESSORIOS.map((a) => a.id)) {
        const html = desenhar({ instrumento, acessorio, olhos: "fofo" }).innerHTML;
        expect(html).not.toMatch(/"(white|black|#fff|#ffffff|#000|#000000)"/i);
      }
    }
  });
});
