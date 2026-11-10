import { renderHook } from "@testing-library/react";
import type { FaixaDoPlayer, PlayerDeMusica } from "./playerDeMusica";
import { useTrilhaDaPartida, type FaseDaTrilha } from "./useTrilhaDaPartida";

const faixa = { id: "a", titulo: "a" };

function montar() {
  const player = { suspender: vi.fn(), voltarDaPartida: vi.fn() };
  const hook = renderHook(({ fase }) => useTrilhaDaPartida(player as unknown as PlayerDeMusica<FaixaDoPlayer>, faixa, fase), {
    initialProps: { fase: "menu" as FaseDaTrilha },
  });
  return { player, ...hook };
}

describe("useTrilhaDaPartida", () => {
  it("cala na partida e, saindo por conta própria, volta do ponto da saída", () => {
    const { player, result, rerender } = montar();
    rerender({ fase: "jogo" });
    expect(player.suspender).toHaveBeenLastCalledWith(true, { esmaecer: false });
    result.current(42);
    rerender({ fase: "menu" });
    expect(player.voltarDaPartida).toHaveBeenCalledWith(faixa, { tipo: "saiu", segundos: 42 });
    expect(player.suspender).toHaveBeenLastCalledWith(false, { esmaecer: true });
  });

  it("na tela de falha continua calado e, no menu, volta num ponto sorteado", () => {
    const { player, result, rerender } = montar();
    rerender({ fase: "jogo" });
    result.current(42);
    rerender({ fase: "falha" });
    expect(player.suspender).toHaveBeenLastCalledWith(true, { esmaecer: false });
    expect(player.voltarDaPartida).not.toHaveBeenCalled();
    rerender({ fase: "menu" });
    expect(player.voltarDaPartida).toHaveBeenCalledWith(faixa, { tipo: "falhou" });
  });

  it("jogar de novo depois da falha e sair por conta própria mantém o tempo", () => {
    const { player, result, rerender } = montar();
    rerender({ fase: "jogo" });
    rerender({ fase: "falha" });
    rerender({ fase: "jogo" });
    result.current(10);
    rerender({ fase: "menu" });
    expect(player.voltarDaPartida).toHaveBeenCalledWith(faixa, { tipo: "saiu", segundos: 10 });
  });

  it("sem partida no meio, não mexe na música", () => {
    const { player, rerender } = montar();
    rerender({ fase: "menu" });
    expect(player.voltarDaPartida).not.toHaveBeenCalled();
  });
});
