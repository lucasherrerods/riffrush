import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { salvarRecorde } from "@/modules/results";
import { MUSICAS_EMBUTIDAS, type Dificuldade, type Musica } from "@/modules/songs";
import { AudioContextFalso } from "@/test/audioFalso";
import { TelaDeSelecao } from "./TelaDeSelecao";

function abrir({ indice = 0, dificuldade = "medio" as Dificuldade, musicas = MUSICAS_EMBUTIDAS } = {}) {
  const acoes = { aoSelecionar: vi.fn(), aoDificuldade: vi.fn(), aoJogar: vi.fn(), aoVoltar: vi.fn(), aoImportar: vi.fn() };
  render(
    <TelaDeSelecao
      musicas={musicas}
      indice={indice}
      dificuldade={dificuldade}
      personagem={PERSONAGEM_PADRAO}
      volumeDosEfeitos={0}
      {...acoes}
    />,
  );
  return { ...acoes, usuario: userEvent.setup() };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("AudioContext", AudioContextFalso);
  Element.prototype.scrollIntoView = vi.fn();
});

describe("TelaDeSelecao", () => {
  it("lista as músicas e marca a selecionada", () => {
    abrir({ indice: 2 });
    expect(screen.getAllByRole("listitem")).toHaveLength(MUSICAS_EMBUTIDAS.length);
    expect(screen.getByRole("button", { name: /Cosmic Riff/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("heading", { name: "Cosmic Riff" })).toBeInTheDocument();
  });

  it("as setas para cima e para baixo trocam de música, dando a volta", async () => {
    const { aoSelecionar, usuario } = abrir({ indice: 0 });
    await usuario.keyboard("{ArrowUp}");
    expect(aoSelecionar).toHaveBeenCalledWith(MUSICAS_EMBUTIDAS.length - 1);
    await usuario.keyboard("{ArrowDown}");
    expect(aoSelecionar).toHaveBeenCalledWith(1);
  });

  it("as setas para os lados trocam a dificuldade, sem passar dos limites", async () => {
    const { aoDificuldade, usuario } = abrir({ dificuldade: "expert" });
    await usuario.keyboard("{ArrowRight}");
    expect(aoDificuldade).not.toHaveBeenCalled();
    await usuario.keyboard("{ArrowLeft}");
    expect(aoDificuldade).toHaveBeenCalledWith("dificil");
  });

  it("Enter toca e Esc volta", async () => {
    const { aoJogar, aoVoltar, usuario } = abrir();
    await usuario.keyboard("{Enter}{Escape}");
    expect(aoJogar).toHaveBeenCalled();
    expect(aoVoltar).toHaveBeenCalled();
  });

  it("clicar numa música seleciona; clicar de novo toca", async () => {
    const { aoSelecionar, aoJogar, usuario } = abrir({ indice: 0 });
    await usuario.click(screen.getByRole("button", { name: /Overdrive/ }));
    expect(aoSelecionar).toHaveBeenCalledWith(3);
    await usuario.click(screen.getByRole("button", { name: /Neon Highway/ }));
    expect(aoJogar).toHaveBeenCalled();
  });

  it("mostra o recorde da dificuldade escolhida", () => {
    salvarRecorde({ musicaId: "neon-highway", dificuldade: "medio", pontos: 4321, acertos: 10, total: 10, maiorSequencia: 10, derrota: false });
    abrir({ indice: 0, dificuldade: "medio" });
    expect(screen.getByText(/Recorde/)).toHaveTextContent("4.321");
  });

  it("importa músicas, clipes e .sng", async () => {
    const { aoImportar, usuario } = abrir();
    const arquivo = new File(["x"], "musica.sng");
    const campo = screen.getByLabelText(/Importar/);
    expect(campo).toHaveAttribute("accept", expect.stringContaining(".sng"));
    await usuario.upload(campo, arquivo);
    expect(aoImportar).toHaveBeenCalledWith([arquivo]);
  });

  it("usa a imagem de capa quando a música tem uma", () => {
    const comCapa: Musica = { ...MUSICAS_EMBUTIDAS[0], imagemDeCapa: "blob:capa" };
    abrir({ musicas: [comCapa] });
    expect(screen.getByRole("img", { name: /Capa de Neon Highway/ })).toHaveAttribute("src", "blob:capa");
  });

  it("mostra o personagem palhetando a guitarra ao lado da música", () => {
    abrir();
    expect(screen.getByRole("img", { name: "Personagem Rockstar" })).toHaveAttribute("data-instrumento", "guitarra");
  });
});

describe("TelaDeSelecao na tela estreita", () => {
  // Bug: itens de grid não encolhem sem min-w-0, e a seleção ficava mais larga que o celular.
  it("as colunas podem encolher até caber na tela", () => {
    abrir();
    expect(screen.getAllByRole("list")[0]).toHaveClass("min-w-0");
    expect(screen.getByRole("heading", { name: "Neon Highway" }).closest("section")).toHaveClass("min-w-0");
  });
});
