import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BotaoDasPlaylists } from "./BotaoDasPlaylists";
import { BotaoDePlaylist } from "./BotaoDePlaylist";
import { anotar, iniciarMaratona, pularFaixa } from "./maratona";
import { ResultadoDaMaratona } from "./ResultadoDaMaratona";
import { esquecerPlaylists, usePlaylists } from "./usePlaylists";

vi.mock("@/modules/conta", () => ({ sessaoDaConta: { token: () => null } }));

const faixa = { musica: "m1", versao: "expert", titulo: "Shine" };

function Selecao({ aoTocar = () => {} }: { aoTocar?: (p: { nome: string }) => void }) {
  const playlists = usePlaylists("rock");
  return (
    <>
      <BotaoDePlaylist faixa={faixa} playlists={playlists} />
      <BotaoDasPlaylists playlists={playlists} aoTocar={aoTocar} />
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  esquecerPlaylists();
});

it("cria uma playlist com a música, tira e põe de novo", async () => {
  const usuario = userEvent.setup();
  render(<Selecao />);

  await usuario.click(screen.getByRole("button", { name: "Adicionar à playlist" }));
  await usuario.type(screen.getByRole("textbox", { name: "Nome da nova playlist" }), "Treino");
  await usuario.click(screen.getByRole("button", { name: "Criar playlist com esta música" }));

  const marcada = screen.getByRole("checkbox", { name: /Treino/ });
  expect(marcada).toHaveAttribute("aria-checked", "true");
  await usuario.click(marcada);
  expect(screen.getByRole("checkbox", { name: /Treino/ })).toHaveAttribute("aria-checked", "false");
  expect(JSON.parse(localStorage.getItem("riffrush:playlists")!)[0]).toMatchObject({ nome: "Treino", faixas: [] });
});

it("toca a playlist em maratona e apaga", async () => {
  const usuario = userEvent.setup();
  const aoTocar = vi.fn();
  render(<Selecao aoTocar={aoTocar} />);
  await usuario.click(screen.getByRole("button", { name: "Adicionar à playlist" }));
  await usuario.type(screen.getByRole("textbox", { name: "Nome da nova playlist" }), "Treino{Enter}");
  await usuario.keyboard("{Escape}");

  await usuario.click(screen.getByRole("button", { name: "Playlists" }));
  const lista = screen.getByRole("list", { name: "Suas playlists" });
  expect(within(lista).getByText("1 música")).toBeInTheDocument();
  await usuario.click(within(lista).getByRole("button", { name: "Tocar Treino em maratona" }));
  expect(aoTocar).toHaveBeenCalledWith(expect.objectContaining({ nome: "Treino", faixas: [faixa] }));

  await usuario.click(screen.getByRole("button", { name: "Playlists" }));
  await usuario.click(screen.getByRole("button", { name: "Apagar Treino" }));
  expect(screen.getByText(/Nenhuma ainda/)).toBeInTheDocument();
});

it("o resultado mostra o total e cada música, com as puladas", async () => {
  const faixas = [faixa, { musica: "m2", versao: "expert", titulo: "Goofy" }];
  const maratona = pularFaixa(anotar(iniciarMaratona("Treino", faixas), { pontos: 12_000, precisao: 0.9, derrota: false }));
  const aoContinuar = vi.fn();
  render(<ResultadoDaMaratona maratona={maratona} aoContinuar={aoContinuar} />);

  expect(screen.getByRole("heading", { name: "Maratona: Treino" })).toBeInTheDocument();
  expect(screen.getByText("1/2")).toBeInTheDocument();
  const musicas = within(screen.getByRole("list", { name: "Músicas da maratona" })).getAllByRole("listitem");
  expect(musicas[0]).toHaveTextContent("Shine");
  expect(musicas[1]).toHaveTextContent("Pulada");
  await userEvent.click(screen.getByRole("button", { name: "Voltar para a seleção" }));
  expect(aoContinuar).toHaveBeenCalled();
});
