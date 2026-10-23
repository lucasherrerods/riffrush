import { Loader2, LogIn, LogOut, UserRound } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import { avisar } from "@/shared/ui/avisos";
import { sessaoDaConta } from "./sessao";
import { useConta } from "./useConta";

/** No canto do cabeçalho: entrar com o Google ou ver o nível da conta. */
export function CartaoDaConta() {
  const { conta, carregando } = useConta();

  if (carregando) return <Loader2 aria-label="Carregando a conta" className="size-4 animate-spin text-texto-suave" />;

  if (!conta) {
    return (
      <Button variant="ghost" onClick={() => void sessaoDaConta.entrar().catch((erro) => avisar.error(String(erro)))}>
        <LogIn className="opacity-70" />
        Entrar com Google
      </Button>
    );
  }

  const { nivel, xp_no_nivel, xp_para_o_proximo } = conta.nivel;
  return (
    <div className="flex items-center gap-2">
      {conta.avatar ? (
        <img src={conta.avatar} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" />
      ) : (
        <UserRound className="size-8 text-texto-suave" />
      )}
      <div className="flex w-32 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-base font-bold">{conta.nome}</span>
          <span className="font-titulo text-base text-destaque">Nv {nivel}</span>
        </span>
        <BarraDeProgresso fracao={xp_no_nivel / xp_para_o_proximo} rotulo={`XP do nível ${nivel}`} className="h-1" />
      </div>
      <Button variant="ghost" size="icon" aria-label="Sair da conta" onClick={() => void sessaoDaConta.sair()}>
        <LogOut />
      </Button>
    </div>
  );
}
