import { renderHook } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
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
  // Bug: a tela abria um quadro no item antigo e o carrossel rolava até a música do player.
  it("o primeiro render dentro da tela já tem a música do player, sem passar pela antiga", () => {
    const tocandoB = player("b");
    const vistos: string[] = [];
    const { rerender } = renderHook(
      ({ dentro }) => {
        const [id, setId] = useState("a");
        useMusicaAoEntrar(tocandoB, dentro, setId);
        // O que chega na tela: só renders commitados.
        useLayoutEffect(() => {
          if (dentro) vistos.push(id);
        });
      },
      { initialProps: { dentro: false } },
    );
    rerender({ dentro: true });
    expect(vistos).not.toContain("a");
    expect(vistos.at(-1)).toBe("b");
  });
});
