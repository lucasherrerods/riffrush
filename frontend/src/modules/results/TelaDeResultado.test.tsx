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
  it("partida de outra pessoa mostra de quem é, e a sequência que a API não tem vira traço", () => {
    abrir({ resultado: { ...resultado, maiorSequencia: null }, jogador: { nome: "Srr 4", avatar: null } });
    expect(screen.getByText("Partida de Srr 4")).toBeInTheDocument();
    expect(screen.getByText("Maior sequência").previousSibling).toHaveTextContent("—");
  });

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

  it("usa a precisão de cada julgamento, com duas casas, e mostra quantos de cada", () => {
    abrir({ resultado: { ...resultado, precisao: 0.8535, julgamentos: { perfeito: 80, otimo: 7, bom: 3 } } });
    expect(screen.getByLabelText("Precisão")).toHaveTextContent("85,35%");
    expect(screen.getByText("Perfeito").previousSibling).toHaveTextContent("80");
    expect(screen.getByText("Ótimo").previousSibling).toHaveTextContent("7");
    expect(screen.getByText("Bom").previousSibling).toHaveTextContent("3");
    expect(screen.getByText("Erro").previousSibling).toHaveTextContent("10");
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

  // Bug: com a sala cheia, o placar empurrava o botão de voltar para fora da tela, sem rolagem.
  it("o placar rola e o botão de voltar fica sempre visível embaixo", () => {
    abrir({ extra: <p>placar da sala</p>, rotuloDeContinuar: "Voltar para a sala" });
    const conteudo = screen.getByText("placar da sala").closest(".overflow-y-auto");
    expect(conteudo).not.toBeNull();
    expect(conteudo).not.toContainElement(screen.getByRole("button", { name: /Voltar para a sala/ }));
  });

  it("em rede não dá para tocar de novo sozinho", async () => {
    const { aoRepetir, usuario } = abrir({ rotuloDeContinuar: "Voltar para a sala" });
    expect(screen.queryByRole("button", { name: /Tocar de novo/ })).toBeNull();
    await usuario.keyboard("r");
    expect(aoRepetir).not.toHaveBeenCalled();
  });
});
