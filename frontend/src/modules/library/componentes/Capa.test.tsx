import { render, screen } from "@testing-library/react";
import { Capa } from "./Capa";
import { MUSICAS_DE_TESTE } from "@/test/musicas";

describe("Capa", () => {
  // Bug: o tamanho relativo ficava no ícone, dentro de um contêiner sem tamanho, e o disco saía minúsculo.
  it("sem imagem, o disco ocupa metade da capa", () => {
    const { container } = render(<Capa musica={MUSICAS_DE_TESTE[0]} className="size-44" />);
    const disco = container.querySelector("svg")!;
    expect(disco.parentElement).toHaveClass("size-1/2");
    expect(disco).toHaveClass("size-full");
  });

  it("com imagem, mostra a imagem com texto alternativo", () => {
    render(<Capa musica={{ ...MUSICAS_DE_TESTE[0], imagemDeCapa: "blob:x" }} />);
    expect(screen.getByRole("img", { name: "Capa de Neon Highway" })).toBeInTheDocument();
  });
});
