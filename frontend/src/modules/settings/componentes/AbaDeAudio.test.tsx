import { fireEvent, render, screen } from "@testing-library/react";
import { PREFERENCIAS_DE_AUDIO_PADRAO } from "@/modules/audio";
import { AbaDeAudio } from "./AbaDeAudio";

it("mostra os três volumes, sem um volume à parte para a música do menu, e devolve só o que mudou", () => {
  const aoMudar = vi.fn();
  render(<AbaDeAudio valores={PREFERENCIAS_DE_AUDIO_PADRAO} aoMudar={aoMudar} />);
  for (const nome of ["Volume geral", "Volume da música", "Volume dos efeitos"]) expect(screen.getByRole("slider", { name: nome })).toBeInTheDocument();
  expect(screen.queryByRole("slider", { name: "Música do menu" })).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("slider", { name: "Volume da música" }), { key: "ArrowRight" });
  expect(aoMudar).toHaveBeenCalledWith({ volumeDaMusica: 0.85 });
});
