import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiDasPlaylists, type PlaylistDaApi } from "./api";
import { PlaylistsDoPerfil } from "./PlaylistsDoPerfil";
import { esquecerPlaylists, lojaDoModo } from "./usePlaylists";

const falsos = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("@/modules/conta", () => ({ sessaoDaConta: { token: () => falsos.token } }));

const faixa = (titulo: string) => ({ musica: titulo, versao: "hash", titulo });
const doAmigo: PlaylistDaApi = { id: "a1", nome: "Pra treinar", modo: "mania", publica: true, faixas: [faixa("Um"), faixa("Dois")], atualizada_em: "2026-11-17T00:00:00Z" };

beforeEach(() => {
  localStorage.clear();
  esquecerPlaylists();
  falsos.token = null;
});

it("mostra as minhas dos dois modos, com as privadas marcadas", () => {
  lojaDoModo("rock").criar("Rock pesado", [faixa("Shine")]);
  const id = lojaDoModo("mania").criar("Só minha")!;
  lojaDoModo("mania").alternarPublica(id);
  render(<PlaylistsDoPerfil />);

  const secao = screen.getByRole("region", { name: "Playlists" });
  expect(within(secao).getByRole("listitem", { name: "Rock pesado" })).toHaveTextContent("1 música · Shine");
  expect(within(within(secao).getByRole("listitem", { name: "Só minha" })).getByLabelText("Só você vê")).toBeInTheDocument();
});

it("mostra as do amigo e salva uma cópia entre as minhas", async () => {
  falsos.token = "tok";
  vi.spyOn(apiDasPlaylists, "doAmigo").mockResolvedValue([doAmigo]);
  vi.spyOn(apiDasPlaylists, "minhas").mockResolvedValue([]);
  const guardar = vi.spyOn(apiDasPlaylists, "guardar").mockResolvedValue(doAmigo);
  render(<PlaylistsDoPerfil contaId="amigo" />);

  const item = await screen.findByRole("listitem", { name: "Pra treinar" });
  expect(apiDasPlaylists.doAmigo).toHaveBeenCalledWith("tok", "amigo", expect.any(AbortSignal));
  await userEvent.click(within(item).getByRole("button", { name: "Salvar" }));

  expect(lojaDoModo("mania").estado()).toEqual([expect.objectContaining({ nome: "Pra treinar", faixas: doAmigo.faixas })]);
  expect(lojaDoModo("mania").estado()[0].id).not.toBe("a1");
  expect(guardar).toHaveBeenCalled();
});
