import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RankingDaSelecao } from "./RankingDaSelecao";

describe("RankingDaSelecao", () => {
  it("abre no jeito do jogador e troca de ranking ao escolher outro", async () => {
    const api = { buscar: vi.fn(async () => ({ jogadores: 0, top: [], meu: null })) };
    render(<RankingDaSelecao musicaId="m" dificuldade="expert" jeitoInicial="tapping" api={api} atrasoMs={0} lerToken={() => null} />);
    await vi.waitFor(() => expect(api.buscar).toHaveBeenLastCalledWith("m", "expert", expect.objectContaining({ jeito: "tapping" })));
    await userEvent.click(screen.getByRole("radio", { name: "Palhetada" }));
    await vi.waitFor(() => expect(api.buscar).toHaveBeenLastCalledWith("m", "expert", expect.objectContaining({ jeito: "palhetada" })));
  });
});
