import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LobbyDaSala, type PropsDoLobby } from "./LobbyDaSala";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,qr") } }));

const sala = (extra: Partial<PropsDoLobby["sala"]> = {}): PropsDoLobby["sala"] => ({
  souHost: false,
  meuId: 2,
  hostId: 1,
  jogadores: [
    { id: 1, personagem: { nome: "Lu" } },
    { id: 2, personagem: { nome: "Ana", nivel: 3 } },
  ],
  prontos: [],
  chat: [],
  ...extra,
});

function lobby(extra: Partial<PropsDoLobby> = {}) {
  const props: PropsDoLobby = {
    sala: sala(),
    escolha: <p>o mapa escolhido</p>,
    preparo: { tipo: "pronta" },
    podeComecar: true,
    volumeDosEfeitos: 0,
    aoComecar: vi.fn(async () => {}),
    aoPronto: vi.fn(),
    aoExpulsar: vi.fn(),
    aoPassarLideranca: vi.fn(),
    aoEnviarChat: vi.fn(() => true),
    ...extra,
  };
  render(<LobbyDaSala {...props} />);
  return props;
}

describe("LobbyDaSala", () => {
  it("mostra os jogadores, as vagas e a escolha que o modo mandou", () => {
    lobby();
    expect(screen.getByText("Lu")).toBeInTheDocument();
    expect(screen.getByText("Nv 3")).toBeInTheDocument();
    expect(screen.getAllByText("Esperando...")).toHaveLength(2);
    expect(screen.getByText("o mapa escolhido")).toBeInTheDocument();
  });

  it("o convidado dá pronto", async () => {
    const props = lobby();
    await userEvent.click(screen.getByRole("button", { name: /Estou pronto/ }));
    expect(props.aoPronto).toHaveBeenCalledWith(true);
  });

  it("enquanto baixa a escolha, mostra o rótulo do modo no lugar do pronto", () => {
    lobby({ preparo: { tipo: "baixando" }, rotuloDoDownload: "Baixando o mapa..." });
    expect(screen.getByText("Baixando o mapa...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Estou pronto/ })).toBeNull();
  });

  it("o host começa quando todos estão prontos", async () => {
    const props = lobby({ sala: sala({ souHost: true, meuId: 1, prontos: [2] }) });
    await userEvent.click(screen.getByRole("button", { name: /Começar partida/ }));
    expect(props.aoComecar).toHaveBeenCalled();
  });
});
