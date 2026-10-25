import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useConta } from "@/modules/conta";
import { apiDaPresenca } from "./api";
import { ChatGlobal } from "./ChatGlobal";
import type { EstadoDoChatGlobal } from "./conexaoDoChat";
import { chatGlobal } from "./presenca";

vi.mock("@/modules/conta", () => ({ useConta: vi.fn(), sessaoDaConta: { token: () => "t" } }));
vi.mock("./api", () => ({
  apiDaPresenca: { denuncias: vi.fn(async () => []), banidos: vi.fn(async () => []), banir: vi.fn(async () => {}), desbanir: vi.fn(async () => {}), resolver: vi.fn(async () => {}) },
}));
vi.mock("./presenca", async () => {
  const { ConexaoDoChatGlobal } = await import("./conexaoDoChat");
  return { chatGlobal: new ConexaoDoChatGlobal({ urlDoRelay: "", pedirFicha: async () => "f" }) };
});

const logado = (id = "eu") => vi.mocked(useConta).mockReturnValue({ conta: { id, nome: "Eu" } as never, carregando: false });
const PODE = { podeEscrever: true, admin: false, banido: false, nivelParaEscrever: 2 };
const ana = { n: 1, autor: { id: "a", nome: "Ana" }, texto: "spam", em: 0 };
const bia = { n: 2, autor: { id: "b", nome: "Bia", moderacao: true as const }, texto: "oi", em: 0 };

/** Põe o estado como se tivesse vindo do relay. */
function chegou(parcial: Partial<EstadoDoChatGlobal>) {
  const estado: EstadoDoChatGlobal = { conectado: true, mensagens: [ana, bia], voce: PODE, ...parcial };
  act(() => (chatGlobal as unknown as { mudar: (e: EstadoDoChatGlobal) => void }).mudar(estado));
}

const abrir = (aceito: boolean | null = true, aoResponder = vi.fn()) => ({ ...render(<ChatGlobal aceito={aceito} aoResponder={aoResponder} />), aoResponder });

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ChatGlobal", () => {
  it("sem conta, pede para entrar e não liga a conexão", () => {
    vi.mocked(useConta).mockReturnValue({ conta: null, carregando: false });
    const usar = vi.spyOn(chatGlobal, "usar");
    abrir();
    expect(screen.getByText(/Entre com a sua conta/)).toBeInTheDocument();
    expect(usar).not.toHaveBeenCalled();
  });

  it("na primeira vez mostra as regras, e só liga depois de aceitar", async () => {
    logado();
    const usar = vi.spyOn(chatGlobal, "usar");
    const { aoResponder } = abrir(null);
    expect(screen.getByText(/A moderação nunca pede senha/)).toBeInTheDocument();
    expect(usar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Ligar o chat" }));
    expect(aoResponder).toHaveBeenCalledWith(true);
  });

  it("aceito, liga a conexão, mostra o selo da moderação e o aviso fica no ícone de informação", async () => {
    logado();
    const usar = vi.spyOn(chatGlobal, "usar");
    abrir();
    expect(usar).toHaveBeenCalledTimes(1);
    chegou({});
    expect(screen.getByRole("log", { name: "Chat global" })).toHaveTextContent("Ana: spam");
    expect(screen.getByText("Mod")).toBeInTheDocument();
    expect(screen.queryByText(/Só quem tem o selo Mod/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sobre a moderação" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Só quem tem o selo Mod");
  });

  it("abaixo do nível, lê mas não escreve; banido, avisa", () => {
    logado();
    abrir();
    chegou({ voce: { ...PODE, podeEscrever: false } });
    expect(screen.getByText(/Chegue ao nível 2 para escrever/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    chegou({ voce: { ...PODE, podeEscrever: false, banido: true } });
    expect(screen.getByText(/Você foi banido/)).toBeInTheDocument();
  });

  it("denuncia uma mensagem", async () => {
    logado();
    abrir();
    chegou({});
    const denunciar = vi.spyOn(chatGlobal, "denunciar").mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Denunciar mensagem de Ana" }));
    expect(denunciar).toHaveBeenCalledWith(1);
  });

  it("silenciar some com as mensagens da pessoa, lembra depois e dá para desfazer", async () => {
    logado();
    const { unmount } = abrir();
    chegou({});
    await userEvent.click(screen.getByRole("button", { name: "Silenciar Ana" }));
    expect(screen.queryByText("spam")).not.toBeInTheDocument();
    expect(screen.getByText("oi")).toBeInTheDocument();
    unmount();

    abrir();
    chegou({});
    expect(screen.queryByText("spam")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Mostrar silenciados \(1\)/ }));
    expect(screen.getByText("spam")).toBeInTheDocument();
  });

  it("quem não é da moderação não vê os botões de moderação", () => {
    logado();
    abrir();
    chegou({});
    expect(screen.queryByRole("button", { name: /Banir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Moderação/ })).not.toBeInTheDocument();
  });

  it("a moderação vê as denúncias e os banidos da API, e bane e desbane por ela", async () => {
    logado();
    const denuncia = { mensagem_n: 1, autor_id: "a", autor_nome: "Ana", texto: "spam", mensagem_em: "", denunciante_nome: "Caio", criada_em: "" };
    vi.mocked(apiDaPresenca.denuncias).mockResolvedValue([denuncia]);
    vi.mocked(apiDaPresenca.banidos).mockResolvedValue([{ conta_id: "x", nome: "Xis" }]);
    abrir();
    chegou({ voce: { ...PODE, admin: true } });
    // Ninguém da moderação é banido pelo botão.
    expect(screen.queryByRole("button", { name: "Banir Bia" })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /Moderação \(1\)/ }));
    const dialogo = screen.getByRole("dialog");
    expect(await within(dialogo).findByText(/1 denúncia \(Caio\)/)).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole("button", { name: /Banir Ana/ }));
    await waitFor(() => expect(apiDaPresenca.banir).toHaveBeenCalledWith("t", "a"));
    await waitFor(() => expect(apiDaPresenca.resolver).toHaveBeenCalledWith("t", 1));
    await userEvent.click(within(dialogo).getByRole("button", { name: "Desbanir" }));
    await waitFor(() => expect(apiDaPresenca.desbanir).toHaveBeenCalledWith("t", "x"));
  });
});
