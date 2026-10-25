import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useConta } from "@/modules/conta";
import { ChatGlobal } from "./ChatGlobal";
import { chatGlobal } from "./presenca";

vi.mock("@/modules/conta", () => ({ useConta: vi.fn(), sessaoDaConta: { token: () => "t" } }));
vi.mock("./presenca", async () => {
  const { ConexaoDoChatGlobal } = await import("./conexaoDoChat");
  return { chatGlobal: new ConexaoDoChatGlobal({ urlDoRelay: "", pedirFicha: async () => "f" }) };
});

const logado = (id = "eu") => vi.mocked(useConta).mockReturnValue({ conta: { id, nome: "Eu" } as never, carregando: false });

/** Põe mensagens no estado como se tivessem vindo do relay. */
function chegou(...mensagens: { n: number; id: string; nome: string; texto: string }[]) {
  const estado = { conectado: true, mensagens: mensagens.map((m) => ({ n: m.n, autor: { id: m.id, nome: m.nome }, texto: m.texto, em: 0 })) };
  act(() => {
    (chatGlobal as unknown as { mudar: (e: typeof estado) => void }).mudar(estado);
  });
}

beforeEach(() => localStorage.clear());

describe("ChatGlobal", () => {
  it("sem conta, pede para entrar e não liga a conexão", () => {
    vi.mocked(useConta).mockReturnValue({ conta: null, carregando: false });
    const usar = vi.spyOn(chatGlobal, "usar");
    render(<ChatGlobal />);
    expect(screen.getByText(/Entre com a sua conta/)).toBeInTheDocument();
    expect(usar).not.toHaveBeenCalled();
  });

  it("com conta, liga a conexão enquanto aparece e mostra as mensagens", () => {
    logado();
    const usar = vi.spyOn(chatGlobal, "usar");
    const { unmount } = render(<ChatGlobal />);
    expect(usar).toHaveBeenCalledTimes(1);
    chegou({ n: 1, id: "a", nome: "Ana", texto: "salve" }, { n: 2, id: "eu", nome: "Eu", texto: "opa" });
    expect(screen.getByRole("log", { name: "Chat global" })).toHaveTextContent("Ana: salve");
    unmount();
  });

  it("silenciar some com as mensagens da pessoa, lembra depois e dá para desfazer", async () => {
    logado();
    const { unmount } = render(<ChatGlobal />);
    chegou({ n: 1, id: "a", nome: "Ana", texto: "spam" }, { n: 2, id: "b", nome: "Bia", texto: "oi" });
    await userEvent.click(screen.getByRole("button", { name: "Silenciar Ana" }));
    expect(screen.queryByText("spam")).not.toBeInTheDocument();
    expect(screen.getByText("oi")).toBeInTheDocument();
    unmount();

    render(<ChatGlobal />);
    chegou({ n: 1, id: "a", nome: "Ana", texto: "spam" });
    expect(screen.queryByText("spam")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Mostrar silenciados \(1\)/ }));
    expect(screen.getByText("spam")).toBeInTheDocument();
  });
});
