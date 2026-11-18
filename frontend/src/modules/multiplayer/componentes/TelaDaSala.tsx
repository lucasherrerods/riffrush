import { useState, type ReactNode } from "react";
import { ArrowLeft, Download, Loader2, LogOut, UserPlus } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";

interface Props {
  /** O jogador já está numa sala (conectando ou dentro). */
  naSala: boolean;
  conectando: boolean;
  /** O aviso de quando a sala acabou ou não abriu. */
  erro?: string;
  aoVoltar: () => void;
  aoSair: () => void;
  /** Abre a busca do modo sem sair da sala. */
  aoBaixar?: () => void;
  rotuloDoBaixar?: string;
  /** Só a sala online alcança os amigos. */
  aoConvidarAmigos?: () => void;
  /** Fora da sala: a busca de salas. */
  busca: ReactNode;
  /** Dentro da sala: o lobby do modo. */
  lobby: ReactNode;
}

/** A moldura da tela de multijogador, igual nos dois modos. */
export function TelaDaSala({ naSala, conectando, erro, aoVoltar, aoSair, aoBaixar, rotuloDoBaixar = "Baixar músicas", aoConvidarAmigos, busca, lobby }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  // Dentro da sala, voltar é sair dela: pergunta antes, para ninguém sair sem querer.
  const voltar = () => (naSala ? setConfirmando(true) : aoVoltar());
  useTeclado((evento) => {
    if (evento.code === "Escape" && !confirmando && !(evento.target instanceof HTMLInputElement)) voltar();
  });

  return (
    <div className="respiro-de-tela flex h-full flex-col max-md:rolagem-de-toque">
      <header className="flex items-center gap-4 max-md:gap-2">
        <Button variant="ghost" size="icon" onClick={voltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela">Multiplayer</h1>
        <div className="flex-1" />
        {naSala && aoConvidarAmigos && (
          <Button variant="ghost" aria-label="Convidar amigos" onClick={aoConvidarAmigos}>
            <UserPlus className="opacity-70" /> <span className="max-md:hidden">Convidar amigos</span>
          </Button>
        )}
        {naSala && aoBaixar && (
          <Button variant="ghost" aria-label={rotuloDoBaixar} onClick={aoBaixar}>
            <Download className="opacity-70" /> <span className="max-md:hidden">{rotuloDoBaixar}</span>
          </Button>
        )}
        {naSala && (
          <Button variant="ghost" aria-label="Sair da sala" onClick={aoSair}>
            <LogOut className="opacity-70" /> <span className="max-md:sr-only">Sair da sala</span>
          </Button>
        )}
      </header>

      {erro && !naSala && (
        <p role="alert" className="chapa border-perigo px-4 py-3 text-base">
          {erro}
        </p>
      )}

      {!naSala && busca}
      {conectando && (
        <p className="flex flex-1 items-center justify-center gap-2 text-base text-texto-suave">
          <Loader2 className="animate-spin" aria-hidden /> Conectando na sala...
        </p>
      )}
      {naSala && !conectando && lobby}
      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogTitle>Sair da sala?</DialogTitle>
          <DialogDescription>Voltar daqui tira você da sala. Para voltar a jogar com o pessoal, é preciso entrar de novo.</DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Ficar</Button>
            </DialogClose>
            <Button
              onClick={() => {
                setConfirmando(false);
                aoSair();
                aoVoltar();
              }}
            >
              Sair da sala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
