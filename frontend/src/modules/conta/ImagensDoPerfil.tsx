import { useRef, useState, type ReactNode } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { TipoDeImagem } from "./api";
import { FotoDaConta } from "./FotoDaConta";
import { ehFotoPropria, reduzirImagem } from "./imagemDoPerfil";
import { sessaoDaConta } from "./sessao";

/** Troca e remove a foto e a capa. Cada função devolve o endereço que passa a valer (ou nenhum). */
export interface EditorDeImagens {
  trocar: (tipo: TipoDeImagem, arquivo: File) => Promise<string>;
  remover: (tipo: TipoDeImagem) => Promise<string | null>;
}

export const editorDaSessao: EditorDeImagens = {
  trocar: async (tipo, arquivo) => sessaoDaConta.trocarImagem(tipo, await reduzirImagem(arquivo, tipo)),
  remover: async (tipo) => {
    await sessaoDaConta.removerImagem(tipo);
    return tipo === "foto" ? (sessaoDaConta.estado().conta?.avatar ?? null) : null;
  },
};

const FORMATOS = "image/png,image/jpeg,image/webp";

/** O topo do perfil: a capa, a foto e o que vier ao lado dela (nome, nível). */
export function ImagensDoPerfil({ avatar, capa, editor, children }: { avatar: string | null; capa: string | null; editor: EditorDeImagens; children: ReactNode }) {
  const [enderecos, setEnderecos] = useState<Record<TipoDeImagem, string | null>>({ foto: avatar, capa });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arquivos = { foto: useRef<HTMLInputElement>(null), capa: useRef<HTMLInputElement>(null) };

  async function fazer(tipo: TipoDeImagem, acao: () => Promise<string | null>) {
    setOcupado(true);
    setErro(null);
    try {
      const endereco = await acao();
      setEnderecos((atuais) => ({ ...atuais, [tipo]: endereco }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar a imagem.");
    } finally {
      setOcupado(false);
    }
  }

  const escolher = (tipo: TipoDeImagem) => (evento: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (arquivo) void fazer(tipo, () => editor.trocar(tipo, arquivo));
  };

  return (
    <>
      {(["foto", "capa"] as const).map((tipo) => (
        <input key={tipo} ref={arquivos[tipo]} type="file" accept={FORMATOS} className="sr-only" tabIndex={-1} aria-label={`Arquivo da ${tipo}`} onChange={escolher(tipo)} />
      ))}

      <div className="relative h-40 overflow-hidden rounded-lg bg-superficie-elevada max-md:h-24">
        {enderecos.capa && <img src={enderecos.capa} alt="Capa do perfil" className="size-full object-cover" />}
        <div className="absolute right-2 bottom-2 flex gap-2">
          {enderecos.capa && (
            <Button variant="secondary" size="icon-sm" disabled={ocupado} aria-label="Remover capa" onClick={() => fazer("capa", () => editor.remover("capa"))}>
              <Trash2 />
            </Button>
          )}
          <Button variant="secondary" size="sm" disabled={ocupado} onClick={() => arquivos.capa.current?.click()}>
            <ImagePlus className="opacity-70" />
            {enderecos.capa ? "Trocar capa" : "Adicionar capa"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-6 max-md:gap-3">
        <div className="relative shrink-0">
          <FotoDaConta avatar={enderecos.foto} className="size-20 max-md:size-14" />
          <Button
            variant="secondary"
            size="icon-xs"
            disabled={ocupado}
            aria-label="Trocar foto"
            className="absolute -top-1 -left-1 rounded-full"
            onClick={() => arquivos.foto.current?.click()}
          >
            <Camera />
          </Button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {children}
          {ehFotoPropria(enderecos.foto) && (
            <Button variant="link" size="xs" disabled={ocupado} className="self-start px-0" onClick={() => fazer("foto", () => editor.remover("foto"))}>
              Voltar para a foto do Google
            </Button>
          )}
          {erro && (
            <p role="alert" className="text-sm text-perigo">
              {erro}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
