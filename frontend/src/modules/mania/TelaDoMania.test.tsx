import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { obterContextoDeAudio } from "@/modules/audio";
import { AudioContextFalso } from "@/test/audioFalso";
import { osu, pacote } from "@/test/beatmaps";
import type { BibliotecaDoMania, ConjuntoSalvo } from "./beatmaps/biblioteca";
import { lerOsz } from "./beatmaps/osz";
import { TelaDoMania } from "./TelaDoMania";

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
  const aoTrocarDeModo = vi.fn();
  render(<TelaDoMania aoTrocarDeModo={aoTrocarDeModo} abrirBiblioteca={async () => biblioteca} decodificar={async () => ({}) as AudioBuffer} />);
  return { aoTrocarDeModo, usuario: userEvent.setup() };
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

  it("o botão do cabeçalho volta para o Rock", async () => {
    const { aoTrocarDeModo, usuario } = abrir();
    await usuario.click(screen.getByRole("button", { name: "Ir para o Rock" }));
    expect(aoTrocarDeModo).toHaveBeenCalled();
  });
});
