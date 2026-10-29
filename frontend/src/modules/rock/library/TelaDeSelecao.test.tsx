import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERSONAGEM_PADRAO } from "@/modules/rock/character";
import { registrarUso } from "@/modules/gamepad";
import { anotarRecorde } from "@/modules/rock/results";
import { type Dificuldade, type Instrumento, type Musica } from "@/modules/rock/songs";
import { AudioContextFalso } from "@/test/audioFalso";
import { TelaDeSelecao } from "./TelaDeSelecao";
import { MUSICAS_DE_TESTE } from "@/test/musicas";

function abrir({ indice = 0, dificuldade = "medio" as Dificuldade, instrumento = "guitarra" as Instrumento, musicas = MUSICAS_DE_TESTE } = {}) {
  const acoes = { aoSelecionar: vi.fn(), aoDificuldade: vi.fn(), aoInstrumento: vi.fn(), aoJogar: vi.fn(), aoVoltar: vi.fn(), aoImportar: vi.fn(), aoBuscarMusicas: vi.fn(), aoRemover: vi.fn(), aoVelocidadeDaMusica: vi.fn() };
  render(
    <TelaDeSelecao
      musicas={musicas}
      indice={indice}
      dificuldade={dificuldade}
      instrumento={instrumento}
      personagem={PERSONAGEM_PADRAO}
      volumeDosEfeitos={0}
      velocidadeDaMusica={1}
      {...acoes}
    />,
  );
  return { ...acoes, usuario: userEvent.setup() };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("AudioContext", AudioContextFalso);
});

