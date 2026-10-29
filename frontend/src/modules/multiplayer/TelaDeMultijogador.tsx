import { ArrowLeft, Download, Loader2, LogOut } from "lucide-react";
import type { Personagem } from "@/modules/rock/character";
import type { Musica } from "@/modules/rock/songs";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { Lobby } from "./componentes/Lobby";
import { ProcurarSala } from "./componentes/ProcurarSala";
import { podeTocarOnline } from "./online";
import { sairDaSala, useConexao } from "./sala";

interface Props {
  personagem: Personagem;
  musicas: Musica[];
  volumeDosEfeitos: number;
  aoVoltar: () => void;
  aoEditarPersonagem: () => void;
  /** Abre a busca de músicas sem sair da sala. */
  aoBuscarMusicas: () => void;
}

export function TelaDeMultijogador({ personagem, musicas, volumeDosEfeitos, aoVoltar, aoEditarPersonagem, aoBuscarMusicas }: Props) {
  const { sala, info, erro, online, codigo, endereco } = useConexao();
  const musicasDaSala = online ? musicas.filter(podeTocarOnline) : musicas;

  useTeclado((evento) => {
    if (evento.code === "Escape" && !(evento.target instanceof HTMLInputElement)) aoVoltar();
  });

  return (
    <div className="respiro-de-tela flex h-full flex-col max-md:rolagem-de-toque">
      <header className="flex items-center gap-4 max-md:gap-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela">Multiplayer</h1>
        <div className="flex-1" />
        {sala && (
          <Button variant="ghost" aria-label="Baixar músicas" onClick={aoBuscarMusicas}>
            <Download className="opacity-70" /> <span className="max-md:hidden">Baixar músicas</span>
          </Button>
        )}
        {sala && (
          <Button variant="ghost" aria-label="Sair da sala" onClick={() => sairDaSala()}>
            <LogOut className="opacity-70" /> <span className="max-md:sr-only">Sair da sala</span>
          </Button>
        )}
      </header>

      {erro && !sala && (
        <p role="alert" className="chapa border-perigo px-4 py-3 text-base">
          {erro}
        </p>
      )}

      {!sala && <ProcurarSala personagem={personagem} volumeDosEfeitos={volumeDosEfeitos} aoEditarPersonagem={aoEditarPersonagem} />}
      {sala?.status === "conectando" && (
        <p className="flex flex-1 items-center justify-center gap-2 text-base text-texto-suave">
          <Loader2 className="animate-spin" aria-hidden /> Conectando na sala...
        </p>
      )}
      {sala && sala.status !== "conectando" && <Lobby sala={sala} info={info} codigo={codigo} endereco={endereco} musicas={musicasDaSala} volumeDosEfeitos={volumeDosEfeitos} />}
    </div>
  );
}
