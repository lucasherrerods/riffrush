import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { obterContextoDeAudio, preferenciasDeAudio } from "@/modules/audio";
import { AudioContextFalso } from "@/test/audioFalso";
import { osu, pacote } from "@/test/beatmaps";
import type { BibliotecaDoMania, ConjuntoSalvo } from "./beatmaps/biblioteca";
import { lerOsz } from "./beatmaps/osz";
import { PlayerDeMusica } from "@/modules/player";
import { TelaDoMania } from "./TelaDoMania";

const conta = vi.hoisted(() => ({
  logada: false,
  registrar: vi.fn(async () => ({ pendente: true as const, id: "m1" })),
  esperar: vi.fn(async () => ({ xp_ganho: 77, antes: { nivel: 1, xp_no_nivel: 0, xp_para_o_proximo: 100 }, depois: { nivel: 1, xp_no_nivel: 77, xp_para_o_proximo: 100 } })),
}));
vi.mock("@/modules/conta", async (original) => {
  const real = await original<typeof import("@/modules/conta")>();
  return {
    ...real,
    useConta: () => ({ conta: conta.logada ? { id: "c", nome: "Ana" } : null }),
    sessaoDaConta: { registrarPartidaDoMania: conta.registrar, esperarXp: conta.esperar },
  };
});

vi.stubGlobal("AudioContext", AudioContextFalso);
const audio = () => obterContextoDeAudio() as unknown as AudioContextFalso;

/** Uma biblioteca na memória, com os .osz guardados como bytes. */
function bibliotecaNaMemoria(): BibliotecaDoMania {
  const conjuntos = new Map<string, ConjuntoSalvo>();
  const pacotes = new Map<string, Uint8Array>();
  return {
    listar: async () => [...conjuntos.values()],
    guardar: async (conjunto, osz) => {
      conjuntos.set(conjunto.id, conjunto);
      pacotes.set(conjunto.id, new Uint8Array(await osz.arrayBuffer()));
    },
    abrir: async (id) => (pacotes.has(id) ? lerOsz(pacotes.get(id)!) : undefined),
    usar: async () => {},
    remover: async (id) => void conjuntos.delete(id),
  };
}

const arquivoOsz = (nome = "musica.osz") => new File([new Uint8Array(pacote({ "a.osu": osu(), "audio.mp3": new Uint8Array([1]) }))], nome);

/** Abre o Mania e entra na biblioteca pelo Jogar do menu. */
async function abrir() {
  const biblioteca = bibliotecaNaMemoria();
  render(<TelaDoMania alavanca={<button type="button">alavanca</button>} abrirBiblioteca={async () => biblioteca} decodificar={async () => ({ duration: 10 }) as AudioBuffer} />);
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: "Jogar" }));
  return { usuario };
}

