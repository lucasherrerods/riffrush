import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ResultadoDaBusca } from "./encore";
import { JanelaDoChart } from "./JanelaDoChart";

const chart: ResultadoDaBusca = {
  md5: "8d633d2940da9b3acda9074c2385e672",
  titulo: "Enter Sandman",
  artista: "Metallica",
  album: "Metallica",
  genero: "Metal",
  ano: "1991",
  charter: "Alguém",
  duracaoMs: 331000,
  instrumentos: ["guitarra"],
  versaoDoEncoder: 0,
  temVideo: false,
};

function abrir(props: Partial<React.ComponentProps<typeof JanelaDoChart>> = {}) {
  const aoBaixar = vi.fn(async () => true);
  const aoJogar = vi.fn();
  const aoFechar = vi.fn();
  render(<JanelaDoChart md5={chart.md5} aoFechar={aoFechar} aoBaixar={aoBaixar} baixadas={new Set()} aoJogar={aoJogar} buscarChart={async () => chart} {...props} />);
  return { aoBaixar, aoJogar, aoFechar, usuario: userEvent.setup() };
}

describe("JanelaDoChart", () => {
  it("acha o chart pelo md5 e baixa sem vídeo", async () => {
    const { aoBaixar, usuario } = abrir();
    expect(await screen.findByText("Enter Sandman")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Baixar Enter Sandman" }));
    expect(aoBaixar).toHaveBeenCalledWith(chart, expect.objectContaining({ comVideo: false }));
  });

  it("chart que já está na biblioteca mostra o Jogar", async () => {
    const { aoJogar, usuario } = abrir({ baixadas: new Set([chart.md5]) });
    await usuario.click(await screen.findByRole("button", { name: "Jogar Enter Sandman" }));
    expect(aoJogar).toHaveBeenCalledWith(chart.md5);
  });

  it("avisa quando o Encore não tem mais o chart", async () => {
    abrir({ buscarChart: async () => null });
    expect(await screen.findByRole("alert")).toHaveTextContent("não está mais no Encore");
  });

  it("Esc fecha a janela", async () => {
    const { aoFechar, usuario } = abrir();
    await screen.findByText("Enter Sandman");
    await usuario.keyboard("{Escape}");
    expect(aoFechar).toHaveBeenCalled();
  });
});
