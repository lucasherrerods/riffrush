import { fireEvent, render, screen, within } from "@testing-library/react";
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

describe("TelaDeSelecao com carrossel", () => {
  it("abre as dificuldades embaixo da música selecionada, e só nela", () => {
    abrir({ indice: 2, dificuldade: "dificil" });
    const [selecionada] = screen.getAllByRole("listitem").filter((li) => within(li).queryByRole("radiogroup"));
    expect(within(selecionada).getByRole("button", { name: /Cosmic Riff/ })).toBeInTheDocument();
    expect(within(selecionada).getAllByRole("radio")).toHaveLength(4);
    expect(within(selecionada).getByRole("radio", { name: /Difícil/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
  });

  it("clicar numa dificuldade escolhe; clicar de novo na escolhida toca", async () => {
    const { aoDificuldade, aoJogar, usuario } = abrir({ dificuldade: "medio" });
    await usuario.click(screen.getByRole("radio", { name: /Expert/ }));
    expect(aoDificuldade).toHaveBeenCalledWith("expert");
    expect(aoJogar).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole("radio", { name: /Médio/ }));
    expect(aoJogar).toHaveBeenCalled();
  });

  it("a roda do mouse anda pelas músicas, dando a volta", () => {
    const { aoSelecionar } = abrir({ indice: 0 });
    const carrossel = screen.getByRole("list", { name: "Músicas" });
    fireEvent.wheel(carrossel, { deltaY: 120 });
    expect(aoSelecionar).toHaveBeenLastCalledWith(1);
    fireEvent.wheel(carrossel, { deltaY: -120 });
    expect(aoSelecionar).toHaveBeenLastCalledWith(MUSICAS_EMBUTIDAS.length - 1);
  });

  it("um toque leve na roda não troca de música", () => {
    const { aoSelecionar } = abrir({ indice: 0 });
    fireEvent.wheel(screen.getByRole("list", { name: "Músicas" }), { deltaY: 30 });
    expect(aoSelecionar).not.toHaveBeenCalled();
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

describe("TelaDeSelecao com estética arcade", () => {
  it("tem um header com o título da tela", () => {
    abrir();
    expect(within(screen.getByRole("banner")).getByRole("heading", { name: "Selecione a música" })).toBeInTheDocument();
  });

  it("o painel mostra BPM, gênero e intensidade em cards", () => {
    abrir({ indice: 0 });
    const painel = screen.getByRole("region", { name: "Informações da música" });
    expect(within(painel).getByText("BPM").nextSibling).toHaveTextContent(String(MUSICAS_EMBUTIDAS[0].bpm));
    expect(within(painel).getByText("Gênero").nextSibling).toHaveTextContent(MUSICAS_EMBUTIDAS[0].genero);
    expect(within(painel).getByLabelText(/Intensidade/)).toBeInTheDocument();
  });

  it("a lista de músicas fica à direita, depois do painel", () => {
    abrir();
    const painel = screen.getByRole("region", { name: "Informações da música" });
    const lista = screen.getByRole("list", { name: "Músicas" });
    expect(painel.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("o rodapé mostra os comandos do teclado", () => {
    abrir();
    const legenda = screen.getByRole("contentinfo");
    for (const comando of ["Dificuldade", "Confirmar", "Voltar"]) expect(legenda).toHaveTextContent(comando);
  });
});
