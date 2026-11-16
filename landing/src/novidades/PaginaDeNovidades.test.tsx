import { render, screen, within } from "@testing-library/react";
import { LINKS } from "@/links";
import { PaginaDeNovidades } from "./PaginaDeNovidades";
import { POSTS, emOrdem } from "./posts";

describe("PaginaDeNovidades", () => {
  it("lista os posts do mais novo para o mais antigo, cada um com a sua âncora", () => {
    render(<PaginaDeNovidades />);
    const artigos = within(screen.getByRole("main")).getAllByRole("article");
    const esperados = emOrdem(POSTS);
    expect(artigos).toHaveLength(esperados.length);
    artigos.forEach((artigo, i) => {
      expect(artigo).toHaveAttribute("id", esperados[i].id);
      expect(within(artigo).getByRole("heading", { name: esperados[i].titulo })).toBeInTheDocument();
    });
  });

  it("volta para a página inicial e leva para jogar", () => {
    render(<PaginaDeNovidades />);
    expect(screen.getAllByRole("link", { name: /riff rush/i })[0]).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /jogar no navegador/i })).toHaveAttribute("href", LINKS.jogarNoNavegador);
  });
});
