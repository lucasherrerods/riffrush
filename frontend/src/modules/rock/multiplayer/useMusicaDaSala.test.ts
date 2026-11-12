import { renderHook, waitFor } from "@testing-library/react";
import { PERSONAGEM_PADRAO } from "@/modules/rock/character";
import { estadoInicial, type EstadoDaSala } from "./protocolo";
import { useMusicaDaSala } from "./useMusicaDaSala";
import { MUSICAS_DE_TESTE } from "@/test/musicas";

const sala = (souHost: boolean): EstadoDaSala => ({
  ...estadoInicial(PERSONAGEM_PADRAO, souHost),
  musica: { tipo: "embutida", id: MUSICAS_DE_TESTE[1].id },
});

describe("useMusicaDaSala", () => {
  it("o convidado recebe a música da sala quando ela fica pronta", async () => {
    const { result } = renderHook(() => useMusicaDaSala(sala(false), MUSICAS_DE_TESTE, ""));
    expect(result.current.tipo).toBe("baixando");
    await waitFor(() => expect(result.current).toEqual({ tipo: "pronta", musica: MUSICAS_DE_TESTE[1] }));
  });

  it("o host já começa pronto e também recebe a música", async () => {
    const { result } = renderHook(() => useMusicaDaSala(sala(true), MUSICAS_DE_TESTE, ""));
    expect(result.current.tipo).toBe("pronta");
    await waitFor(() => expect(result.current).toEqual({ tipo: "pronta", musica: MUSICAS_DE_TESTE[1] }));
  });
});
