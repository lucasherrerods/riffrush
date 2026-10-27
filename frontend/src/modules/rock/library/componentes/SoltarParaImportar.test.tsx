import { fireEvent, render, screen } from "@testing-library/react";
import { SoltarParaImportar } from "./SoltarParaImportar";

const comArquivos = (arquivos: File[]) => ({ dataTransfer: { types: ["Files"], files: arquivos } });

describe("SoltarParaImportar", () => {
  it("ao arrastar arquivos sobre a janela, mostra onde soltar", () => {
    render(<SoltarParaImportar ativo aoSoltar={vi.fn()} />);
    expect(screen.queryByText(/Solte para importar/)).toBeNull();
    fireEvent.dragEnter(window, comArquivos([]));
    expect(screen.getByText(/Solte para importar/)).toBeInTheDocument();
  });

  it("soltar entrega os arquivos e esconde o aviso", () => {
    const aoSoltar = vi.fn();
    const arquivo = new File(["x"], "musica.sng");
    render(<SoltarParaImportar ativo aoSoltar={aoSoltar} />);
    fireEvent.dragEnter(window, comArquivos([arquivo]));
    fireEvent.drop(window, comArquivos([arquivo]));
    expect(aoSoltar).toHaveBeenCalledWith([arquivo]);
    expect(screen.queryByText(/Solte para importar/)).toBeNull();
  });

  it("sair da janela arrastando esconde o aviso", () => {
    render(<SoltarParaImportar ativo aoSoltar={vi.fn()} />);
    fireEvent.dragEnter(window, comArquivos([]));
    fireEvent.dragLeave(window, comArquivos([]));
    expect(screen.queryByText(/Solte para importar/)).toBeNull();
  });

  it("ignora o que não é arquivo, como texto arrastado", () => {
    render(<SoltarParaImportar ativo aoSoltar={vi.fn()} />);
    fireEvent.dragEnter(window, { dataTransfer: { types: ["text/plain"], files: [] } });
    expect(screen.queryByText(/Solte para importar/)).toBeNull();
  });

  it("desligado (no meio da música), não aceita nada", () => {
    const aoSoltar = vi.fn();
    render(<SoltarParaImportar ativo={false} aoSoltar={aoSoltar} />);
    fireEvent.dragEnter(window, comArquivos([]));
    fireEvent.drop(window, comArquivos([new File(["x"], "a.wav")]));
    expect(screen.queryByText(/Solte para importar/)).toBeNull();
    expect(aoSoltar).not.toHaveBeenCalled();
  });
});
