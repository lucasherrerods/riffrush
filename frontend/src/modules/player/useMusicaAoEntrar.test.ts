import { renderHook } from "@testing-library/react";
import type { FaixaDoPlayer, PlayerDeMusica } from "./playerDeMusica";
import { useMusicaAoEntrar } from "./useMusicaAoEntrar";

const player = (id?: string) => ({ estado: () => ({ musica: id ? { id, titulo: id } : null }) }) as unknown as PlayerDeMusica<FaixaDoPlayer>;

describe("useMusicaAoEntrar", () => {
  it("ao entrar na tela, avisa a música que o player está tocando", () => {
    const aoEntrar = vi.fn();
    const tocandoB = player("b");
    const { rerender } = renderHook(({ dentro }) => useMusicaAoEntrar(tocandoB, dentro, aoEntrar), { initialProps: { dentro: false } });
    expect(aoEntrar).not.toHaveBeenCalled();
    rerender({ dentro: true });
    expect(aoEntrar).toHaveBeenCalledWith("b");
    rerender({ dentro: true });
    expect(aoEntrar).toHaveBeenCalledTimes(1);
  });

  it("sem música no player, não avisa nada", () => {
    const aoEntrar = vi.fn();
    renderHook(() => useMusicaAoEntrar(player(), true, aoEntrar));
    expect(aoEntrar).not.toHaveBeenCalled();
  });
});
