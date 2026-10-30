import { ChevronsUpDown, CircleHelp, Loader2, LogOut, Settings2, UserRound } from "lucide-react";
import { abrirLink } from "@/modules/platform";
import { Button } from "@/shared/ui/button";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { avisar } from "@/shared/ui/avisos";
import { FotoDaConta } from "./FotoDaConta";
import { LogoDoGoogle } from "./LogoDoGoogle";
import { sessaoDaConta } from "./sessao";
import { SeloMod } from "@/shared/ui/SeloMod";
import { useConta } from "./useConta";

export const URL_DA_AJUDA = "https://github.com/lucasherrerods/riffrush/issues";

/** No canto do cabeçalho: entrar com o Google ou abrir o menu da conta. */
export function CartaoDaConta({
  aoVerPerfil,
  aoConfigurar,
  mod = false,
}: {
  aoVerPerfil: () => void;
  aoConfigurar: () => void;
  /** Mostra o selo Mod embaixo do nome. */
  mod?: boolean;
}) {
  const { conta, carregando } = useConta();

  if (carregando) return <Loader2 aria-label="Carregando a conta" className="size-4 animate-spin text-texto-suave" />;

  if (!conta) {
    return (
      <Button
        variant="outline"
        aria-label="Entrar com Google"
        className="gap-2.5 px-4 font-medium"
        onClick={() => void sessaoDaConta.entrar().catch((erro) => avisar.error(String(erro)))}
      >
        <LogoDoGoogle className="size-4" />
        Google
      </Button>
    );
  }

  const { nivel, xp_no_nivel, xp_para_o_proximo } = conta.nivel;
  const progresso = <BarraDeProgresso fracao={xp_no_nivel / xp_para_o_proximo} rotulo={`XP do nível ${nivel}`} className="h-1 flex-1" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex w-48 min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 max-md:w-32 max-md:gap-1.5 max-md:px-1 text-left transition-colors outline-none hover:bg-superficie-hover focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-superficie-elevada">
        <FotoDaConta avatar={conta.avatar} className="size-7 max-md:size-6" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-base leading-none font-bold max-md:text-sm">{conta.nome}</span>
          <span className="flex items-center gap-2">
            <span className="shrink-0 font-titulo text-base leading-none text-destaque max-md:text-sm">Nv {nivel}</span>
            {progresso}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-texto-suave max-md:hidden transition-colors group-hover:text-texto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex flex-col gap-4 p-2">
          <span className="flex items-center gap-4">
            <FotoDaConta avatar={conta.avatar} className="size-12" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-base leading-tight font-bold">{conta.nome}</span>
              {conta.email && <span className="truncate text-sm leading-tight text-texto-suave">{conta.email}</span>}
              {mod && <SeloMod />}
            </span>
          </span>
          <span className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-titulo text-2xl leading-none text-destaque">Nv {nivel}</span>
              <span className="text-sm leading-none text-texto-suave tabular-nums">
                {xp_no_nivel} / {xp_para_o_proximo} XP
              </span>
            </span>
            <BarraDeProgresso fracao={xp_no_nivel / xp_para_o_proximo} rotulo={`XP para o nível ${nivel + 1}`} className="h-1.5" />
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={aoVerPerfil}>
          <UserRound />
          Ver perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={aoConfigurar}>
          <Settings2 />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void abrirLink(URL_DA_AJUDA)}>
          <CircleHelp />
          Ajuda
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="perigo" onSelect={() => void sessaoDaConta.sair()}>
          <LogOut />
          Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
