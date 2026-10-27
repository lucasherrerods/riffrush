import { renderHook } from "@testing-library/react";
import type { Musica } from "@/modules/rock/songs";
import { playerDeMusica } from "./playerDeMusica";
import { ESPERA_PARA_SEGUIR_MS, useSeguirMusica } from "./useSeguirMusica";

const musica = (id: string) => ({ id }) as Musica;

describe("useSeguirMusica", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("só troca de música quando a seleção para de mexer", () => {
    const seguir = vi.spyOn(playerDeMusica, "seguir").mockImplementation(() => {});
    const { rerender } = renderHook(({ m }) => useSeguirMusica(m), { initialProps: { m: musica("a") as Musica | null } });
    rerender({ m: musica("b") });
    rerender({ m: musica("c") });
    expect(seguir).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ESPERA_PARA_SEGUIR_MS);
    expect(seguir.mock.calls).toEqual([[musica("c")]]);
  });

  it("sem música pedida, não mexe no player", () => {
    const seguir = vi.spyOn(playerDeMusica, "seguir").mockImplementation(() => {});
    renderHook(() => useSeguirMusica(null));
    vi.advanceTimersByTime(ESPERA_PARA_SEGUIR_MS);
    expect(seguir).not.toHaveBeenCalled();
  });
});
