import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useConta } from "@/modules/conta";
import { ChatGlobal } from "./ChatGlobal";
import type { EstadoDoChatGlobal } from "./conexaoDoChat";
import { chatGlobal } from "./presenca";

vi.mock("@/modules/conta", () => ({ useConta: vi.fn(), sessaoDaConta: { token: () => "t" } }));
vi.mock("./presenca", async () => {
  const { ConexaoDoChatGlobal } = await import("./conexaoDoChat");
  return { chatGlobal: new ConexaoDoChatGlobal({ urlDoRelay: "", pedirFicha: async () => "f" }) };
});

const logado = (id = "eu") => vi.mocked(useConta).mockReturnValue({ conta: { id, nome: "Eu" } as never, carregando: false });
const PODE = { podeEscrever: true, admin: false, banido: false, nivelParaEscrever: 2 };
const ana = { n: 1, autor: { id: "a", nome: "Ana" }, texto: "spam", em: 0 };
const bia = { n: 2, autor: { id: "b", nome: "Bia", equipe: true as const }, texto: "oi", em: 0 };

/** Põe o estado como se tivesse vindo do relay. */
function chegou(parcial: Partial<EstadoDoChatGlobal>) {
  const estado: EstadoDoChatGlobal = { conectado: true, mensagens: [ana, bia], voce: PODE, denuncias: [], banidos: [], ...parcial };
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
    expect(screen.getByText(/A equipe nunca pede senha/)).toBeInTheDocument();
    expect(usar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Ligar o chat" }));
    expect(aoResponder).toHaveBeenCalledWith(true);
  });

  it("aceito, liga a conexão, mostra o selo da equipe e o aviso fixo", () => {
    logado();
    const usar = vi.spyOn(chatGlobal, "usar");
    abrir();
    expect(usar).toHaveBeenCalledTimes(1);
    chegou({});
    expect(screen.getByRole("log", { name: "Chat global" })).toHaveTextContent("Ana: spam");
    expect(screen.getByText("Equipe")).toBeInTheDocument();
    expect(screen.getByText(/Só quem tem o selo Equipe/)).toBeInTheDocument();
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

  it("quem não é da equipe não vê os botões de moderação", () => {
    logado();
    abrir();
    chegou({});
    expect(screen.queryByRole("button", { name: /Banir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Moderação/ })).not.toBeInTheDocument();
  });

  it("a equipe bane, apaga e resolve as denúncias", async () => {
    logado();
    abrir();
    const denuncia = { mensagem: ana, por: { id: "c", nome: "Caio" }, em: 0 };
    chegou({ voce: { ...PODE, admin: true }, denuncias: [denuncia], banidos: [{ id: "x", nome: "Xis" }] });
    const banir = vi.spyOn(chatGlobal, "banir").mockReturnValue(true);
    const resolver = vi.spyOn(chatGlobal, "resolver").mockReturnValue(true);
    const desbanir = vi.spyOn(chatGlobal, "desbanir").mockReturnValue(true);
    // Ninguém da equipe é banido pelo botão.
    expect(screen.queryByRole("button", { name: "Banir Bia" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Moderação \(1\)/ }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(/1 denúncia \(Caio\)/)).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole("button", { name: /Banir Ana/ }));
    expect(banir).toHaveBeenCalledWith("a");
    expect(resolver).toHaveBeenCalledWith(1);
    await userEvent.click(within(dialogo).getByRole("button", { name: "Desbanir" }));
    expect(desbanir).toHaveBeenCalledWith("x");
  });
});
