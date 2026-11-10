import { renderHook } from "@testing-library/react";
import { ESPERA_PARA_SEGUIR_MS, useSeguirMapa } from "./useSeguirMapa";
import type { FaixaDoPlayer, PlayerDeMusica } from "./playerDeMusica";

const faixa = (id: string) => ({ id, titulo: id });

describe("useSeguirMapa", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("só troca de música quando a seleção para de mexer, e entra no meio dela", () => {
    const player = { seguirMapa: vi.fn() } as unknown as PlayerDeMusica<FaixaDoPlayer>;
    const { rerender } = renderHook(({ f }) => useSeguirMapa(player, f), { initialProps: { f: faixa("a") as FaixaDoPlayer | null } });
    rerender({ f: faixa("b") });
    expect(player.seguirMapa).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ESPERA_PARA_SEGUIR_MS);
    expect(vi.mocked(player.seguirMapa).mock.calls).toEqual([[faixa("b")]]);
  });

  it("sem mapa pedido, não mexe no player", () => {
    const player = { seguirMapa: vi.fn() } as unknown as PlayerDeMusica<FaixaDoPlayer>;
    renderHook(() => useSeguirMapa(player, null));
    vi.advanceTimersByTime(ESPERA_PARA_SEGUIR_MS);
    expect(player.seguirMapa).not.toHaveBeenCalled();
  });
});
