import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { MUSICAS_DE_TESTE } from "@/test/musicas";
import { estadoInicial, type EstadoDaSala } from "../protocolo";
import { expulsar } from "../sala";
import { Lobby } from "./Lobby";

vi.mock("@/modules/character", async (original) => ({
  ...(await original<typeof import("@/modules/character")>()),
  Avatar: () => null,
}));
vi.mock("@/modules/player", () => ({ useSeguirMusica: () => {} }));
vi.mock("../sala", async (original) => ({ ...(await original<typeof import("../sala")>()), expulsar: vi.fn() }));

const [primeira, segunda] = MUSICAS_DE_TESTE;

const vitor = { ...PERSONAGEM_PADRAO, nome: "Vitor", nivel: 7 };

function sala(musicaId: string, extra: Partial<EstadoDaSala> = {}): EstadoDaSala {
  return {
    ...estadoInicial(PERSONAGEM_PADRAO, true),
    status: "naSala",
    meuId: 1,
    hostId: 1,
    jogadores: [{ id: 1, personagem: PERSONAGEM_PADRAO }],
    musica: { tipo: "embutida", id: musicaId },
    ...extra,
  };
}

const lobby = (musicaId: string, extra?: Partial<EstadoDaSala>) => <Lobby sala={sala(musicaId, extra)} endereco="" musicas={MUSICAS_DE_TESTE} volumeDosEfeitos={0} />;

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

  it("mostra o nível de quem tem conta, embaixo do nome", () => {
    render(lobby(primeira.id, { jogadores: [{ id: 1, personagem: PERSONAGEM_PADRAO }, { id: 2, personagem: vitor }] }));
    expect(screen.getByText("Nv 7")).toBeInTheDocument();
    expect(screen.getAllByText(/^Nv /)).toHaveLength(1);
  });

  it("o host expulsa um convidado, mas não a si mesmo", async () => {
    render(lobby(primeira.id, { jogadores: [{ id: 1, personagem: PERSONAGEM_PADRAO }, { id: 2, personagem: vitor }] }));
    expect(screen.getAllByRole("button", { name: /^Expulsar/ })).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole("button", { name: "Expulsar Vitor" }));
    expect(expulsar).toHaveBeenCalledWith(2);
  });

  it("convidado não vê o botão de expulsar", () => {
    render(lobby(primeira.id, { souHost: false, meuId: 2, jogadores: [{ id: 1, personagem: PERSONAGEM_PADRAO }, { id: 2, personagem: vitor }] }));
    expect(screen.queryByRole("button", { name: /^Expulsar/ })).not.toBeInTheDocument();
  });
});
