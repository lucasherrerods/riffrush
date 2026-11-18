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
  it("o card de quem ainda baixa a escolha mostra que está baixando", () => {
    lobby({ sala: sala({ baixando: [2] }) });
    const ana = screen.getByText("Ana").closest("li")!;
    expect(ana).toHaveTextContent("Baixando");
    expect(screen.getByText("Lu").closest("li")).not.toHaveTextContent("Baixando");
  });

  it("o convidado avisa a sala quando começa e termina de baixar", () => {
    const aoAvisarPreparo = vi.fn();
    const props = { sala: sala(), escolha: null, podeComecar: true, volumeDosEfeitos: 0, aoComecar: vi.fn(async () => {}), aoPronto: vi.fn(), aoExpulsar: vi.fn(), aoPassarLideranca: vi.fn(), aoEnviarChat: vi.fn(() => true), aoAvisarPreparo };
    const { rerender } = render(<LobbyDaSala {...props} preparo={{ tipo: "baixando" }} />);
    expect(aoAvisarPreparo).toHaveBeenLastCalledWith(true);
    rerender(<LobbyDaSala {...props} preparo={{ tipo: "pronta" }} />);
    expect(aoAvisarPreparo).toHaveBeenLastCalledWith(false);
  });

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
