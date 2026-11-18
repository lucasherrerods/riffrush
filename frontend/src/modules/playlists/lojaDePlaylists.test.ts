import type { PlaylistDaApi } from "./api";
import { CHAVE_DAS_PLAYLISTS, LojaDePlaylists } from "./lojaDePlaylists";
import { MAXIMO_DE_PLAYLISTS, salvarPlaylists } from "./playlists";

const faixa = { musica: "m1", versao: "expert", titulo: "Shine" };
const daApi = (id: string, modo: "rock" | "mania" = "rock"): PlaylistDaApi => ({ id, nome: id, modo, publica: true, faixas: [], atualizada_em: "2026-11-17T00:00:00Z" });

function montar({ token = "tok" as string | null, minhas = [] as PlaylistDaApi[] } = {}) {
  const api = {
    minhas: vi.fn(async () => minhas),
    guardar: vi.fn(async () => daApi("x")),
    apagar: vi.fn(async () => {}),
  };
  const avisarErro = vi.fn();
  let n = 0;
  const loja = new LojaDePlaylists("rock", { api, token: () => token, avisarErro, novoId: () => `novo${++n}` });
  return { loja, api, avisarErro };
}

beforeEach(() => localStorage.clear());

it("sem conta, fica só no aparelho", async () => {
  const { loja, api } = montar({ token: null });
  loja.criar("Treino");
  await loja.sincronizar();
  expect(api.guardar).not.toHaveBeenCalled();
  expect(api.minhas).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(CHAVE_DAS_PLAYLISTS.rock)!)[0].nome).toBe("Treino");
});

it("com conta, traz as do modo e sobe uma vez as que só existiam no aparelho", async () => {
  salvarPlaylists(CHAVE_DAS_PLAYLISTS.rock, [{ id: "local", nome: "Local", publica: true, faixas: [faixa] }]);
  const { loja, api } = montar({ minhas: [daApi("conta"), daApi("outra", "mania")] });
  await loja.sincronizar();
  expect(loja.estado().map((p) => p.id)).toEqual(["conta", "local"]);
  expect(api.guardar).toHaveBeenCalledWith("tok", "local", { nome: "Local", modo: "rock", publica: true, faixas: [faixa] });

  // Num aparelho que já subiu, a conta manda: a que sumiu de lá não volta.
  const outra = montar({ minhas: [] });
  await outra.loja.sincronizar();
  expect(outra.loja.estado()).toEqual([]);
  expect(outra.api.guardar).not.toHaveBeenCalled();
});

it("cada mudança vai para a conta", async () => {
  const { loja, api } = montar();
  const id = loja.criar("Treino")!;
  loja.alternar(id, faixa);
  loja.alternarPublica(id);
  loja.apagar(id);
  await Promise.resolve();
  expect(api.guardar).toHaveBeenLastCalledWith("tok", id, { nome: "Treino", modo: "rock", publica: false, faixas: [faixa] });
  expect(api.apagar).toHaveBeenCalledWith("tok", id);
});

it("se a API recusa, avisa e volta para o que está na conta", async () => {
  const { loja, api, avisarErro } = montar({ minhas: [] });
  api.guardar.mockRejectedValueOnce(new Error("a conta pode ter até 10 playlists"));
  loja.criar("Treino");
  await vi.waitFor(() => expect(avisarErro).toHaveBeenCalledWith("a conta pode ter até 10 playlists"));
  await vi.waitFor(() => expect(loja.estado()).toEqual([]));
});

it("não passa de dez playlists e copia a de um amigo com id novo", () => {
  const { loja, avisarErro } = montar({ token: null });
  expect(loja.copiar({ nome: "Do amigo", faixas: [faixa] })).toBe(true);
  expect(loja.estado()[0]).toMatchObject({ id: "novo1", nome: "Do amigo", faixas: [faixa] });
  for (let i = 1; i < MAXIMO_DE_PLAYLISTS; i++) loja.criar(`P${i}`);
  expect(loja.criar("Uma a mais")).toBeNull();
  expect(avisarErro).toHaveBeenCalled();
  expect(loja.estado()).toHaveLength(MAXIMO_DE_PLAYLISTS);
});
