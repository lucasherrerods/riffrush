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
  it("com a escolha como função, o pronto do convidado vai dentro dela e não se repete embaixo", () => {
    lobby({ escolha: (acao) => <section aria-label="cartão">{acao}</section> });
    expect(screen.getAllByRole("button", { name: /Estou pronto/ })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "cartão" })).toContainElement(screen.getByRole("button", { name: /Estou pronto/ }));
  });

  it("a foto da conta vira a capa do card, e quem está pronto ganha o carimbo", () => {
    const { container } = render(
      <LobbyDaSala
        sala={sala({ jogadores: [{ id: 1, personagem: { nome: "Lu", avatar: "https://exemplo.com/lu.png" } }, { id: 2, personagem: { nome: "Ana" } }], prontos: [2] })}
        escolha={null}
        preparo={{ tipo: "pronta" }}
        podeComecar
        volumeDosEfeitos={0}
        aoComecar={vi.fn(async () => {})}
        aoPronto={vi.fn()}
        aoExpulsar={vi.fn()}
        aoPassarLideranca={vi.fn()}
        aoEnviarChat={vi.fn(() => true)}
      />,
    );
    expect(container.querySelector('img[src="https://exemplo.com/lu.png"]')).not.toBeNull();
    expect(screen.getByText("Ana").closest("li")).toHaveTextContent("Pronto");
    expect(screen.getByText("Lu").closest("li")).not.toHaveTextContent("Pronto");
  });

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
    expect(screen.getAllByText("Vaga livre")).toHaveLength(2);
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
