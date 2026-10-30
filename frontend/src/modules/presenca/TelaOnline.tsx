import { useState } from "react";
import { ArrowLeft, Eye, House, Loader2, Play, Radio, Search, UserRound, Users } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import type { EstadoDaPresenca } from "./conexao";
import { descreverEstado } from "./descrever";
import { FILTROS_DO_LOBBY, amigosPrimeiro, contarGrupos, filtrarLobby, grupoDoEstado, podeAssistir, type FiltroDoLobby, type GrupoDoLobby } from "./lobby";
import { ordenarPessoas, type PessoaOnline } from "./protocolo";

export interface PreferenciasOnline {
  /** `null` enquanto a pessoa ainda não respondeu se quer aparecer. */
  mostrarOnline: boolean | null;
  permitirEspectadores: boolean;
}

interface Props extends PreferenciasOnline {
  logado: boolean;
  euId: string | null;
  presenca: EstadoDaPresenca;
  /** Ids das contas amigas: sobem para o topo e ganham a marca de amigo. */
  amigos?: ReadonlySet<string>;
  aoMudar: (preferencias: Partial<PreferenciasOnline>) => void;
  aoAssistir: (pessoa: PessoaOnline) => void;
  aoVoltar: () => void;
}

const SEM_AMIGOS: ReadonlySet<string> = new Set();

