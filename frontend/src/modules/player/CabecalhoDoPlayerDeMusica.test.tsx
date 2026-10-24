import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CabecalhoDoPlayerDeMusica } from "./CabecalhoDoPlayerDeMusica";

function abrir(volumeInicial = 0.3) {
  const aoMudarVolume = vi.fn();
  function ComEstado() {
    const [volume, setVolume] = useState(volumeInicial);
    return (
      <CabecalhoDoPlayerDeMusica
        volume={volume}
        aoMudarVolume={(novo) => {
          aoMudarVolume(novo);
          setVolume(novo);
        }}
      />
    );
  }
  render(<ComEstado />);
  return { aoMudarVolume, usuario: userEvent.setup() };
}

describe("CabecalhoDoPlayerDeMusica", () => {
  it("o slider de volume mostra o volume atual e muda com as setas", async () => {
    const { aoMudarVolume, usuario } = abrir(0.3);
    const slider = screen.getByRole("slider", { name: "Volume do player" });
    expect(slider).toHaveAttribute("aria-valuenow", "0.3");
    slider.focus();
    await usuario.keyboard("{ArrowRight}");
    expect(aoMudarVolume).toHaveBeenLastCalledWith(0.35);
  });

  it("o botão de volume muta e devolve o volume de antes", async () => {
    const { aoMudarVolume, usuario } = abrir(0.3);
    await usuario.click(screen.getByRole("button", { name: "Mutar" }));
    expect(aoMudarVolume).toHaveBeenLastCalledWith(0);
    await usuario.click(screen.getByRole("button", { name: "Tirar do mudo" }));
    expect(aoMudarVolume).toHaveBeenLastCalledWith(0.3);
  });
});
