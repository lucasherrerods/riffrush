import { render, screen, waitFor, within } from "@testing-library/react";
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

const conversasFalsas = vi.hoisted(() => {
  let atual: import("./conversas").Conversas = {};
  const ouvintes = new Set<() => void>();
  return {
    inscrever: (o: () => void) => (ouvintes.add(o), () => void ouvintes.delete(o)),
    estado: () => atual,
    enviar: vi.fn(async () => undefined),
    carregar: vi.fn(async () => undefined),
    marcarComoLida: vi.fn(),
    definir(novas: import("./conversas").Conversas) {
      atual = novas;
      for (const o of ouvintes) o();
    },
  };
});

vi.mock("./loja", async () => {
  const { ListaDeAmigos } = await vi.importActual<typeof import("./lista")>("./lista");
  return { listaDeAmigos: new ListaDeAmigos(api as unknown as ApiDosAmigos, () => "t"), conversas: conversasFalsas };
});

const presencaFalsa = vi.hoisted(() => ({ estadoDaAna: { tipo: "selecao" } as import("@/modules/presenca").EstadoOnline }));

vi.mock("@/modules/presenca", async (original) => ({
  ...(await original<typeof import("@/modules/presenca")>()),
  usePresenca: () => ({ conectada: true, pessoas: [{ id: "a", nome: "AnaRock", avatar: null, estado: presencaFalsa.estadoDaAna }] }),
}));

beforeEach(() => {
  presencaFalsa.estadoDaAna = { tipo: "selecao" };
  conversasFalsas.definir({});
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

  it("conversa com o amigo: mostra o que chegou, marca como lido e manda mensagem", async () => {
    conversasFalsas.definir({ a: { mensagens: [{ id: 1, de: "a", texto: "bora jogar?", em: 1 }], naoLidas: 1, carregada: true } });
    const { usuario } = abrir();
    const botao = await screen.findByRole("button", { name: "Conversar com AnaRock" });
    expect(within(botao).getByLabelText("1 pendentes")).toBeInTheDocument();
    await usuario.click(botao);
    expect(screen.getByText("bora jogar?")).toBeInTheDocument();
    expect(conversasFalsas.carregar).toHaveBeenCalledWith("a");
    expect(conversasFalsas.marcarComoLida).toHaveBeenCalledWith("a");
    await usuario.type(screen.getByRole("textbox", { name: "Mensagem" }), "agora!{Enter}");
    expect(conversasFalsas.enviar).toHaveBeenCalledWith("a", "agora!");
    await usuario.click(screen.getByRole("button", { name: "Voltar para os amigos" }));
    expect(screen.getByText("Online (1)")).toBeInTheDocument();
  });

  it("com o amigo offline, a mensagem sai e fica guardada para ele", async () => {
    const { usuario } = abrir();
    await usuario.click(await screen.findByRole("button", { name: "Conversar com RafaBass" }));
    await usuario.type(screen.getByRole("textbox", { name: "Mensagem" }), "joga depois?{Enter}");
    expect(conversasFalsas.enviar).toHaveBeenCalledWith("r", "joga depois?");
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

