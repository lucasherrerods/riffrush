import { renderHook } from "@testing-library/react";
import type { ConviteParaSala } from "@/modules/presenca";
import { useConvitesDeAmigos } from "./BotaoDeAmigos";

const ouvir = vi.hoisted(() => ({ ouvinte: null as ((c: ConviteParaSala) => void) | null }));
const avisar = vi.hoisted(() => vi.fn());

vi.mock("@/modules/presenca", async (original) => ({
  ...(await original<typeof import("@/modules/presenca")>()),
  presenca: {
    ouvirConvites: (fn: (c: ConviteParaSala) => void) => {
      ouvir.ouvinte = fn;
      return () => (ouvir.ouvinte = null);
    },
  },
}));
vi.mock("@/shared/ui/avisos", () => ({ avisar }));
vi.mock("./loja", () => ({
  listaDeAmigos: { estado: () => ({ listas: { amigos: [{ conta_id: "amiga" }] } }) },
}));

const convite = (id: string): ConviteParaSala => ({ de: { id, nome: "Ana", avatar: null }, codigo: "ABCDE" });

describe("useConvitesDeAmigos", () => {
  it("convite de amigo vira aviso com o botão de entrar na sala", () => {
    const aoEntrar = vi.fn();
    renderHook(() => useConvitesDeAmigos(aoEntrar));
    ouvir.ouvinte!(convite("amiga"));
    expect(avisar).toHaveBeenCalledTimes(1);
    const [, opcoes] = avisar.mock.calls[0] as [string, { action: { onClick: () => void } }];
    opcoes.action.onClick();
    expect(aoEntrar).toHaveBeenCalledWith("ABCDE");
  });

  it("convite de quem não é amigo é ignorado", () => {
    avisar.mockClear();
    renderHook(() => useConvitesDeAmigos(vi.fn()));
    ouvir.ouvinte!(convite("estranho"));
    expect(avisar).not.toHaveBeenCalled();
  });
});
