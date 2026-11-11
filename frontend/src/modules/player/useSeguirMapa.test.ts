import { renderHook } from "@testing-library/react";
import { ESPERA_PARA_SEGUIR_MS, useSeguirMapa } from "./useSeguirMapa";
import { useMusicaAoEntrar } from "./useMusicaAoEntrar";
import type { FaixaDoPlayer, PlayerDeMusica } from "./playerDeMusica";

const faixa = (id: string) => ({ id, titulo: id });

describe("useSeguirMapa", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("só troca de música quando a seleção para de mexer, e entra no meio dela", () => {
    const player = { seguirMapa: vi.fn(), naMemoria: () => false } as unknown as PlayerDeMusica<FaixaDoPlayer>;
    const { rerender } = renderHook(({ f }) => useSeguirMapa(player, f), { initialProps: { f: faixa("a") as FaixaDoPlayer | null } });
    rerender({ f: faixa("b") });
    expect(player.seguirMapa).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ESPERA_PARA_SEGUIR_MS);
    expect(vi.mocked(player.seguirMapa).mock.calls).toEqual([[faixa("b")]]);
  });

  it("sem mapa pedido, não mexe no player", () => {
    const player = { seguirMapa: vi.fn(), naMemoria: () => false } as unknown as PlayerDeMusica<FaixaDoPlayer>;
    renderHook(() => useSeguirMapa(player, null));
    vi.advanceTimersByTime(ESPERA_PARA_SEGUIR_MS);
    expect(player.seguirMapa).not.toHaveBeenCalled();
  });

  it("mapa já carregado na memória toca na hora, sem esperar", () => {
    const player = { seguirMapa: vi.fn(), naMemoria: () => true } as unknown as PlayerDeMusica<FaixaDoPlayer>;
    renderHook(() => useSeguirMapa(player, faixa("a")));
    expect(vi.mocked(player.seguirMapa).mock.calls).toEqual([[faixa("a")]]);
  });

  describe("na tela que abre na música que está tocando", () => {
    const tocando = (id: string | null) => {
      const estado = { musica: id ? faixa(id) : null };
      return {
        estado: () => estado,
        naMemoria: () => true,
        seguirMapa: vi.fn((f: FaixaDoPlayer) => {
          estado.musica = f;
        }),
      } as unknown as PlayerDeMusica<FaixaDoPlayer>;
    };

    it("trocar no player e abrir a seleção mostra a música do player, sem voltar à antiga", () => {
      const player = tocando("b");
      const aoEntrar = vi.fn();
      // Mesma ordem das telas: o carrossel ainda está no mapa antigo quando a seleção abre.
      const { rerender } = renderHook(
        ({ f, dentro }) => {
          useSeguirMapa(player, f, { ficaNaQueTocaAoEntrar: true });
          useMusicaAoEntrar(player, dentro, aoEntrar);
        },
        { initialProps: { f: null as FaixaDoPlayer | null, dentro: false } },
      );
      rerender({ f: faixa("a"), dentro: true });
      expect(player.seguirMapa).not.toHaveBeenCalled();
      expect(aoEntrar).toHaveBeenCalledWith("b");
    });

    it("depois de entrar, mexer no carrossel volta a trocar a música", () => {
      const player = tocando("b");
      const { rerender } = renderHook(({ f }) => useSeguirMapa(player, f, { ficaNaQueTocaAoEntrar: true }), { initialProps: { f: null as FaixaDoPlayer | null } });
      rerender({ f: faixa("b") });
      rerender({ f: faixa("c") });
      expect(vi.mocked(player.seguirMapa).mock.calls).toEqual([[faixa("c")]]);
    });

    it("com o player calado, a seleção ao abrir toca o mapa dela", () => {
      const player = tocando(null);
      const { rerender } = renderHook(({ f }) => useSeguirMapa(player, f, { ficaNaQueTocaAoEntrar: true }), { initialProps: { f: null as FaixaDoPlayer | null } });
      rerender({ f: faixa("a") });
      expect(vi.mocked(player.seguirMapa).mock.calls).toEqual([[faixa("a")]]);
    });
  });
});
