import { useEffect, useRef, useState } from "react";
import { FileAudio } from "lucide-react";

interface Props {
  /** Desligado, o aviso não aparece e nada é importado (no meio da música, por exemplo). */
  ativo: boolean;
  aoSoltar: (arquivos: File[]) => void;
}

const temArquivos = (evento: DragEvent) => Array.from(evento.dataTransfer?.types ?? []).includes("Files");

/** Arrastar arquivos para qualquer lugar da janela mostra onde soltar; soltar importa. */
export function SoltarParaImportar({ ativo, aoSoltar }: Props) {
  const [arrastando, setArrastando] = useState(false);
  const atual = useRef({ ativo, aoSoltar });
  atual.current = { ativo, aoSoltar };

  useEffect(() => {
    // dragenter e dragleave disparam em cada elemento filho: só esconde quando sai de todos.
    let profundidade = 0;
    const entrar = (evento: DragEvent) => {
      if (!temArquivos(evento)) return;
      evento.preventDefault();
      profundidade++;
      if (atual.current.ativo) setArrastando(true);
    };
    // Sem cancelar o dragover e o drop, o navegador abriria o arquivo no lugar do jogo.
    const passar = (evento: DragEvent) => {
      if (temArquivos(evento)) evento.preventDefault();
    };
    const sair = (evento: DragEvent) => {
      if (!temArquivos(evento)) return;
      profundidade = Math.max(0, profundidade - 1);
      if (!profundidade) setArrastando(false);
    };
    const soltar = (evento: DragEvent) => {
      if (!temArquivos(evento)) return;
      evento.preventDefault();
      profundidade = 0;
      setArrastando(false);
      if (atual.current.ativo) atual.current.aoSoltar(Array.from(evento.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", entrar);
    window.addEventListener("dragover", passar);
    window.addEventListener("dragleave", sair);
    window.addEventListener("drop", soltar);
    return () => {
      window.removeEventListener("dragenter", entrar);
      window.removeEventListener("dragover", passar);
      window.removeEventListener("dragleave", sair);
      window.removeEventListener("drop", soltar);
    };
  }, []);

  if (!arrastando || !ativo) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-fundo/80 p-8">
      <div className="placa flex flex-col items-center gap-4 border-2 border-dashed border-destaque px-16 py-12 text-center">
        <FileAudio className="size-16 text-destaque opacity-70" />
        <p className="font-titulo text-5xl leading-[1.1] tracking-wide uppercase">Solte para importar</p>
        <p className="text-lg text-texto-suave">Músicas, clipes ou pacotes .sng do Clone Hero</p>
      </div>
    </div>
  );
}