describe("TelaDeSelecao", () => {
  it("o botão Buscar músicas, ao lado do de importar, abre a busca", async () => {
    const { aoBuscarMusicas, usuario } = abrir();
    expect(screen.getByLabelText("Importar música")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Buscar músicas" }));
    expect(aoBuscarMusicas).toHaveBeenCalled();
  });

  it("lista as músicas e marca a selecionada", () => {
    abrir({ indice: 2 });
    expect(screen.getAllByRole("listitem")).toHaveLength(MUSICAS_DE_TESTE.length);
    expect(screen.getByRole("button", { name: /Cosmic Riff/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("heading", { name: "Cosmic Riff" })).toBeInTheDocument();
  });

  it("as setas para cima e para baixo trocam de música, dando a volta", async () => {
    const { aoSelecionar, usuario } = abrir({ indice: 0 });
    await usuario.keyboard("{ArrowUp}");
    expect(aoSelecionar).toHaveBeenCalledWith(MUSICAS_DE_TESTE.length - 1);
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

  it("o chart importado mostra só as dificuldades que tem, e as setas andam só por elas", async () => {
    const soDuas = [{ ...MUSICAS_DE_TESTE[0], dificuldades: ["facil", "expert"] as Dificuldade[] }];
    const { aoDificuldade, usuario } = abrir({ musicas: soDuas, dificuldade: "facil" });
    const grupo = screen.getByRole("radiogroup", { name: "Dificuldade" });
    expect(within(grupo).getAllByRole("radio").map((r) => r.textContent)).toEqual([expect.stringMatching(/Fácil/), expect.stringMatching(/Expert/)]);
    await usuario.keyboard("{ArrowRight}");
    expect(aoDificuldade).toHaveBeenCalledWith("expert");
  });

  it("música só com guitarra não mostra a escolha de instrumento", () => {
    abrir();
    expect(screen.queryByRole("radiogroup", { name: "Instrumento" })).not.toBeInTheDocument();
  });

  describe("com mais de um instrumento", () => {
    const banda = [{ ...MUSICAS_DE_TESTE[0], trilhas: { guitarra: ["expert" as const], baixo: ["facil" as const, "medio" as const] } }];

    it("mostra os instrumentos do chart e as dificuldades do escolhido", () => {
      abrir({ musicas: banda, instrumento: "baixo", dificuldade: "medio" });
      const instrumentos = screen.getByRole("radiogroup", { name: "Instrumento" });
      expect(within(instrumentos).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Guitarra", "Baixo"]);
      expect(within(instrumentos).getByRole("radio", { name: "Baixo" })).toHaveAttribute("aria-checked", "true");
      const dificuldades = screen.getByRole("radiogroup", { name: "Dificuldade" });
      expect(within(dificuldades).getAllByRole("radio").map((r) => r.textContent)).toEqual([expect.stringMatching(/Fácil/), expect.stringMatching(/Médio/)]);
    });

    it("clicar num instrumento o escolhe", async () => {
      const { aoInstrumento, usuario } = abrir({ musicas: banda });
      await usuario.click(screen.getByRole("radio", { name: "Baixo" }));
      expect(aoInstrumento).toHaveBeenCalledWith("baixo");
    });

    it("Tab passa para o próximo instrumento, dando a volta", async () => {
      const { aoInstrumento, usuario } = abrir({ musicas: banda, instrumento: "baixo" });
      await usuario.keyboard("{Tab}");
      expect(aoInstrumento).toHaveBeenCalledWith("guitarra");
    });
  });

  it("com ranking, abre na aba Ranking e a aba Detalhes mostra a dificuldade e o recorde local", async () => {
    const acoes = { aoSelecionar: vi.fn(), aoDificuldade: vi.fn(), aoInstrumento: vi.fn(), aoJogar: vi.fn(), aoVoltar: vi.fn(), aoImportar: vi.fn(), aoRemover: vi.fn(), aoVelocidadeDaMusica: vi.fn() };
    render(<TelaDeSelecao musicas={MUSICAS_DE_TESTE} indice={0} dificuldade="medio" instrumento="guitarra" personagem={PERSONAGEM_PADRAO} volumeDosEfeitos={0} velocidadeDaMusica={1} ranking={<p>top da música</p>} {...acoes} />);
    expect(screen.getByRole("tab", { name: /Ranking/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("top da música")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("tab", { name: /Detalhes/ }));
    expect(within(screen.getByRole("region", { name: "Informações da música" })).getByText("Médio")).toBeInTheDocument();
  });

  it("sem ranking (contas desligadas), não tem abas", () => {
    abrir();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Informações da música" })).getByText("Médio")).toBeInTheDocument();
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
    anotarRecorde({ musicaId: "neon-highway", dificuldade: "medio", pontos: 4321, acertos: 10, total: 10, maiorSequencia: 10, derrota: false });
    abrir({ indice: 0, dificuldade: "medio" });
    expect(screen.getByText(/Recorde/)).toHaveTextContent("4.321");
  });

  it("mostra a nota do recorde ao lado da pontuação de cada dificuldade", () => {
    anotarRecorde({ musicaId: "neon-highway", dificuldade: "medio", pontos: 9999, acertos: 10, total: 10, maiorSequencia: 10, derrota: false, precisao: 0.92 });
    abrir({ indice: 0, dificuldade: "medio" });
    const medio = screen.getByRole("radio", { name: /Médio/ });
    expect(within(medio).getByLabelText("Nota A")).toBeInTheDocument();
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
    const comCapa: Musica = { ...MUSICAS_DE_TESTE[0], imagemDeCapa: "blob:capa" };
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
    expect(aoSelecionar).toHaveBeenLastCalledWith(MUSICAS_DE_TESTE.length - 1);
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
    expect(within(painel).getByText("BPM").nextSibling).toHaveTextContent(String(MUSICAS_DE_TESTE[0].bpm));
    expect(within(painel).getByText("Gênero").nextSibling).toHaveTextContent(MUSICAS_DE_TESTE[0].genero);
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
    expect(legenda).not.toHaveTextContent("Instrumento");
    expect(legenda).toHaveTextContent("Enter");
  });

  it("depois de usar o controle, o rodapé mostra os botões dele", () => {
    abrir();
    act(() => registrarUso("controle"));
    const legenda = screen.getByRole("contentinfo");
    expect(within(legenda).getByText("A").nextSibling).toHaveTextContent("Confirmar");
    expect(within(legenda).getByText("B").nextSibling).toHaveTextContent("Voltar");
    expect(legenda).not.toHaveTextContent("Enter");
    act(() => registrarUso("teclado"));
  });
});

describe("TelaDeSelecao com música do histórico sem áudio", () => {
  const semArquivo: Musica = { ...MUSICAS_DE_TESTE[0], id: "arquivo:Riff.mp3:10", titulo: "Riff" };

  it("troca o TOCAR por importar de novo", () => {
    abrir({ musicas: [semArquivo] });
    expect(screen.queryByRole("button", { name: /TOCAR/ })).not.toBeInTheDocument();
    expect(screen.getByText(/áudio não está mais salvo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Importar de novo/)).toHaveAttribute("type", "file");
  });

  it("Enter não começa a partida sem o áudio", async () => {
    const { aoJogar, usuario } = abrir({ musicas: [semArquivo] });
    await usuario.keyboard("{Enter}");
    expect(aoJogar).not.toHaveBeenCalled();
  });

  it("o arquivo escolhido volta pela importação", async () => {
    const { aoImportar, usuario } = abrir({ musicas: [semArquivo] });
    const arquivo = new File(["x"], "Riff.mp3", { type: "audio/mpeg" });
    await usuario.upload(screen.getByLabelText(/Importar de novo/), arquivo);
    expect(aoImportar).toHaveBeenCalledWith([arquivo]);
  });
});

describe("TelaDeSelecao removendo músicas", () => {
  const importada: Musica = { ...MUSICAS_DE_TESTE[0], id: "arquivo:Riff.mp3:10", titulo: "Riff", arquivo: new File(["x"], "Riff.mp3") };

  it("música embutida não pode ser removida", () => {
    abrir();
    expect(screen.queryByRole("button", { name: /Remover|Opções/ })).not.toBeInTheDocument();
  });

  it("com o menu de opções aberto, o Enter não começa a música", async () => {
    const { aoJogar, usuario } = abrir({ musicas: [importada] });
    await usuario.click(screen.getByRole("button", { name: "Opções de Riff" }));
    await usuario.keyboard("{Enter}");
    expect(aoJogar).not.toHaveBeenCalled();
  });

  it("abre um modal de confirmação antes de remover a música importada", async () => {
    const { aoRemover, usuario } = abrir({ musicas: [importada] });
    expect(screen.queryByRole("button", { name: /Remover Riff/ })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Opções de Riff" }));
    await usuario.click(screen.getByRole("menuitem", { name: /Apagar música/ }));
    const modal = screen.getByRole("dialog", { name: /Remover Riff/ });
    expect(aoRemover).not.toHaveBeenCalled();
    await usuario.click(within(modal).getByRole("button", { name: "Remover" }));
    expect(aoRemover).toHaveBeenCalledWith(importada);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Cancelar fecha o modal sem remover", async () => {
    const { aoRemover, usuario } = abrir({ musicas: [importada] });
    await usuario.click(screen.getByRole("button", { name: "Opções de Riff" }));
    await usuario.click(screen.getByRole("menuitem", { name: /Apagar música/ }));
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(aoRemover).not.toHaveBeenCalled();
  });

  it("Delete abre o modal", async () => {
    const { usuario } = abrir({ musicas: [importada] });
    await usuario.keyboard("{Delete}");
    expect(screen.getByRole("dialog", { name: /Remover Riff/ })).toBeInTheDocument();
  });

  // Com o modal aberto, as teclas não podem vazar para a seleção: Esc voltaria ao menu e as setas trocariam a música.
  it("com o modal aberto, Esc só fecha o modal e as setas não mexem na seleção", async () => {
    const { aoVoltar, aoJogar, aoSelecionar, usuario } = abrir({ musicas: [importada] });
    await usuario.keyboard("{Delete}");
    await usuario.keyboard("{ArrowDown}");
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(aoVoltar).not.toHaveBeenCalled();
    expect(aoSelecionar).not.toHaveBeenCalled();
    expect(aoJogar).not.toHaveBeenCalled();
  });

  it("favorita pelo botão Favoritar ou pela tecla F, marca no carrossel e lembra depois", async () => {
    const { usuario } = abrir({ indice: 0 });
    const coracao = screen.getByRole("button", { name: "Favoritar" });
    expect(coracao).toHaveAttribute("aria-pressed", "false");

    await usuario.click(coracao);
    expect(screen.getByRole("button", { name: "Tirar dos favoritos" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("list", { name: "Músicas" })).getAllByLabelText("Favorita")).toHaveLength(1);

    await usuario.keyboard("f");
    expect(screen.getByRole("button", { name: "Favoritar" })).toHaveAttribute("aria-pressed", "false");
    await usuario.keyboard("f");
    expect(JSON.parse(localStorage.getItem("riffrush:favoritas")!)).toEqual([MUSICAS_DE_TESTE[0].id]);
  });

  describe("filtro de favoritas", () => {
    it("começa desligado; ligado mostra só as favoritas e desligado volta a mostrar todas", async () => {
      localStorage.setItem("riffrush:favoritas", JSON.stringify(["neon-highway", "overdrive"]));
      const { usuario } = abrir({ indice: 0 });
      const filtro = screen.getByRole("button", { name: "Favoritos" });
      expect(filtro).toHaveAttribute("aria-pressed", "false");

      await usuario.click(filtro);
      expect(filtro).toHaveAttribute("aria-pressed", "true");
      const lista = screen.getByRole("list", { name: "Músicas" });
      expect(within(lista).getAllByRole("listitem").map((li) => li.textContent)).toEqual([expect.stringMatching(/Neon Highway/), expect.stringMatching(/Overdrive/)]);

      await usuario.click(filtro);
      expect(filtro).toHaveAttribute("aria-pressed", "false");
      expect(screen.getAllByRole("listitem")).toHaveLength(MUSICAS_DE_TESTE.length);
    });

    it("ligar com a selecionada fora das favoritas seleciona a próxima favorita", async () => {
      localStorage.setItem("riffrush:favoritas", JSON.stringify(["neon-highway", "overdrive"]));
      const { aoSelecionar, usuario } = abrir({ indice: 1 });
      await usuario.click(screen.getByRole("button", { name: "Favoritos" }));
      expect(aoSelecionar).toHaveBeenLastCalledWith(3);
    });

    it("as setas andam só pelas favoritas", async () => {
      localStorage.setItem("riffrush:favoritas", JSON.stringify(["neon-highway", "overdrive"]));
      const { aoSelecionar, usuario } = abrir({ indice: 3 });
      await usuario.click(screen.getByRole("button", { name: "Favoritos" }));
      await usuario.keyboard("{ArrowDown}");
      expect(aoSelecionar).toHaveBeenLastCalledWith(0);
    });

    it("sem favoritas, avisa no lugar da lista", async () => {
      const { usuario } = abrir();
      await usuario.click(screen.getByRole("button", { name: "Favoritos" }));
      expect(screen.queryByRole("list", { name: "Músicas" })).not.toBeInTheDocument();
      expect(screen.getByText(/Nenhuma música favorita/)).toBeInTheDocument();
    });

    it("desfavoritar a selecionada com o filtro ligado seleciona a próxima favorita", async () => {
      localStorage.setItem("riffrush:favoritas", JSON.stringify(["neon-highway", "overdrive"]));
      const { aoSelecionar, usuario } = abrir({ indice: 3 });
      await usuario.click(screen.getByRole("button", { name: "Favoritos" }));
      await usuario.keyboard("f");
      expect(aoSelecionar).toHaveBeenLastCalledWith(0);
    });
  });

  it("o botão Modificadores abre a modal, que muda a velocidade sem mexer na seleção", async () => {
    const { aoVelocidadeDaMusica, aoSelecionar, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: /Modificadores/ }));
    const modal = screen.getByRole("dialog", { name: "Modificadores" });
    await usuario.click(within(modal).getByRole("button", { name: /Velocidade/ }));
    expect(aoVelocidadeDaMusica).toHaveBeenCalledWith(1.25);
    await usuario.keyboard("{ArrowDown}");
    expect(aoSelecionar).not.toHaveBeenCalled();
  });
});

describe("no celular", () => {
  beforeEach(() => Object.defineProperty(window, "innerWidth", { value: 375, configurable: true }));
  afterEach(() => Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true }));

  const acoes = () => ({ aoSelecionar: vi.fn(), aoDificuldade: vi.fn(), aoInstrumento: vi.fn(), aoJogar: vi.fn(), aoVoltar: vi.fn(), aoImportar: vi.fn(), aoRemover: vi.fn(), aoVelocidadeDaMusica: vi.fn() });

  it("troca as abas por botões que abrem Detalhes e Ranking em modais", async () => {
    render(<TelaDeSelecao musicas={MUSICAS_DE_TESTE} indice={0} dificuldade="medio" instrumento="guitarra" personagem={PERSONAGEM_PADRAO} volumeDosEfeitos={0} velocidadeDaMusica={1} ranking={<p>top da música</p>} {...acoes()} />);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("top da música")).not.toBeInTheDocument();
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: /Ranking/ }));
    expect(within(screen.getByRole("dialog")).getByText("top da música")).toBeInTheDocument();
    await usuario.keyboard("{Escape}");

    await usuario.click(screen.getByRole("button", { name: /Detalhes/ }));
    expect(within(screen.getByRole("dialog")).getByText("Médio")).toBeInTheDocument();
  });

  it("Esc fecha o modal sem voltar ao menu", async () => {
    const a = acoes();
    render(<TelaDeSelecao musicas={MUSICAS_DE_TESTE} indice={0} dificuldade="medio" instrumento="guitarra" personagem={PERSONAGEM_PADRAO} volumeDosEfeitos={0} velocidadeDaMusica={1} ranking={<p>top da música</p>} {...a} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: /Ranking/ }));
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(a.aoVoltar).not.toHaveBeenCalled();
  });

  it("deixa o TOCAR fixo no rodapé, depois da lista", async () => {
    const a = acoes();
    render(<TelaDeSelecao musicas={MUSICAS_DE_TESTE} indice={0} dificuldade="medio" instrumento="guitarra" personagem={PERSONAGEM_PADRAO} volumeDosEfeitos={0} velocidadeDaMusica={1} {...a} />);
    const rodape = screen.getByRole("contentinfo");
    await userEvent.setup().click(within(rodape).getByRole("button", { name: /TOCAR/ }));
    expect(a.aoJogar).toHaveBeenCalled();
  });

  it("arrastar o dedo na lista troca a música", () => {
    const a = acoes();
    render(<TelaDeSelecao musicas={MUSICAS_DE_TESTE} indice={0} dificuldade="medio" instrumento="guitarra" personagem={PERSONAGEM_PADRAO} volumeDosEfeitos={0} velocidadeDaMusica={1} {...a} />);
    const lista = screen.getByRole("list", { name: "Músicas" });
    fireEvent.touchStart(lista, { touches: [{ clientY: 300 }] });
    fireEvent.touchMove(lista, { touches: [{ clientY: 200 }] });
    expect(a.aoSelecionar).toHaveBeenCalledWith(1);
  });

  it("o toque que arrastou não vira clique na música onde o dedo começou", () => {
    const a = acoes();
    render(<TelaDeSelecao musicas={MUSICAS_DE_TESTE} indice={0} dificuldade="medio" instrumento="guitarra" personagem={PERSONAGEM_PADRAO} volumeDosEfeitos={0} velocidadeDaMusica={1} {...a} />);
    const lista = screen.getByRole("list", { name: "Músicas" });
    const botao = lista.querySelector('[data-indice="2"] button')!;
    fireEvent.touchStart(botao, { touches: [{ clientY: 300 }] });
    fireEvent.touchMove(botao, { touches: [{ clientY: 290 }] });
    fireEvent.touchEnd(botao);
    fireEvent.click(botao);
    expect(a.aoSelecionar).not.toHaveBeenCalled();
    expect(a.aoJogar).not.toHaveBeenCalled();
  });

  it("apertar e segurar sem mover não vira clique", () => {
    vi.useFakeTimers();
    const a = acoes();
    render(<TelaDeSelecao musicas={MUSICAS_DE_TESTE} indice={0} dificuldade="medio" instrumento="guitarra" personagem={PERSONAGEM_PADRAO} volumeDosEfeitos={0} velocidadeDaMusica={1} {...a} />);
    const botao = screen.getByRole("list", { name: "Músicas" }).querySelector('[data-indice="2"] button')!;
    fireEvent.touchStart(botao, { touches: [{ clientY: 300 }] });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.touchEnd(botao);
    fireEvent.click(botao);
    vi.useRealTimers();
    expect(a.aoSelecionar).not.toHaveBeenCalled();
  });
});
