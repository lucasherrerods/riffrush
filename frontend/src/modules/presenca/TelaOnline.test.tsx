import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PessoaOnline } from "./protocolo";
import { TelaOnline } from "./TelaOnline";

const ana: PessoaOnline = {
  id: "a",
  nome: "Ana",
  avatar: null,
  estado: { tipo: "tocando", musica: "encore:abc", titulo: "Paint It Black", artista: "The Rolling Stones", dificuldade: "expert", instrumento: "baixo", transmitindo: true },
};
const bia: PessoaOnline = { id: "b", nome: "Bia", avatar: null, estado: { tipo: "menu" } };
const caio: PessoaOnline = { id: "c", nome: "Caio", avatar: null, estado: { tipo: "multiplayer", sala: { jogadores: 3, online: true } } };

function abrir(extra: Partial<Parameters<typeof TelaOnline>[0]> = {}) {
  const props = {
    logado: true,
    euId: "eu",
    presenca: { conectada: true, pessoas: [bia, ana, caio] },
    mostrarOnline: true,
    permitirEspectadores: true,
    aoMudar: vi.fn(),
    aoAssistir: vi.fn(),
    aoVoltar: vi.fn(),
    ...extra,
  };
  render(<TelaOnline {...props} />);
  return { ...props, usuario: userEvent.setup() };
}

describe("TelaOnline", () => {
  it("lista quem está online com o que cada um está fazendo", () => {
    abrir();
    expect(screen.getByText("Tocando Paint It Black – The Rolling Stones · Expert · Baixo")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Pessoas online" })).getByText("No menu")).toBeInTheDocument();
  });

  it("assistir só aparece para quem está transmitindo, e entrega a pessoa", async () => {
    const { aoAssistir, usuario } = abrir();
    expect(screen.getAllByRole("button", { name: /Assistir/ })).toHaveLength(1);
    await usuario.click(screen.getByRole("button", { name: "Assistir Ana" }));
    expect(aoAssistir).toHaveBeenCalledWith(ana);
  });

  it("antes de aceitar, explica o que aparece e não mostra ninguém", async () => {
    const { aoMudar, usuario } = abrir({ mostrarOnline: null });
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    expect(screen.getByText(/seu nome, sua foto e a música/)).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Agora não" }));
    expect(aoMudar).toHaveBeenCalledWith({ mostrarOnline: false });
    await usuario.click(screen.getByRole("button", { name: "Aparecer online" }));
    expect(aoMudar).toHaveBeenCalledWith({ mostrarOnline: true });
  });

  it("dá para desligar os espectadores e a presença", async () => {
    const { aoMudar, usuario } = abrir();
    await usuario.click(screen.getByRole("switch", { name: "Deixar assistirem minhas partidas" }));
    expect(aoMudar).toHaveBeenCalledWith({ permitirEspectadores: false });
    await usuario.click(screen.getByRole("switch", { name: "Aparecer online" }));
    expect(aoMudar).toHaveBeenCalledWith({ mostrarOnline: false });
  });

  it("sem conta, pede para entrar", () => {
    abrir({ logado: false });
    expect(screen.getByText(/Entre na sua conta/)).toBeInTheDocument();
  });

  it("enquanto conecta, avisa", () => {
    abrir({ presenca: { conectada: false, pessoas: [] } });
    expect(screen.getByText("Conectando...")).toBeInTheDocument();
  });

  it("mostra quantos estão online e filtra por onde cada um está", async () => {
    const { usuario } = abrir();
    expect(screen.getByText("3 online")).toBeInTheDocument();
    await usuario.click(screen.getByRole("tab", { name: /Em sala/ }));
    expect(screen.getByText("Caio")).toBeInTheDocument();
    expect(screen.getByText("Em sala online · 3 jogadores")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });

  it("busca pelo nome e avisa quando ninguém bate", async () => {
    const { usuario } = abrir();
    await usuario.type(screen.getByRole("textbox", { name: "Buscar pessoas" }), "bi");
    expect(screen.getByText("Bia")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    await usuario.type(screen.getByRole("textbox", { name: "Buscar pessoas" }), "zzz");
    expect(screen.getByText("Ninguém por aqui.")).toBeInTheDocument();
  });

  it("amigos aparecem primeiro e com a marca de amigo", () => {
    abrir({ amigos: new Set(["b"]) });
    const nomes = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(nomes[0]).toContain("Bia");
    expect(nomes[0]).toContain("Amigo");
  });
});
