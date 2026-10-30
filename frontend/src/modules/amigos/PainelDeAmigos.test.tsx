import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApiDosAmigos, ListasDeAmigos, PessoaDaAmizade } from "./api";
import { PainelDeAmigos } from "./PainelDeAmigos";

const pessoa = (conta_id: string, nome: string): PessoaDaAmizade => ({ conta_id, nome, avatar: null, nivel: 3, visto_em: null, desde: "2026-10-01T00:00:00Z" });

const listas: ListasDeAmigos = {
  codigo: "RIFF-ABCDEF",
  amigos: [pessoa("a", "AnaRock"), pessoa("r", "RafaBass")],
  recebidos: [pessoa("g", "GabiStrings")],
  enviados: [],
  bloqueados: [],
};

const api = vi.hoisted(() => ({
  listas: vi.fn(),
  sugestoes: vi.fn(async () => []),
  pedir: vi.fn(async () => ({ amigos: false })),
  aceitar: vi.fn(async () => undefined),
  desfazer: vi.fn(async () => undefined),
  bloquear: vi.fn(async () => undefined),
  desbloquear: vi.fn(async () => undefined),
}));

vi.mock("./loja", async () => {
  const { ListaDeAmigos } = await vi.importActual<typeof import("./lista")>("./lista");
  return { listaDeAmigos: new ListaDeAmigos(api as unknown as ApiDosAmigos, () => "t") };
});

const presencaFalsa = vi.hoisted(() => ({ estadoDaAna: { tipo: "selecao" } as import("@/modules/presenca").EstadoOnline }));

vi.mock("@/modules/presenca", async (original) => ({
  ...(await original<typeof import("@/modules/presenca")>()),
  usePresenca: () => ({ conectada: true, pessoas: [{ id: "a", nome: "AnaRock", avatar: null, estado: presencaFalsa.estadoDaAna }] }),
}));

beforeEach(() => {
  presencaFalsa.estadoDaAna = { tipo: "selecao" };
  api.listas.mockResolvedValue(listas);
});

function abrir(extra: Partial<Parameters<typeof PainelDeAmigos>[0]> = {}) {
  const props = { aoFechar: vi.fn(), aoConvidar: vi.fn(), ...extra };
  render(<PainelDeAmigos {...props} />);
  return { ...props, usuario: userEvent.setup() };
}

describe("PainelDeAmigos", () => {
  it("separa quem está online, com o que está fazendo, de quem está offline", async () => {
    abrir();
    expect(await screen.findByText("Online (1)")).toBeInTheDocument();
    expect(screen.getByText("Offline (1)")).toBeInTheDocument();
    expect(screen.getByText("Escolhendo música")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
    // Fora de uma sala online, não há o que convidar.
    expect(screen.queryByRole("button", { name: "Convidar" })).not.toBeInTheDocument();
  });

  it("numa sala online, convida o amigo online", async () => {
    const { aoConvidar, usuario } = abrir({ salaParaConvidar: "ABCDE" });
    await usuario.click(await screen.findByRole("button", { name: "Convidar" }));
    expect(aoConvidar).toHaveBeenCalledWith("a", "ABCDE");
  });

  it("a busca filtra pelo nome", async () => {
    const { usuario } = abrir();
    await usuario.type(await screen.findByRole("textbox", { name: "Buscar amigos" }), "rafa");
    expect(screen.queryByText("AnaRock")).not.toBeInTheDocument();
    expect(screen.getByText("RafaBass")).toBeInTheDocument();
  });

  it("aceita o pedido recebido", async () => {
    const { usuario } = abrir();
    await usuario.click(await screen.findByRole("tab", { name: /Pedidos/ }));
    await usuario.click(screen.getByRole("button", { name: "Aceitar" }));
    expect(api.aceitar).toHaveBeenCalledWith("t", "g");
  });

  it("adiciona pelo código e mostra o próprio código", async () => {
    const { usuario } = abrir();
    await usuario.click(await screen.findByRole("button", { name: /Adicionar amigo/ }));
    expect(screen.getByText("RIFF-ABCDEF")).toBeInTheDocument();
    await usuario.type(screen.getByRole("textbox", { name: "Código do amigo" }), "riff-xyz234");
    await usuario.click(screen.getByRole("button", { name: "Enviar pedido" }));
    await waitFor(() => expect(api.pedir).toHaveBeenCalledWith("t", { codigo: "riff-xyz234" }));
  });

  it("assiste à partida do amigo que está transmitindo", async () => {
    presencaFalsa.estadoDaAna = { tipo: "tocando", musica: "m", titulo: "T", artista: "A", dificuldade: "expert", instrumento: "guitarra", transmitindo: true };
    const { aoAssistir, usuario } = abrir({ aoAssistir: vi.fn() });
    await usuario.click(await screen.findByRole("button", { name: "Assistir AnaRock" }));
    expect(aoAssistir).toHaveBeenCalledWith({ id: "a", nome: "AnaRock", avatar: null, estado: presencaFalsa.estadoDaAna });
  });

  it("sem transmissão, não aparece o botão de assistir", async () => {
    abrir({ aoAssistir: vi.fn() });
    await screen.findByText("Online (1)");
    expect(screen.queryByRole("button", { name: /Assistir/ })).not.toBeInTheDocument();
  });
});

