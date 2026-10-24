import { ChevronsUpDown, Loader2, LogIn, LogOut, UserRound } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { avisar } from "@/shared/ui/avisos";
import { cn } from "@/shared/lib/utils";
import { sessaoDaConta } from "./sessao";
import { useConta } from "./useConta";

function FotoDaConta({ avatar, className }: { avatar: string | null; className: string }) {
  return (
    <span className="relative shrink-0">
      {avatar ? (
        <img src={avatar} alt="" referrerPolicy="no-referrer" className={cn("rounded-full", className)} />
      ) : (
        <UserRound className={cn("rounded-full bg-superficie-elevada p-1 text-texto-suave", className)} />
      )}
      <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-superficie bg-sucesso" />
    </span>
  );
}

/** No canto do cabeçalho: entrar com o Google ou abrir o menu da conta. */
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
  const progresso = <BarraDeProgresso fracao={xp_no_nivel / xp_para_o_proximo} rotulo={`XP do nível ${nivel}`} className="h-1 flex-1" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group -my-1 flex w-52 items-center gap-2.5 rounded-md px-2 py-1 text-left transition-colors outline-none hover:bg-superficie-elevada focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-superficie-elevada">
        <FotoDaConta avatar={conta.avatar} className="size-8" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-base leading-none font-bold">{conta.nome}</span>
          <span className="flex items-center gap-2">
            <span className="font-titulo text-base leading-none text-destaque">Nv {nivel}</span>
            {progresso}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-texto-suave transition-colors group-hover:text-texto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 p-2">
          <FotoDaConta avatar={conta.avatar} className="size-10" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate text-base leading-none font-bold">{conta.nome}</span>
            <span className="text-sm leading-none text-texto-suave">
              {xp_no_nivel} / {xp_para_o_proximo} XP para o <span className="font-titulo text-destaque">Nv {nivel + 1}</span>
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="perigo" onSelect={() => void sessaoDaConta.sair()}>
          <LogOut />
          Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
