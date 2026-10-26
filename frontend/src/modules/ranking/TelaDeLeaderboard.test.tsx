import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MusicaNoRanking, PosicaoNoGeral, RespostaDoGeral } from "./api";
import { TelaDeLeaderboard } from "./TelaDeLeaderboard";

const posicao = (n: number, nome: string, xp: number): PosicaoNoGeral => ({
  posicao: n,
  nome,
  avatar: null,
  xp_total: xp,
  nivel: { nivel: 10 - n, xp_no_nivel: 0, xp_para_o_proximo: 100 },
});

const ranking: RespostaDoGeral = { jogadores: 120, top: [posicao(1, "Ana", 9000), posicao(2, "Bia", 5000)], meu: posicao(87, "Lucas", 40) };

const musicas: MusicaNoRanking[] = [
  { posicao: 1, musica_id: "encore:abc", partidas: 30, jogadores: 4 },
  { posicao: 2, musica_id: "encore:xyz", partidas: 1, jogadores: 1 },
  {
    posicao: 3,
    musica_id: "encore:goofy",
    partidas: 1,
    jogadores: 1,
    titulo: "Goofy Goober Rock",
    artista: "Tom Rothrock",
    capa: "https://files.enchor.us/capa.jpg",
    recorde: { nome: "Bia", pontos: 980_000, precisao: 0.985, dificuldade: "dificil" },
  },
  { posicao: 4, musica_id: "embutida:shine", partidas: 1, jogadores: 1, titulo: "Embutida", artista: "Riff Rush" },
];

const tituloDaMusica = (id: string) => (id === "encore:abc" ? "Shine — Spektrem" : undefined);

function abrir(props: Partial<React.ComponentProps<typeof TelaDeLeaderboard>> = {}) {
  const carregarMusicas = vi.fn(async () => musicas);
  render(<TelaDeLeaderboard aoVoltar={() => {}} tituloDaMusica={tituloDaMusica} carregarPlayers={async () => ranking} carregarMusicas={carregarMusicas} {...props} />);
  return { carregarMusicas, usuario: userEvent.setup() };
}

describe("TelaDeLeaderboard: cada música", () => {
  const rankingDaMusica = { jogadores: 1, top: [{ posicao: 1, nome: "Ana", avatar: null, pontos: 1000, acertos: 9, total: 10, precisao: 0.9, maior_sequencia: 9, jogada_em: new Date().toISOString(), partida_id: "p1" }], meu: null };

  async function abrirMusica(nome: RegExp, props: Partial<React.ComponentProps<typeof TelaDeLeaderboard>> = {}) {
    const api = { buscar: vi.fn(async () => rankingDaMusica) };
    const tela = abrir({ apiDoRanking: api, ...props });
    await tela.usuario.click(screen.getByRole("tab", { name: "Músicas" }));
    await tela.usuario.click(await screen.findByRole("button", { name: nome }));
    return { ...tela, api };
  }

  it("clicar numa música abre o ranking dela, na dificuldade do recorde e pelos pontos", async () => {
    const { api } = await abrirMusica(/Ver o ranking de Goofy Goober Rock/);
    expect(await screen.findByRole("list", { name: "Ranking" })).toHaveTextContent("Ana");
    expect(api.buscar).toHaveBeenLastCalledWith("encore:goofy", "dificil", expect.objectContaining({ instrumento: "guitarra", ordem: "pontos" }));
  });

  it("troca a dificuldade, o instrumento e a ordem do ranking da música", async () => {
    const { api, usuario } = await abrirMusica(/Ver o ranking de Shine/);
    await screen.findByRole("list", { name: "Ranking" });
    await usuario.selectOptions(screen.getByLabelText("Dificuldade"), "medio");
    await usuario.selectOptions(screen.getByLabelText("Instrumento"), "baixo");
    await usuario.click(screen.getByRole("radio", { name: "Precisão" }));
    await vi.waitFor(() => expect(api.buscar).toHaveBeenLastCalledWith("encore:abc", "medio", expect.objectContaining({ instrumento: "baixo", ordem: "precisao" })));
  });

  it("abrir uma partida do ranking da música leva o nome da música", async () => {
    const aoAbrirPartida = vi.fn();
    const { usuario } = await abrirMusica(/Ver o ranking de Goofy Goober Rock/, { aoAbrirPartida });
    await usuario.click(await screen.findByRole("button", { name: "Ver a partida de Ana" }));
    expect(aoAbrirPartida).toHaveBeenCalledWith("p1", { titulo: "Goofy Goober Rock", artista: "Tom Rothrock" });
  });

  it("só música do Encore tem botão de baixar, e só música da biblioteca tem prévia", async () => {
    const aoAbrirMusicaDoEncore = vi.fn();
    const ouvir = vi.fn();
    const previa = (id: string) => (id === "encore:abc" ? ouvir : undefined);
    const { usuario } = await abrirMusica(/Ver o ranking de Shine/, { aoAbrirMusicaDoEncore, previa });
    await usuario.click(screen.getByRole("button", { name: "Ouvir prévia" }));
    expect(ouvir).toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: "Baixar" }));
    expect(aoAbrirMusicaDoEncore).toHaveBeenCalledWith("abc");

    await usuario.click(screen.getByRole("button", { name: "Voltar às músicas" }));
    await usuario.click(await screen.findByRole("button", { name: /Ver o ranking de Embutida/ }));
    expect(screen.queryByRole("button", { name: "Baixar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ouvir prévia" })).not.toBeInTheDocument();
  });

  it("a lista tem prévia direto na linha das músicas que estão na biblioteca", async () => {
    const ouvir = vi.fn();
    const { usuario } = abrir({ previa: (id) => (id === "encore:abc" ? ouvir : undefined) });
    await usuario.click(screen.getByRole("tab", { name: "Músicas" }));
    await usuario.click(await screen.findByRole("button", { name: "Ouvir prévia de Shine — Spektrem" }));
    expect(ouvir).toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /Ouvir prévia de/ })).toHaveLength(1);
  });
});

