import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { obterContextoDeAudio } from "@/modules/audio";
import { AudioContextFalso } from "@/test/audioFalso";
import { osu, pacote } from "@/test/beatmaps";
import type { BibliotecaDoMania, ConjuntoSalvo } from "./beatmaps/biblioteca";
import { lerOsz } from "./beatmaps/osz";
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

function abrir() {
  const biblioteca = bibliotecaNaMemoria();
  render(<TelaDoMania alavanca={<button type="button">alavanca</button>} abrirBiblioteca={async () => biblioteca} decodificar={async () => ({}) as AudioBuffer} />);
  return { usuario: userEvent.setup() };
}

describe("TelaDoMania", () => {
  it("mostra o nome do Riff Rush Mania e a biblioteca vazia", async () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Riff Rush Mania" })).toBeInTheDocument();
    expect(await screen.findByText(/Nenhum mapa ainda/)).toBeInTheDocument();
  });

  it("importa um .osz pelo botão e mostra o conjunto como importado", async () => {
    const { usuario } = abrir();
    await screen.findByText(/Nenhum mapa ainda/);
    await usuario.upload(screen.getByLabelText("Arquivos .osz"), arquivoOsz());
    expect(await screen.findByText("Música")).toBeInTheDocument();
    expect(screen.getByText("Importado · sem XP")).toBeInTheDocument();
  });

  it("importa arrastando, e ignora o que não é .osz", async () => {
    abrir();
    await screen.findByText(/Nenhum mapa ainda/);
    fireEvent.drop(screen.getByRole("region", { name: "Seleção de mapas" }), { dataTransfer: { files: [new File(["x"], "foto.png"), arquivoOsz()] } });
    expect(await screen.findByText("Música")).toBeInTheDocument();
  });

  it("escolhe a dificuldade, joga e chega no resultado", async () => {
    const { usuario } = abrir();
    await screen.findByText(/Nenhum mapa ainda/);
    await usuario.upload(screen.getByLabelText("Arquivos .osz"), arquivoOsz());
    expect(screen.getByRole("button", { name: "Jogar" })).toBeDisabled();
    await usuario.click(await screen.findByText("Música"));
    await usuario.click(within(screen.getByRole("list", { name: "Dificuldades" })).getByRole("button", { name: /4K.*Hard/ }));
    const fontesAntes = audio().fontes.length;
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
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
    render(<TelaDoMania abrirBiblioteca={async () => biblioteca} buscar={async () => [mapa]} baixar={async () => arquivoOsz()} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Buscar mapas" }));
    await usuario.click(await screen.findByRole("button", { name: "Baixar Musica" }));
    expect(await screen.findByText("Baixado")).toBeInTheDocument();
    const [salvo] = await biblioteca.listar();
    expect(salvo).toMatchObject({ id: "osu:7", origem: "osu", status: "ranked" });
    await usuario.click(screen.getByRole("button", { name: "Biblioteca" }));
    expect(await screen.findByText("Música")).toBeInTheDocument();
    expect(screen.queryByText("Importado · sem XP")).not.toBeInTheDocument();
  });

  it("com a conta conectada, partida em mapa ranked manda o replay e mostra o XP", async () => {
    conta.logada = true;
    try {
      const biblioteca = bibliotecaNaMemoria();
      const mapa = { beatmapsetId: 7, titulo: "Musica", tituloUnicode: "Música", artista: "Banda", artistaUnicode: "Banda", mapper: "Mapper", status: "ranked", dificuldades: [] };
      render(<TelaDoMania abrirBiblioteca={async () => biblioteca} buscar={async () => [mapa]} baixar={async () => arquivoOsz()} decodificar={async () => ({}) as AudioBuffer} />);
      const usuario = userEvent.setup();
      await usuario.click(screen.getByRole("button", { name: "Buscar mapas" }));
      await usuario.click(await screen.findByRole("button", { name: "Baixar Musica" }));
      await screen.findByText("Baixado");
      await usuario.click(screen.getByRole("button", { name: "Biblioteca" }));
      await usuario.click(await screen.findByText("Música"));
      await usuario.click(within(screen.getByRole("list", { name: "Dificuldades" })).getByRole("button", { name: /4K.*Hard/ }));
      const fontesAntes = audio().fontes.length;
      await usuario.click(screen.getByRole("button", { name: "Jogar" }));
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

  it("a alavanca fica no cabeçalho, junto da logo do Mania", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Riff Rush Mania" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "alavanca" })).toBeInTheDocument();
  });
});