describe("TelaDoMania", () => {
  it("a tela fica no tema escuro, como no Rock, para os botões contornados pegarem a borda do tema e não a branca", async () => {
    await abrir();
    expect(document.querySelector("main")).toHaveClass("dark");
  });

  it("mostra a biblioteca vazia", async () => {
    await abrir();
    expect(await screen.findByText(/Nenhum mapa ainda/)).toBeInTheDocument();
  });

  it("importa um .osz pelo botão e mostra o conjunto como importado", async () => {
    const { usuario } = await abrir();
    await screen.findByText(/Nenhum mapa ainda/);
    await usuario.upload(screen.getByLabelText("Arquivos .osz"), arquivoOsz());
    expect(await screen.findByRole("heading", { name: "Música" })).toBeInTheDocument();
    expect(screen.getByText("Importado · sem XP nem ranking")).toBeInTheDocument();
  });

  it("importa arrastando, e ignora o que não é .osz", async () => {
    await abrir();
    await screen.findByText(/Nenhum mapa ainda/);
    fireEvent.drop(screen.getByRole("region", { name: "Seleção de mapas" }), { dataTransfer: { files: [new File(["x"], "foto.png"), arquivoOsz()] } });
    expect(await screen.findByRole("heading", { name: "Música" })).toBeInTheDocument();
  });

  it("escolhe a dificuldade, joga e chega no resultado", async () => {
    const { usuario } = await abrir();
    await screen.findByText(/Nenhum mapa ainda/);
    await usuario.upload(screen.getByLabelText("Arquivos .osz"), arquivoOsz());
    await screen.findByRole("heading", { name: "Música" });
    expect(screen.getByRole("radio", { name: /4K.*Hard/ })).toBeChecked();
    const fontesAntes = audio().fontes.length;
    await usuario.click(screen.getByRole("button", { name: /TOCAR/ }));
    expect(await screen.findByLabelText("Pista do Mania")).toBeInTheDocument();
    await waitFor(() => expect(audio().fontes.length).toBeGreaterThan(fontesAntes));
    // Ninguém toca: as notas viram Miss e o resultado chega.
    await act(async () => {
      audio().currentTime += 10;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(await screen.findByRole("button", { name: "Jogar de novo" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("region", { name: "Seleção de mapas" })).toBeInTheDocument();
  });

  // Bug: voltar da partida abria a seleção no primeiro conjunto, e a trilha trocava de música.
  it("depois da partida, a seleção volta no mesmo conjunto", async () => {
    const { usuario } = await abrir();
    await screen.findByText(/Nenhum mapa ainda/);
    const outro = new File([new Uint8Array(pacote({ "b.osu": osu({ titulo: "Outra", tituloUnicode: "Outra", conjuntoId: 8, beatmapId: 12 }), "audio.mp3": new Uint8Array([1]) }))], "outra.osz");
    await usuario.upload(screen.getByLabelText("Arquivos .osz"), [arquivoOsz(), outro]);
    await screen.findByRole("heading", { level: 2 });
    const tituloAntes = screen.getByRole("heading", { level: 2 }).textContent;
    fireEvent.keyDown(window, { code: "ArrowDown" });
    const escolhido = screen.getByRole("heading", { level: 2 }).textContent;
    expect(escolhido).not.toBe(tituloAntes);
    await usuario.click(screen.getByRole("button", { name: /TOCAR/ }));
    expect(await screen.findByLabelText("Pista do Mania")).toBeInTheDocument();
    fireEvent.keyDown(window, { code: "Escape" });
    expect(await screen.findByRole("region", { name: "Seleção de mapas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(escolhido);
  });

  // Bug: a seleção reabria no mapa de quando ela abriu antes, e o player trocava de música, perdendo o ponto da partida.
  it("saindo da partida, a trilha continua na música do mapa jogado, sem passar por outra", async () => {
    const seguirMapa = vi.spyOn(PlayerDeMusica.prototype, "seguirMapa");
    const { usuario } = await abrir();
    await screen.findByText(/Nenhum mapa ainda/);
    const outro = new File([new Uint8Array(pacote({ "b.osu": osu({ titulo: "Outra", tituloUnicode: "Outra", conjuntoId: 8, beatmapId: 12 }), "audio.mp3": new Uint8Array([1]) }))], "outra.osz");
    await usuario.upload(screen.getByLabelText("Arquivos .osz"), [arquivoOsz(), outro]);
    await screen.findByRole("heading", { level: 2 });
    // Reabrir a seleção com o player já tocando guarda o mapa em que ela abriu.
    fireEvent.keyDown(window, { code: "Escape" });
    await usuario.click(await screen.findByRole("button", { name: "Jogar" }));
    await screen.findByRole("heading", { level: 2 });
    fireEvent.keyDown(window, { code: "ArrowDown" });
    const escolhido = screen.getByRole("heading", { level: 2 }).textContent;
    await usuario.click(screen.getByRole("button", { name: /TOCAR/ }));
    expect(await screen.findByLabelText("Pista do Mania")).toBeInTheDocument();
    seguirMapa.mockClear();
    fireEvent.keyDown(window, { code: "Escape" });
    expect(await screen.findByRole("region", { name: "Seleção de mapas" })).toBeInTheDocument();
    await act(async () => new Promise((r) => setTimeout(r, 400)));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(escolhido);
    expect(seguirMapa).not.toHaveBeenCalled();
    seguirMapa.mockRestore();
  });

  it("Treinar abre o mapa na escolha das partes, sem jogar o mapa inteiro", async () => {
    const { usuario } = await abrir();
    await screen.findByText(/Nenhum mapa ainda/);
    await usuario.upload(screen.getByLabelText("Arquivos .osz"), arquivoOsz());
    await screen.findByRole("heading", { name: "Música" });
    expect(screen.getByRole("radio", { name: /4K.*Hard/ })).toBeChecked();
    await usuario.click(screen.getByRole("button", { name: "Treinar" }));
    expect(await screen.findByRole("heading", { name: "Treinar" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Sair da música/ }));
    expect(await screen.findByRole("region", { name: "Seleção de mapas" })).toBeInTheDocument();
  });

  it("baixa um mapa pela busca e ele entra na biblioteca como do osu!", async () => {
    const biblioteca = bibliotecaNaMemoria();
    const mapa = {
      beatmapsetId: 7,
      titulo: "Musica",
      tituloUnicode: "Música",
      artista: "Banda",
      artistaUnicode: "Banda",
      mapper: "Mapper",
      status: "ranked",
      dificuldades: [{ beatmapId: 11, nome: "Hard", teclas: 4, estrelas: 3.2, hash: "h", duracaoS: 1 }],
    };
    render(<TelaDoMania abrirBiblioteca={async () => biblioteca} buscar={async () => ({ mapas: [mapa], temMais: false })} baixar={async () => arquivoOsz()} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Buscar mapas" }));
    await usuario.click(await screen.findByRole("button", { name: "Baixar Musica" }));
    const [salvo] = await biblioteca.listar();
    expect(salvo).toMatchObject({ id: "osu:7", origem: "osu", status: "ranked" });
    // Baixado, o mapa abre na seleção direto da busca.
    await usuario.click(await screen.findByRole("button", { name: "Jogar Musica" }));
    expect(await screen.findByRole("heading", { name: "Música" })).toBeInTheDocument();
    expect(screen.queryByText("Importado · sem XP nem ranking")).not.toBeInTheDocument();
  });

  it("com a conta conectada, partida em mapa ranked manda o replay e mostra o XP", async () => {
    conta.logada = true;
    try {
      const biblioteca = bibliotecaNaMemoria();
      const mapa = { beatmapsetId: 7, titulo: "Musica", tituloUnicode: "Música", artista: "Banda", artistaUnicode: "Banda", mapper: "Mapper", status: "ranked", dificuldades: [] };
      render(<TelaDoMania abrirBiblioteca={async () => biblioteca} buscar={async () => ({ mapas: [mapa], temMais: false })} baixar={async () => arquivoOsz()} decodificar={async () => ({ duration: 10 }) as AudioBuffer} />);
      const usuario = userEvent.setup();
      await usuario.click(screen.getByRole("button", { name: "Buscar mapas" }));
      await usuario.click(await screen.findByRole("button", { name: "Baixar Musica" }));
      await usuario.click(await screen.findByRole("button", { name: "Jogar Musica" }));
      await screen.findByRole("heading", { name: "Música" });
      expect(screen.getByRole("radio", { name: /4K.*Hard/ })).toBeChecked();
      const fontesAntes = audio().fontes.length;
      await usuario.click(screen.getByRole("button", { name: /TOCAR/ }));
      await waitFor(() => expect(audio().fontes.length).toBeGreaterThan(fontesAntes));
      await act(async () => {
        audio().currentTime += 10;
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      });
      expect(await screen.findByText("+77 XP")).toBeInTheDocument();
      expect(conta.registrar).toHaveBeenCalledWith(11, expect.any(Uint8Array));
      expect(conta.esperar).toHaveBeenCalledWith("m1", { modo: "mania" });
    } finally {
      conta.logada = false;
    }
  });

  it("abre na tela inicial, com a logo e a alavanca, e o Voltar das telas leva de volta a ela", async () => {
    const biblioteca = bibliotecaNaMemoria();
    render(<TelaDoMania alavanca={<button type="button">alavanca</button>} abrirBiblioteca={async () => biblioteca} />);
    const usuario = userEvent.setup();
    expect(screen.getByRole("navigation", { name: "Menu do Mania" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "alavanca" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Buscar mapas" }));
    expect(await screen.findByRole("heading", { name: "Buscar mapas" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("navigation", { name: "Menu do Mania" })).toBeInTheDocument();
  });

  it("as configurações abrem numa tela própria, e o áudio mudado nela é o global, o mesmo do Rock", async () => {
    const biblioteca = bibliotecaNaMemoria();
    render(<TelaDoMania alavanca={<button type="button">alavanca</button>} abrirBiblioteca={async () => biblioteca} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Configurações" }));
    expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Menu do Mania" })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("tab", { name: /Áudio/ }));
    const antes = preferenciasDeAudio.estado().volumeDosEfeitos;
    fireEvent.keyDown(screen.getByRole("slider", { name: "Volume dos efeitos" }), { key: "ArrowLeft" });
    expect(preferenciasDeAudio.estado().volumeDosEfeitos).toBeCloseTo(antes - 0.05);
    await usuario.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("navigation", { name: "Menu do Mania" })).toBeInTheDocument();
  });

  it("a seleção não tem a barra do Mania, e abre a busca, que volta para ela", async () => {
    const { usuario } = await abrir();
    expect(screen.queryByRole("navigation", { name: "Telas do Mania" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "alavanca" })).not.toBeInTheDocument();
    await usuario.click(await screen.findByRole("button", { name: "Buscar mapas" }));
    await usuario.click(await screen.findByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("region", { name: "Seleção de mapas" })).toBeInTheDocument();
  });
});