describe("TelaDeLeaderboard: filtros das músicas", () => {
  it("busca pelo nome e ordena pela escolha", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: "Músicas" }));
    const lista = await screen.findByRole("list", { name: "Músicas" });

    await usuario.type(screen.getByRole("searchbox", { name: "Buscar música" }), "goofy");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(1);
    await usuario.clear(screen.getByRole("searchbox", { name: "Buscar música" }));

    await usuario.selectOptions(screen.getByLabelText("Ordenar por"), "nome");
    expect(within(lista).getAllByRole("listitem")[0]).toHaveTextContent("Embutida");

    await usuario.type(screen.getByRole("searchbox", { name: "Buscar música" }), "zzz");
    expect(screen.getByText("Nenhuma música com esse nome.")).toBeInTheDocument();
  });

  it("cada linha mostra o recorde da música", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: "Músicas" }));
    const lista = await screen.findByRole("list", { name: "Músicas" });
    expect(within(lista).getAllByRole("listitem")[2]).toHaveTextContent("Bia 98,50% no Difícil");
  });
});

describe("TelaDeLeaderboard", () => {
  it("abre na aba Players, com o top por XP e a própria posição fora do top embaixo", async () => {
    const { carregarMusicas } = abrir();

    expect(screen.getByRole("tab", { name: "Players" })).toHaveAttribute("aria-selected", "true");
    const top = await screen.findByRole("list", { name: "Players" });
    expect(within(top).getAllByRole("listitem").map((l) => l.textContent)).toEqual([expect.stringContaining("Ana"), expect.stringContaining("Bia")]);
    expect(within(top).getByText("9.000 XP")).toBeInTheDocument();
    expect(within(top).getByText("Nv 9")).toBeInTheDocument();
    expect(screen.getByText("Sua posição (#87 de 120)")).toBeInTheDocument();
    expect(screen.getByText("Jogadores com mais XP")).toBeInTheDocument();
    // A aba de músicas só pede à API quando é aberta.
    expect(carregarMusicas).not.toHaveBeenCalled();
  });

  it("quem já está no top não aparece de novo embaixo", async () => {
    abrir({ carregarPlayers: async () => ({ ...ranking, meu: ranking.top[1] }) });
    await screen.findByRole("list", { name: "Players" });
    expect(screen.queryByRole("region", { name: "Sua posição" })).not.toBeInTheDocument();
  });

  it("a aba Músicas mostra as mais jogadas com partidas e jogadores", async () => {
    const { usuario } = abrir();
    await usuario.click(screen.getByRole("tab", { name: "Músicas" }));

    const lista = await screen.findByRole("list", { name: "Músicas" });
    const [primeira, segunda, terceira] = within(lista).getAllByRole("listitem");
    expect(primeira).toHaveTextContent("Shine — Spektrem");
    expect(primeira).toHaveTextContent("4 jogadores");
    expect(primeira).toHaveTextContent("30 partidas");
    // Música que não está na biblioteca aparece pelo id, no singular quando é uma só.
    expect(segunda).toHaveTextContent("encore:xyz");
    expect(segunda).toHaveTextContent("1 jogador");
    expect(segunda).toHaveTextContent("1 partida");
    // Fora da biblioteca, mas a API achou nome, banda e capa.
    expect(terceira).toHaveTextContent("Goofy Goober Rock — Tom Rothrock");
    expect(terceira.querySelector("img")).toHaveAttribute("src", "https://files.enchor.us/capa.jpg");
  });

  it("sem dados, cada aba explica o que falta", async () => {
    const { usuario } = abrir({ carregarPlayers: async () => ({ jogadores: 0, top: [], meu: null }), carregarMusicas: async () => [] });
    expect(await screen.findByText(/Ninguém ganhou XP ainda/)).toBeInTheDocument();
    await usuario.click(screen.getByRole("tab", { name: "Músicas" }));
    expect(await screen.findByText("Nenhuma música foi jogada ainda.")).toBeInTheDocument();
  });

  it("se a API falha, deixa tentar de novo", async () => {
    const carregarPlayers = vi.fn().mockRejectedValueOnce(new Error("fora do ar")).mockResolvedValueOnce(ranking);
    const { usuario } = abrir({ carregarPlayers });
    await usuario.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("list", { name: "Players" })).toBeInTheDocument();
  });

  it("voltar chama aoVoltar", async () => {
    const aoVoltar = vi.fn();
    const { usuario } = abrir({ aoVoltar });
    await usuario.click(screen.getByRole("button", { name: "Voltar" }));
    expect(aoVoltar).toHaveBeenCalled();
  });
});

describe("TelaDeLeaderboard: música lembrada por quem usa a tela", () => {
  it("com uma música aberta, abre direto no ranking dela; voltar avisa quem guarda", async () => {
    const aoAbrirMusica = vi.fn();
    const { usuario } = abrir({ musicaAberta: musicas[2], aoAbrirMusica, apiDoRanking: { buscar: vi.fn(async () => ({ jogadores: 0, top: [], meu: null })) } });
    expect(screen.getByRole("heading", { name: "Goofy Goober Rock — Tom Rothrock" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Voltar às músicas" }));
    expect(aoAbrirMusica).toHaveBeenCalledWith(null);
  });
});
