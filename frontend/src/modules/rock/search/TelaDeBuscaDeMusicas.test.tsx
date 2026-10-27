import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { avisar } from "@/shared/ui/avisos";
import type { FiltrosDaBusca, RespostaDaBusca, ResultadoDaBusca } from "./encore";
import { TelaDeBuscaDeMusicas } from "./TelaDeBuscaDeMusicas";

function resultado(titulo: string, extra: Partial<ResultadoDaBusca> = {}): ResultadoDaBusca {
  return { md5: titulo.padEnd(32, "0"), titulo, artista: "Banda", album: "", genero: "Rock", ano: "", charter: "Fulano", duracaoMs: 125000, instrumentos: ["guitarra"], versaoDoEncoder: 0, temVideo: false, ...extra };
}

function abrir(
  buscar = vi.fn(async (): Promise<RespostaDaBusca> => ({ total: 1, resultados: [resultado("Hit")] })),
  extra: Partial<React.ComponentProps<typeof TelaDeBuscaDeMusicas>> = {},
) {
  const aoVoltar = vi.fn();
  render(<TelaDeBuscaDeMusicas buscar={buscar} atrasoMs={0} aoVoltar={aoVoltar} {...extra} />);
  return { buscar, aoVoltar, usuario: userEvent.setup() };
}

const ultimaChamada = (buscar: ReturnType<typeof vi.fn>) => buscar.mock.lastCall as unknown as [FiltrosDaBusca, number];

vi.mock("@/shared/ui/avisos", () => ({ avisar: { error: vi.fn() } }));

