import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERSONAGEM_PADRAO } from "@/modules/rock/character";
import { MUSICAS_DE_TESTE } from "@/test/musicas";
import { estadoInicial, type EstadoDaSala } from "../protocolo";
import { enviarChat, escolher, expulsar, passarLideranca } from "../sala";
import { Lobby } from "./Lobby";

vi.mock("@/modules/rock/character", async (original) => ({
  ...(await original<typeof import("@/modules/rock/character")>()),
  Avatar: () => null,
}));
vi.mock("@/modules/rock/player", () => ({ useSeguirMusica: () => {} }));
vi.mock("../sala", async (original) => ({ ...(await original<typeof import("../sala")>()), escolher: vi.fn(() => Promise.resolve()), expulsar: vi.fn(), enviarChat: vi.fn(() => true), passarLideranca: vi.fn() }));

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

  it("no online, o host passa a liderança pela coroa, depois de confirmar", async () => {
    const usuario = userEvent.setup();
    render(<Lobby sala={sala(primeira.id, { jogadores: [{ id: 1, personagem: PERSONAGEM_PADRAO }, { id: 2, personagem: vitor }] })} codigo="K7QXM" endereco="" musicas={MUSICAS_DE_TESTE} volumeDosEfeitos={0} />);
    expect(screen.getAllByRole("button", { name: /^Passar a liderança/ })).toHaveLength(1);
    await usuario.click(screen.getByRole("button", { name: "Passar a liderança para Vitor" }));
    expect(passarLideranca).not.toHaveBeenCalled();
    await usuario.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Passar/ }));
    expect(passarLideranca).toHaveBeenCalledWith(2);
  });

  it("na LAN não tem coroa: a sala mora no PC de quem criou", () => {
    render(lobby(primeira.id, { jogadores: [{ id: 1, personagem: PERSONAGEM_PADRAO }, { id: 2, personagem: vitor }] }));
    expect(screen.queryByRole("button", { name: /^Passar a liderança/ })).not.toBeInTheDocument();
  });

  it("convidado não vê o botão de expulsar", () => {
    render(lobby(primeira.id, { souHost: false, meuId: 2, jogadores: [{ id: 1, personagem: PERSONAGEM_PADRAO }, { id: 2, personagem: vitor }] }));
    expect(screen.queryByRole("button", { name: /^Expulsar/ })).not.toBeInTheDocument();
  });

  it("tem o chat da sala, com a minha mensagem marcada, e manda pelo protocolo", async () => {
    const chat = [
      { n: 1, de: 2, autor: "Vitor", texto: "bora?" },
      { n: 2, de: 1, autor: "Rockstar", texto: "bora" },
    ];
    render(lobby(primeira.id, { chat }));
    const log = screen.getByRole("log", { name: "Chat da sala" });
    expect(log).toHaveTextContent("Vitor: bora?");
    expect(log).toHaveTextContent("Rockstar: bora");
    await userEvent.type(screen.getByRole("textbox", { name: "Mensagem" }), "vamo{Enter}");
    expect(enviarChat).toHaveBeenCalledWith("vamo");
  });

  it("o chat avisa quem consegue ler: na LAN, a rede inteira; no online, quem entrar na sala", () => {
    const { unmount } = render(lobby(primeira.id));
    expect(screen.getByText(/mesmo Wi-Fi consegue ler o chat/)).toBeInTheDocument();
    unmount();
    render(<Lobby sala={sala(primeira.id)} codigo="K7QXM" endereco="" musicas={MUSICAS_DE_TESTE} volumeDosEfeitos={0} />);
    expect(screen.getByText(/Quem entrar na sala lê o chat/)).toBeInTheDocument();
  });

  it("o filtro de favoritos mostra só as músicas favoritadas", async () => {
    localStorage.setItem("riffrush:favoritas", JSON.stringify([segunda.id]));
    render(lobby(primeira.id));
    await userEvent.click(screen.getByRole("button", { name: /Favoritos/ }));
    const lista = screen.getByRole("radiogroup", { name: "Música" });
    expect(within(lista).getAllByRole("radio")).toHaveLength(1);
    expect(within(lista).getByRole("radio", { name: new RegExp(segunda.titulo) })).toBeInTheDocument();
    localStorage.clear();
  });

  it("a aleatória do top 50 escolhe a sorteada para a sala", async () => {
    const sortearMusica = vi.fn(() => Promise.resolve(segunda));
    render(<Lobby sala={sala(primeira.id)} endereco="" musicas={MUSICAS_DE_TESTE} volumeDosEfeitos={0} sortearMusica={sortearMusica} />);
    await userEvent.click(screen.getByRole("button", { name: /Aleatória do top 50/ }));
    expect(sortearMusica).toHaveBeenCalledWith(MUSICAS_DE_TESTE);
    expect(escolher).toHaveBeenCalledWith(segunda, expect.anything(), expect.anything());
  });
});
