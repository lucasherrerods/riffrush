import type { ApiDosAmigos, ListasDeAmigos } from "./api";
import { ListaDeAmigos } from "./lista";

const vazias: ListasDeAmigos = { codigo: "RIFF-ABCDEF", amigos: [], recebidos: [], enviados: [], bloqueados: [] };

function montar(token: string | null = "t") {
  const api = {
    listas: vi.fn(async () => vazias),
    sugestoes: vi.fn(async () => []),
    pedir: vi.fn(async () => ({ amigos: false })),
  } as unknown as ApiDosAmigos;
  return { api, lista: new ListaDeAmigos(api, () => token) };
}

describe("ListaDeAmigos", () => {
  it("carrega as listas e avisa quem está ouvindo", async () => {
    const { lista } = montar();
    const ouvinte = vi.fn();
    lista.inscrever(ouvinte);
    await lista.recarregar();
    expect(lista.estado().listas?.codigo).toBe("RIFF-ABCDEF");
    expect(ouvinte).toHaveBeenCalled();
  });

  it("depois de uma ação, busca as listas de novo", async () => {
    const { api, lista } = montar();
    await lista.agir((api, token) => api.pedir(token, { codigo: "RIFF-ABCDEF" }));
    expect(api.pedir).toHaveBeenCalledWith("t", { codigo: "RIFF-ABCDEF" });
    expect(api.listas).toHaveBeenCalledTimes(1);
  });

  it("falha de rede mantém o que já estava", async () => {
    const { api, lista } = montar();
    await lista.recarregar();
    vi.mocked(api.listas).mockRejectedValueOnce(new Error("fora"));
    await lista.recarregar();
    expect(lista.estado().listas).toEqual(vazias);
  });

  it("sem sessão, fica vazia e as ações pedem para entrar", async () => {
    const { lista } = montar(null);
    await lista.recarregar();
    expect(lista.estado().listas).toBeNull();
    await expect(lista.agir(async () => 1)).rejects.toThrow("Entre");
  });
});
