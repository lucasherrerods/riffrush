import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("mostra as estatísticas da partida", () => {
    abrir();
    expect(screen.getByText("90 / 100")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
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
