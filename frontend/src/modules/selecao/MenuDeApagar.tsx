import { Ellipsis, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";

interface Props {
  nome: string;
  rotuloDoItem: string;
  descricao: string;
  /** O menu e a confirmação ficam com a tela, que precisa saber deles para pausar os atalhos de teclado. */
  menuAberto: boolean;
  aoMudarMenu: (aberto: boolean) => void;
  confirmando: boolean;
  aoMudarConfirmando: (aberto: boolean) => void;
  aoConfirmar: () => void;
}

/** Os três pontinhos da música selecionada, com a opção de apagar e o modal que confirma antes. */
export function MenuDeApagar({ nome, rotuloDoItem, descricao, menuAberto, aoMudarMenu, confirmando, aoMudarConfirmando, aoConfirmar }: Props) {
  const confirmar = () => {
    aoMudarConfirmando(false);
    aoConfirmar();
  };
  return (
    <>
      <DropdownMenu open={menuAberto} onOpenChange={aoMudarMenu}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Opções de ${nome}`}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="perigo" onSelect={() => aoMudarConfirmando(true)}>
            <Trash2 /> {rotuloDoItem}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmando} onOpenChange={aoMudarConfirmando}>
        <DialogContent>
          <DialogTitle>Remover {nome}?</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmar}>
              <Trash2 className="opacity-70" /> Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