/** O lobby de quem está online: o que cada um está fazendo e, para quem deixa, o botão de assistir à partida ao vivo. */
export function TelaOnline({ logado, euId, presenca, amigos = SEM_AMIGOS, mostrarOnline, permitirEspectadores, aoMudar, aoAssistir, aoVoltar }: Props) {
  useTeclado((evento) => evento.code === "Escape" && !(evento.target instanceof HTMLInputElement) && aoVoltar());
  const pessoas = ordenarPessoas(presenca.pessoas, euId);
  const noLobby = logado && mostrarOnline === true && presenca.conectada;

  return (
    <div className="respiro-de-tela flex h-full flex-col">
      <header className="flex items-center gap-4 max-md:gap-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela">Online</h1>
        {noLobby && <span className="font-titulo text-2xl leading-none text-texto-suave">{pessoas.length} online</span>}
      </header>

      <section className="placa mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 p-4 max-md:p-2">
        {!logado ? (
          <p className="m-auto text-base text-texto-suave">Entre na sua conta para ver quem está online.</p>
        ) : mostrarOnline !== true ? (
          <Consentimento recusou={mostrarOnline === false} aoAceitar={() => aoMudar({ mostrarOnline: true })} aoRecusar={() => aoMudar({ mostrarOnline: false })} />
        ) : (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <Opcao id="mostrar-online" rotulo="Aparecer online" ligada onMudar={(ligada) => aoMudar({ mostrarOnline: ligada })} />
              <Opcao id="espectadores" rotulo="Deixar assistirem minhas partidas" ligada={permitirEspectadores} onMudar={(ligada) => aoMudar({ permitirEspectadores: ligada })} />
            </div>
            {presenca.conectada ? (
              <Lobby pessoas={pessoas} amigos={amigos} aoAssistir={aoAssistir} />
            ) : (
              <p className="m-auto flex items-center gap-2 text-base text-texto-suave">
                <Loader2 className="size-4 animate-spin opacity-70" aria-hidden /> Conectando...
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Consentimento({ recusou, aoAceitar, aoRecusar }: { recusou: boolean; aoAceitar: () => void; aoRecusar: () => void }) {
  return (
    <div className="m-auto flex max-w-xl flex-col items-center gap-4 text-center">
      <Radio className="size-8 text-texto-suave opacity-70" aria-hidden />
      <p className="text-base">
        Para ver quem está online, você também aparece na lista: seu nome, sua foto e a música que está tocando. Quem estiver online pode assistir às suas
        partidas ao vivo. Dá para desligar as duas coisas quando quiser.
      </p>
      {recusou && <p className="text-base text-texto-suave">Você escolheu não aparecer online.</p>}
      <div className="flex gap-4">
        <Button size="lg" onClick={aoAceitar}>
          Aparecer online
        </Button>
        {!recusou && (
          <Button size="lg" variant="outline" onClick={aoRecusar}>
            Agora não
          </Button>
        )}
      </div>
    </div>
  );
}

function Opcao({ id, rotulo, ligada, onMudar }: { id: string; rotulo: string; ligada: boolean; onMudar: (ligada: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={ligada} onCheckedChange={onMudar} />
      <Label htmlFor={id} className="text-base">
        {rotulo}
      </Label>
    </div>
  );
}

const ICONES_DOS_GRUPOS: Record<GrupoDoLobby, typeof Play> = { tocando: Play, sala: Users, menu: House };

function Lobby({ pessoas, amigos, aoAssistir }: { pessoas: PessoaOnline[]; amigos: ReadonlySet<string>; aoAssistir: (pessoa: PessoaOnline) => void }) {
  const [filtro, setFiltro] = useState<FiltroDoLobby>("todos");
  const [busca, setBusca] = useState("");
  if (!pessoas.length) return <p className="m-auto text-base text-texto-suave">Só você está online agora.</p>;
  const contagem = contarGrupos(pessoas);
  const vistas = amigosPrimeiro(filtrarLobby(pessoas, filtro, busca), amigos);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 max-md:flex-col max-md:items-stretch max-md:gap-2">
        <Tabs value={filtro} onValueChange={(valor) => setFiltro(valor as FiltroDoLobby)} className="min-w-0 flex-1">
          <TabsList variant="line" className="abas-rolaveis w-full">
            {FILTROS_DO_LOBBY.map(({ id, rotulo }) => (
              <TabsTrigger key={id} value={id}>
                {rotulo}
                <span className="ml-1 text-texto-suave">{contagem[id]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <label className="relative w-64 max-md:w-full">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 opacity-70" aria-hidden />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoas..." aria-label="Buscar pessoas" className="pl-9" />
        </label>
      </div>

      {vistas.length ? (
        <ul aria-label="Pessoas online" className="rolagem-de-toque sem-barra-de-rolagem grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto max-md:grid-cols-1">
          {vistas.map((pessoa) => (
            <CartaoDaPessoa key={pessoa.id} pessoa={pessoa} amigo={amigos.has(pessoa.id)} aoAssistir={aoAssistir} />
          ))}
        </ul>
      ) : (
        <p className="m-auto text-base text-texto-suave">Ninguém por aqui.</p>
      )}
    </>
  );
}

function CartaoDaPessoa({ pessoa, amigo, aoAssistir }: { pessoa: PessoaOnline; amigo: boolean; aoAssistir: (pessoa: PessoaOnline) => void }) {
  const Icone = ICONES_DOS_GRUPOS[grupoDoEstado(pessoa.estado)];
  return (
    <li className="chapa flex items-center gap-4 border-borda bg-superficie px-4 py-2">
      {pessoa.avatar ? (
        <img src={pessoa.avatar} alt="" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-sm" />
      ) : (
        <UserRound className="size-10 shrink-0 text-texto-suave opacity-70" aria-hidden />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-bold">{pessoa.nome}</span>
          {amigo && <span className="shrink-0 rounded-sm bg-primary px-1.5 font-titulo text-sm leading-5 text-primary-foreground">Amigo</span>}
        </span>
        <span className="flex items-center gap-1 text-base text-texto-suave">
          <Icone className="size-4 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{descreverEstado(pessoa.estado)}</span>
        </span>
      </span>
      {podeAssistir(pessoa.estado) && (
        <Button variant="outline" onClick={() => aoAssistir(pessoa)} aria-label={`Assistir ${pessoa.nome}`}>
          <Eye className="opacity-70" /> <span className="max-md:sr-only">Assistir</span>
        </Button>
      )}
    </li>
  );
}
