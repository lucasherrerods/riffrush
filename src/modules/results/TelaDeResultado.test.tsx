import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { registrarUso } from "@/modules/gamepad";
import type { Resultado } from "@/modules/gameplay";
import { AudioContextFalso } from "@/test/audioFalso";
import { TelaDeResultado } from "./TelaDeResultado";

const resultado: Resultado = {
  musicaId: "neon",
  dificuldade: "expert",
  pontos: 12345,
  acertos: 90,
  total: 100,
  maiorSequencia: 42,
  derrota: false,
};

function abrir(extra: Partial<Parameters<typeof TelaDeResultado>[0]> = {}) {
  const aoRepetir = vi.fn();
  const aoContinuar = vi.fn();
  render(
    <TelaDeResultado
      titulo="Neon Highway"
      artista="The Synthwave Riders"
      resultado={resultado}
      recordeNovo={false}
      volumeDosEfeitos={0}
      aoRepetir={aoRepetir}
      aoContinuar={aoContinuar}
      {...extra}
    />,
  );
  return { aoRepetir, aoContinuar, usuario: userEvent.setup() };
}

beforeEach(() => vi.stubGlobal("AudioContext", AudioContextFalso));

describe("TelaDeResultado", () => {
  it("mostra a música, os pontos e as estrelas", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Neon Highway" })).toBeInTheDocument();
    expect(screen.getByLabelText("12.345 pontos")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4 de 5 estrelas" })).toBeInTheDocument();
  });

  it("mostra a precisão em destaque logo abaixo da pontuação", () => {
    abrir();
    const precisao = screen.getByLabelText("Precisão");
    expect(precisao).toHaveTextContent("90%");
    expect(precisao).toHaveClass("text-ouro");
    expect(screen.getByLabelText("12.345 pontos").compareDocumentPosition(precisao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("mostra as estatísticas da partida", () => {
    abrir();
    expect(screen.getByText("90 / 100")).toBeInTheDocument();
    expect(screen.getAllByText("90%")).toHaveLength(1);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Expert")).toBeInTheDocument();
  });

  it("mostra o selo de recorde novo", () => {
    abrir({ recordeNovo: true });
    expect(screen.getByText(/Novo recorde/i)).toBeInTheDocument();
  });

  it("mostra o selo de full combo quando acertou todas", () => {
    abrir({ resultado: { ...resultado, acertos: 100 } });
    expect(screen.getByText(/Full combo/i)).toBeInTheDocument();
  });

  it("Enter e Esc continuam; R toca de novo", async () => {
    const { aoRepetir, aoContinuar, usuario } = abrir();
    await usuario.keyboard("{Enter}");
    await usuario.keyboard("{Escape}");
    expect(aoContinuar).toHaveBeenCalledTimes(2);
    await usuario.keyboard("r");
    expect(aoRepetir).toHaveBeenCalled();
  });

  it("os botões fazem o mesmo que os atalhos", async () => {
    const { aoRepetir, aoContinuar, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: /Tocar de novo/ }));
    await usuario.click(screen.getByRole("button", { name: /Escolher outra/ }));
    expect(aoRepetir).toHaveBeenCalled();
    expect(aoContinuar).toHaveBeenCalled();
  });
});

describe("TelaDeResultado com controle", () => {
  afterEach(() => registrarUso("teclado"));

  it("o atalho do botão continuar vira o botão A, e o R some porque o controle não tem", () => {
    abrir();
    expect(screen.getByRole("button", { name: /Escolher outra/ })).toHaveTextContent("(Enter)");
    act(() => registrarUso("controle"));
    expect(screen.getByRole("button", { name: /Escolher outra/ })).toHaveTextContent("(A)");
    expect(screen.getByRole("button", { name: /Tocar de novo/ })).not.toHaveTextContent("(R)");
  });
});

describe("TelaDeResultado em rede", () => {
  it("mostra o placar da sala e volta para a sala", async () => {
    const { aoContinuar, usuario } = abrir({ extra: <p>placar da sala</p>, rotuloDeContinuar: "Voltar para a sala" });
    expect(screen.getByText("placar da sala")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Voltar para a sala/ }));
    expect(aoContinuar).toHaveBeenCalled();
  });

  it("em rede não dá para tocar de novo sozinho", async () => {
    const { aoRepetir, usuario } = abrir({ rotuloDeContinuar: "Voltar para a sala" });
    expect(screen.queryByRole("button", { name: /Tocar de novo/ })).toBeNull();
    await usuario.keyboard("r");
    expect(aoRepetir).not.toHaveBeenCalled();
  });
});
