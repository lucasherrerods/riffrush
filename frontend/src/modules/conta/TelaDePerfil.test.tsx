import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PerfilDaApi } from "./api";
import { TelaDePerfil } from "./TelaDePerfil";

const dificuldade = (d: PerfilDaApi["por_dificuldade"][number]["dificuldade"], partidas = 0) => ({ dificuldade: d, partidas, derrotas: 0, precisao: partidas ? 0.9 : 0, melhor_pontuacao: partidas * 1000 });

const perfil: PerfilDaApi = {
  nome: "Lucas",
  avatar: null,
  email: "lucas@exemplo.com",
  xp_total: 1234,
  nivel: { nivel: 4, xp_no_nivel: 30, xp_para_o_proximo: 200 },
  criada_em: "2026-03-10T12:00:00Z",
  partidas: 12,
  derrotas: 2,
  precisao: 0.8765,
  melhor_pontuacao: 98_500,
  musicas_distintas: 5,
  por_dificuldade: [dificuldade("facil"), dificuldade("medio", 4), dificuldade("dificil"), dificuldade("expert", 8)],
  por_instrumento: [
    { instrumento: "guitarra", partidas: 9 },
    { instrumento: "baixo", partidas: 3 },
  ],
  mais_tocadas: [{ musica_id: "encore:abc", partidas: 7 }],
  recentes: [{ musica_id: "encore:abc", dificuldade: "expert", pontos: 98_500, acertos: 9, total: 10, derrota: true, jogada_em: "2026-10-20T12:00:00Z" }],
};

const tituloDaMusica = (id: string) => (id === "encore:abc" ? "Shine — Spektrem" : undefined);

describe("TelaDePerfil", () => {
  it("mostra o nível, as estatísticas e as últimas partidas", async () => {
    render(<TelaDePerfil aoVoltar={() => {}} tituloDaMusica={tituloDaMusica} carregar={async () => perfil} />);

    expect(await screen.findByRole("heading", { name: "Lucas" })).toBeInTheDocument();
    expect(screen.getByText("Nv 4")).toBeInTheDocument();
    expect(screen.getByText("87,65%")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getAllByText("98.500").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Shine — Spektrem").length).toBe(2);
    expect(screen.getByText(/lucas@exemplo\.com/)).toBeInTheDocument();
    expect(screen.getByText("83% concluídas")).toBeInTheDocument();
    expect(screen.getByText("Baixo")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("7 vezes")).toBeInTheDocument();
    expect(screen.getByText("Vaiada")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "XP do nível 4" })).toBeInTheDocument();
  });

  it("música que não está na biblioteca aparece pelo id", async () => {
    render(<TelaDePerfil aoVoltar={() => {}} tituloDaMusica={() => undefined} carregar={async () => perfil} />);
    expect((await screen.findAllByText("encore:abc")).length).toBe(2);
  });

  it("sem partidas, convida a jogar", async () => {
    const vazio = { ...perfil, partidas: 0, recentes: [], por_instrumento: [], mais_tocadas: [], por_dificuldade: perfil.por_dificuldade.map((d) => dificuldade(d.dificuldade)) };
    render(<TelaDePerfil aoVoltar={() => {}} tituloDaMusica={tituloDaMusica} carregar={async () => vazio} />);
    expect(await screen.findByText(/Nenhuma partida ainda/)).toBeInTheDocument();
  });

  it("se a API falha, mostra o erro e deixa tentar de novo", async () => {
    const carregar = vi.fn().mockRejectedValueOnce(new Error("fora do ar")).mockResolvedValueOnce(perfil);
    render(<TelaDePerfil aoVoltar={() => {}} tituloDaMusica={tituloDaMusica} carregar={carregar} />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("heading", { name: "Lucas" })).toBeInTheDocument();
  });

  it("voltar chama aoVoltar", async () => {
    const aoVoltar = vi.fn();
    render(<TelaDePerfil aoVoltar={aoVoltar} tituloDaMusica={tituloDaMusica} carregar={async () => perfil} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Voltar" }));
    expect(aoVoltar).toHaveBeenCalled();
  });
});