describe("TelaDeBuscaDeMusicas", () => {
  it("abre com o título e já lista músicas", async () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Buscar músicas" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Hit" })).toBeInTheDocument();
    expect(screen.getByText(/Fulano/)).toBeInTheDocument();
    expect(screen.getByText("2:05")).toBeInTheDocument();
  });

  it("busca pelo texto digitado", async () => {
    const { buscar, usuario } = abrir();
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar músicas" }), "sandman");
    await waitFor(() => expect(ultimaChamada(buscar)[0].texto).toBe("sandman"));
  });

  it("espera a digitação parar antes de buscar o texto", async () => {
    const buscar = vi.fn(async (): Promise<RespostaDaBusca> => ({ total: 0, resultados: [] }));
    render(<TelaDeBuscaDeMusicas buscar={buscar} atrasoMs={200} aoVoltar={vi.fn()} />);
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Buscar músicas" }), "abc");
    await waitFor(() => expect(ultimaChamada(buscar)[0].texto).toBe("abc"));
    expect(buscar.mock.calls.map((c) => (c as unknown as [FiltrosDaBusca])[0].texto)).toEqual(["", "abc"]);
  });

  it("os filtros de instrumento, dificuldade e gênero são selects e entram na busca", async () => {
    const { buscar, usuario } = abrir();
    await usuario.selectOptions(screen.getByRole("combobox", { name: "Instrumento" }), "baixo");
    await usuario.selectOptions(screen.getByRole("combobox", { name: "Dificuldade" }), "expert");
    await usuario.selectOptions(screen.getByRole("combobox", { name: "Gênero" }), "metal");
    await waitFor(() => expect(ultimaChamada(buscar)[0]).toMatchObject({ instrumento: "baixo", dificuldade: "expert", genero: "metal" }));
    // Com gênero, o texto procura só no nome da música.
    expect(screen.getByRole("searchbox", { name: "Buscar músicas" })).toHaveAttribute("placeholder", "Nome da música");
  });

  it("pagina os resultados", async () => {
    const buscar = vi.fn(async (): Promise<RespostaDaBusca> => ({ total: 25, resultados: [resultado("Hit")] }));
    const { usuario } = abrir(buscar);
    expect(await screen.findByText("Página 1 de 3")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(ultimaChamada(buscar)[1]).toBe(2));
    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("avisa quando não encontra nada", async () => {
    abrir(vi.fn(async () => ({ total: 0, resultados: [] })));
    expect(await screen.findByText(/Nenhuma música encontrada/)).toBeInTheDocument();
  });

  it("mostra o erro da busca", async () => {
    abrir(vi.fn(async () => Promise.reject(new Error("O Encore está indisponível agora."))));
    expect(await screen.findByRole("alert")).toHaveTextContent("indisponível");
  });

  it("Esc volta ao menu", async () => {
    const { aoVoltar, usuario } = abrir();
    await screen.findByRole("heading", { name: "Hit" });
    await usuario.keyboard("{Escape}");
    expect(aoVoltar).toHaveBeenCalled();
  });

  describe("download", () => {
    const hit = resultado("Hit");

    it("Baixar chama o download e mostra o progresso", async () => {
      let terminar = (_ok: boolean) => {};
      const aoBaixar = vi.fn((_r: ResultadoDaBusca, { aoProgredir }: { aoProgredir: (f: number) => void }) => {
        aoProgredir(0.42);
        return new Promise<boolean>((resolve) => (terminar = resolve));
      });
      const { usuario } = abrir(undefined, { aoBaixar });
      await usuario.click(await screen.findByRole("button", { name: "Baixar Hit" }));
      expect(aoBaixar).toHaveBeenCalledWith(hit, expect.objectContaining({ comVideo: false }));
      expect(await screen.findByText("Baixando 42%")).toBeInTheDocument();
      terminar(true);
      await waitFor(() => expect(screen.queryByText(/Baixando/)).not.toBeInTheDocument());
    });

    it("baixa um por vez", async () => {
      const aoBaixar = vi.fn(() => new Promise<boolean>(() => {}));
      const buscar = vi.fn(async () => ({ total: 2, resultados: [hit, resultado("Outra")] }));
      const { usuario } = abrir(buscar, { aoBaixar });
      await usuario.click(await screen.findByRole("button", { name: "Baixar Hit" }));
      expect(screen.getByRole("button", { name: "Baixar Outra" })).toBeDisabled();
    });

    it("a opção de vídeo de fundo vai para o download", async () => {
      const aoBaixar = vi.fn(async () => true);
      const { usuario } = abrir(undefined, { aoBaixar });
      await usuario.click(screen.getByRole("switch", { name: "Baixar com vídeo de fundo" }));
      await usuario.click(await screen.findByRole("button", { name: "Baixar Hit" }));
      expect(aoBaixar).toHaveBeenCalledWith(hit, expect.objectContaining({ comVideo: true }));
    });

    it("música já baixada mostra Jogar", async () => {
      const aoJogar = vi.fn();
      const { usuario } = abrir(undefined, { aoBaixar: vi.fn(), aoJogar, baixadas: new Set([hit.md5]) });
      await usuario.click(await screen.findByRole("button", { name: "Jogar Hit" }));
      expect(aoJogar).toHaveBeenCalledWith(hit.md5);
      expect(screen.queryByRole("button", { name: "Baixar Hit" })).not.toBeInTheDocument();
    });

    it("avisa quando o download falha e libera o botão", async () => {
      const { usuario } = abrir(undefined, { aoBaixar: vi.fn(async () => Promise.reject(new Error("Esse chart não está mais no Encore."))) });
      await usuario.click(await screen.findByRole("button", { name: "Baixar Hit" }));
      await waitFor(() => expect(avisar.error).toHaveBeenCalledWith("Esse chart não está mais no Encore."));
      expect(screen.getByRole("button", { name: "Baixar Hit" })).toBeEnabled();
    });

    it("sem download disponível, não mostra o botão", async () => {
      abrir();
      await screen.findByRole("heading", { name: "Hit" });
      expect(screen.queryByRole("button", { name: "Baixar Hit" })).not.toBeInTheDocument();
    });

    describe("arquivo grande", () => {
      const pedirConfirmacao = (resposta: { valor?: boolean }) =>
        vi.fn(async (_r: ResultadoDaBusca, { confirmarTamanho }: { confirmarTamanho: (bytes: number) => Promise<boolean> }) => {
          resposta.valor = await confirmarTamanho(420 * 1024 * 1024);
          return resposta.valor;
        });

      it("pergunta num modal mostrando o tamanho, e Baixar confirma", async () => {
        const resposta: { valor?: boolean } = {};
        const { usuario } = abrir(undefined, { aoBaixar: pedirConfirmacao(resposta) });
        await usuario.click(await screen.findByRole("button", { name: "Baixar Hit" }));
        const modal = await screen.findByRole("alertdialog", { name: "Arquivo grande" });
        expect(modal).toHaveTextContent("420 MB");
        await usuario.click(within(modal).getByRole("button", { name: "Baixar mesmo assim" }));
        await waitFor(() => expect(resposta.valor).toBe(true));
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });

      it("Esc cancela o download sem sair da tela", async () => {
        const resposta: { valor?: boolean } = {};
        const { usuario, aoVoltar } = abrir(undefined, { aoBaixar: pedirConfirmacao(resposta) });
        await usuario.click(await screen.findByRole("button", { name: "Baixar Hit" }));
        await screen.findByRole("alertdialog");
        await usuario.keyboard("{Escape}");
        await waitFor(() => expect(resposta.valor).toBe(false));
        expect(aoVoltar).not.toHaveBeenCalled();
      });
    });
  });
});
