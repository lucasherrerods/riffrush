import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";
import { avisar } from "@/shared/ui/avisos";
import { sessaoDaConta } from "./sessao";
import { useConta } from "./useConta";

/** Para quem está logado: apaga a conta e tudo o que a API guarda dela. */
export function ExcluirConta() {
  const { conta } = useConta();
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  if (!conta) return null;

  const excluir = async () => {
    setExcluindo(true);
    try {
      await sessaoDaConta.excluirConta();
      setConfirmando(false);
      avisar.success("Sua conta e seus dados foram apagados.");
    } catch (erro) {
      avisar.error(`Não deu para excluir a conta: ${erro instanceof Error ? erro.message : String(erro)}`);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <>
      <Button variant="destructive" onClick={() => setConfirmando(true)}>
        <Trash2 className="opacity-70" /> Excluir minha conta
      </Button>
      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogTitle>Excluir a conta de {conta.nome}?</DialogTitle>
          <DialogDescription>
            Seu nível, seu XP e o histórico de partidas serão apagados do servidor. Recordes e músicas salvos neste aparelho continuam. Isso não pode ser desfeito.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" disabled={excluindo} onClick={() => void excluir()}>
              {excluindo ? <Loader2 className="animate-spin" /> : <Trash2 className="opacity-70" />} Excluir para sempre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
