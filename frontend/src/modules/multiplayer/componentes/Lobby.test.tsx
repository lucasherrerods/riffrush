import { render, screen } from "@testing-library/react";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { MUSICAS_DE_TESTE } from "@/test/musicas";
import { estadoInicial, type EstadoDaSala } from "../protocolo";
import { Lobby } from "./Lobby";

vi.mock("@/modules/character", async (original) => ({
  ...(await original<typeof import("@/modules/character")>()),
  Avatar: () => null,
}));
vi.mock("@/modules/player", () => ({ useSeguirMusica: () => {} }));

const [primeira, segunda] = MUSICAS_DE_TESTE;

function sala(musicaId: string): EstadoDaSala {
  return {
    ...estadoInicial(PERSONAGEM_PADRAO, true),
    status: "naSala",
    meuId: 1,
    hostId: 1,
    jogadores: [{ id: 1, personagem: PERSONAGEM_PADRAO }],
    musica: { tipo: "embutida", id: musicaId },
  };
}

const lobby = (musicaId: string) => <Lobby sala={sala(musicaId)} endereco="" musicas={MUSICAS_DE_TESTE} volumeDosEfeitos={0} />;

afterEach(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

describe("Lobby", () => {
  // O Chrome passou a devolver uma Promise no scrollIntoView. Devolvida pelo efeito, ela virava a "limpeza"
  // do React, que quebrava ao chamá-la na troca de música e deixava a tela preta.
  it("trocar a música da sala não quebra quando o scrollIntoView devolve uma Promise", () => {
    Element.prototype.scrollIntoView = () => Promise.resolve() as unknown as void;
    const { rerender } = render(lobby(primeira.id));

    expect(() => rerender(lobby(segunda.id))).not.toThrow();
    expect(screen.getByRole("radio", { name: `${segunda.titulo} - ${segunda.artista}` })).toHaveAttribute("aria-checked", "true");
  });
});
