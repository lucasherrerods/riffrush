import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, Copy, Ellipsis, Eye, Search, Send, UserPlus, Users, X } from "lucide-react";
import { FotoDaConta } from "@/modules/conta";
import { descreverEstado, podeAssistir, usePresenca, type PessoaOnline } from "@/modules/presenca";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { avisar } from "@/shared/ui/avisos";
import { convitePodeSair, filtrarPorNome, separarPorPresenca, vistoHa, type AmigoOnline } from "./amigos";
import type { ApiDosAmigos, PessoaDaAmizade, SugestaoDeAmizade } from "./api";
import { listaDeAmigos } from "./loja";

interface Props {
  aoFechar: () => void;
  /** O código da sala online em que a pessoa está: com ele, dá para chamar os amigos. */
  salaParaConvidar?: string;
  aoConvidar: (contaId: string, codigo: string) => void;
  /** Abre a partida ao vivo do amigo, como na tela Online. */
  aoAssistir?: (pessoa: PessoaOnline) => void;
}

export function useAmigos() {
  return useSyncExternalStore(listaDeAmigos.inscrever, listaDeAmigos.estado);
}

/** Os ids das contas amigas, para outras telas destacarem os amigos. Carrega a lista quando liga. */
export function useIdsDosAmigos(ligado: boolean): ReadonlySet<string> {
  const { listas } = useAmigos();
  useEffect(() => {
    if (ligado) void listaDeAmigos.recarregar();
  }, [ligado]);
  return useMemo(() => new Set(listas?.amigos.map((amigo) => amigo.conta_id)), [listas]);
}

/** Roda a ação na API e avisa o resultado; o erro vem com a mensagem da API. */
function agir(acao: (api: ApiDosAmigos, token: string) => Promise<unknown>, sucesso?: string) {
  return listaDeAmigos
    .agir(acao)
    .then(() => sucesso && avisar.success(sucesso))
    .catch((erro: Error) => avisar.error(erro.message));
}

/** A lista de amigos ao lado da tela: quem está online, pedidos e sugestões. */
export function PainelDeAmigos({ aoFechar, salaParaConvidar, aoConvidar, aoAssistir }: Props) {
  const { listas, sugestoes } = useAmigos();
  const [aba, setAba] = useState("amigos");
  const [adicionando, setAdicionando] = useState(false);

  useTeclado((evento) => {
    if (evento.code === "Escape" && !(evento.target instanceof HTMLInputElement)) aoFechar();
  });
  useEffect(() => {
    void listaDeAmigos.recarregar();
  }, []);
  useEffect(() => {
    if (aba === "sugestoes") void listaDeAmigos.carregarSugestoes();
  }, [aba]);

  const pedidos = listas?.recebidos.length ?? 0;
  return (
    <aside aria-label="Amigos" className="placa flex h-full w-[26rem] flex-col gap-4 p-4 max-md:w-full max-md:p-2">
      <header className="flex items-center gap-2">
        <Users className="size-6 opacity-70" aria-hidden />
        <h2 className="flex-1 font-titulo text-3xl leading-none">Amigos</h2>
        <Button variant="ghost" size="icon" onClick={aoFechar} aria-label="Fechar amigos">
          <X />
        </Button>
      </header>

      <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col gap-4">
        <TabsList variant="line" className="w-full">
          <TabsTrigger value="amigos">Amigos</TabsTrigger>
          <TabsTrigger value="solicitacoes">
            Pedidos
            {pedidos > 0 && <Contador valor={pedidos} />}
          </TabsTrigger>
          <TabsTrigger value="sugestoes">Sugestões</TabsTrigger>
        </TabsList>
        <TabsContent value="amigos" className="flex min-h-0 flex-col gap-4">
          {listas ? <AbaDeAmigos amigos={listas.amigos} salaParaConvidar={salaParaConvidar} aoConvidar={aoConvidar} aoAssistir={aoAssistir} /> : <Carregando />}
        </TabsContent>
        <TabsContent value="solicitacoes" className="flex min-h-0 flex-col gap-4">
          {listas ? <AbaDePedidos recebidos={listas.recebidos} enviados={listas.enviados} bloqueados={listas.bloqueados} /> : <Carregando />}
        </TabsContent>
        <TabsContent value="sugestoes" className="flex min-h-0 flex-col gap-4">
          {sugestoes ? <AbaDeSugestoes sugestoes={sugestoes} /> : <Carregando />}
        </TabsContent>
      </Tabs>

      {adicionando && listas && <AdicionarAmigo codigo={listas.codigo} aoFechar={() => setAdicionando(false)} />}
      {!adicionando && (
        <Button className="w-full" onClick={() => setAdicionando(true)}>
          <UserPlus /> Adicionar amigo
        </Button>
      )}
    </aside>
  );
}

export function Contador({ valor }: { valor: number }) {
  return (
    <span aria-label={`${valor} pendentes`} className="ml-1 rounded-full bg-primary px-1.5 font-titulo text-sm leading-5 text-primary-foreground">
      {valor > 9 ? "9+" : valor}
    </span>
  );
}

const Carregando = () => <p className="m-auto text-base text-texto-suave">Carregando...</p>;

function AbaDeAmigos({ amigos, salaParaConvidar, aoConvidar, aoAssistir }: { amigos: PessoaDaAmizade[] } & Pick<Props, "salaParaConvidar" | "aoConvidar" | "aoAssistir">) {
  const presenca = usePresenca();
  const [busca, setBusca] = useState("");
  const [agora] = useState(() => new Date());
  if (!amigos.length) return <Vazio>Nenhum amigo ainda. Passe o seu código ou adicione o de alguém.</Vazio>;
  const { online, offline } = separarPorPresenca(filtrarPorNome(amigos, busca), presenca.pessoas);
  return (
    <>
      <label className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 opacity-70" aria-hidden />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar amigos..." aria-label="Buscar amigos" className="pl-9" />
      </label>
      <div className="rolagem-de-toque sem-barra-de-rolagem flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {!presenca.conectada && <p className="text-base text-texto-suave">Ative "Aparecer online" na tela Online para ver quem está jogando.</p>}
        <Secao titulo={`Online (${online.length})`} online>
          {online.map((amigo) => (
            <LinhaDeAmigo key={amigo.conta_id} pessoa={amigo} online detalhe={descreverEstado(amigo.estado)}>
              {aoAssistir && podeAssistir(amigo.estado) && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Assistir ${amigo.nome}`}
                  onClick={() => aoAssistir({ id: amigo.conta_id, nome: amigo.nome, avatar: amigo.avatar, estado: amigo.estado })}
                >
                  <Eye className="opacity-70" /> Assistir
                </Button>
              )}
              {convitePodeSair(salaParaConvidar, amigo.estado) && (
                <Button variant="outline" size="sm" onClick={() => convidar(amigo, salaParaConvidar!, aoConvidar)}>
                  Convidar
                </Button>
              )}
              <MenuDoAmigo pessoa={amigo} />
            </LinhaDeAmigo>
          ))}
        </Secao>
        <Secao titulo={`Offline (${offline.length})`}>
          {offline.map((amigo) => (
            <LinhaDeAmigo key={amigo.conta_id} pessoa={amigo} detalhe={vistoHa(amigo.visto_em, agora)}>
              <MenuDoAmigo pessoa={amigo} />
            </LinhaDeAmigo>
          ))}
        </Secao>
      </div>
    </>
  );
}

function convidar(amigo: AmigoOnline, codigo: string, aoConvidar: Props["aoConvidar"]) {
  aoConvidar(amigo.conta_id, codigo);
  avisar.success(`Convite enviado para ${amigo.nome}.`);
}

function AbaDePedidos({ recebidos, enviados, bloqueados }: { recebidos: PessoaDaAmizade[]; enviados: PessoaDaAmizade[]; bloqueados: PessoaDaAmizade[] }) {
  if (!recebidos.length && !enviados.length && !bloqueados.length) return <Vazio>Nenhum pedido por aqui.</Vazio>;
  return (
    <div className="rolagem-de-toque sem-barra-de-rolagem flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {recebidos.length > 0 && (
        <Secao titulo={`Recebidos (${recebidos.length})`}>
          {recebidos.map((p) => (
            <LinhaDeAmigo key={p.conta_id} pessoa={p} detalhe={`Nv ${p.nivel}`}>
              <Button size="sm" onClick={() => void agir((api, t) => api.aceitar(t, p.conta_id), `Você e ${p.nome} agora são amigos.`)}>
                Aceitar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void agir((api, t) => api.desfazer(t, p.conta_id))}>
                Recusar
              </Button>
            </LinhaDeAmigo>
          ))}
        </Secao>
      )}
      {enviados.length > 0 && (
        <Secao titulo={`Enviados (${enviados.length})`}>
          {enviados.map((p) => (
            <LinhaDeAmigo key={p.conta_id} pessoa={p} detalhe="Esperando resposta">
              <Button variant="ghost" size="sm" onClick={() => void agir((api, t) => api.desfazer(t, p.conta_id))}>
                Cancelar
              </Button>
            </LinhaDeAmigo>
          ))}
        </Secao>
      )}
      {bloqueados.length > 0 && (
        <Secao titulo={`Bloqueados (${bloqueados.length})`}>
          {bloqueados.map((p) => (
            <LinhaDeAmigo key={p.conta_id} pessoa={p} detalhe="Bloqueado">
              <Button variant="ghost" size="sm" onClick={() => void agir((api, t) => api.desbloquear(t, p.conta_id))}>
                Desbloquear
              </Button>
            </LinhaDeAmigo>
          ))}
        </Secao>
      )}
    </div>
  );
}

function AbaDeSugestoes({ sugestoes }: { sugestoes: SugestaoDeAmizade[] }) {
  if (!sugestoes.length) return <Vazio>Sem sugestões por enquanto. Elas aparecem conforme seus amigos fazem amigos.</Vazio>;
  return (
    <ul className="rolagem-de-toque sem-barra-de-rolagem flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {sugestoes.map((s) => (
        <LinhaDeAmigo key={s.conta_id} pessoa={s} detalhe={s.amigos_em_comum === 1 ? "1 amigo em comum" : `${s.amigos_em_comum} amigos em comum`}>
          <Button variant="outline" size="sm" onClick={() => void agir((api, t) => api.pedir(t, { conta_id: s.conta_id }), `Pedido enviado para ${s.nome}.`)}>
            Adicionar
          </Button>
        </LinhaDeAmigo>
      ))}
    </ul>
  );
}

function AdicionarAmigo({ codigo, aoFechar }: { codigo: string; aoFechar: () => void }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => {
    setEnviando(true);
    await listaDeAmigos
      .agir((api, t) => api.pedir(t, { codigo: texto }))
      .then(({ amigos }) => {
        avisar.success(amigos ? "Vocês agora são amigos." : "Pedido enviado.");
        aoFechar();
      })
      .catch((erro: Error) => avisar.error(erro.message));
    setEnviando(false);
  };
  return (
    <form
      className="chapa flex flex-col gap-2 border-borda bg-superficie p-2"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <div className="flex items-center gap-2">
        <Input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Código do amigo (RIFF-...)" aria-label="Código do amigo" maxLength={32} />
        <Button type="submit" size="icon" disabled={!texto.trim() || enviando} aria-label="Enviar pedido">
          <Send />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={aoFechar} aria-label="Cancelar">
          <X />
        </Button>
      </div>
      <div className="flex items-center gap-2 text-base text-texto-suave">
        <span className="flex-1">
          Seu código: <span className="font-titulo text-lg text-texto">{codigo}</span>
        </span>
        <BotaoDeCopiar texto={codigo} />
      </div>
    </form>
  );
}

function BotaoDeCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() =>
        void navigator.clipboard
          .writeText(texto)
          .then(() => setCopiado(true))
          .catch(() => avisar.error("Não consegui copiar."))
      }
    >
      {copiado ? <Check className="opacity-70" /> : <Copy className="opacity-70" />} {copiado ? "Copiado" : "Copiar"}
    </Button>
  );
}

function MenuDoAmigo({ pessoa }: { pessoa: PessoaDaAmizade }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Mais opções de ${pessoa.nome}`}>
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void agir((api, t) => api.desfazer(t, pessoa.conta_id), `${pessoa.nome} saiu da sua lista.`)}>Remover amigo</DropdownMenuItem>
        <DropdownMenuItem variant="perigo" onSelect={() => void agir((api, t) => api.bloquear(t, pessoa.conta_id), `${pessoa.nome} foi bloqueado.`)}>
          Bloquear
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Secao({ titulo, online = false, children }: { titulo: string; online?: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="flex items-center gap-2 font-titulo text-xl leading-none">
        <span className={online ? "size-2.5 rounded-full bg-sucesso" : "size-2.5 rounded-full bg-texto-suave"} aria-hidden />
        {titulo}
      </h3>
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  );
}

function LinhaDeAmigo({ pessoa, detalhe, online = false, children }: { pessoa: { nome: string; avatar: string | null }; detalhe: string; online?: boolean; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-superficie-hover">
      <FotoDaConta avatar={pessoa.avatar} online={online} className="size-10" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={online ? "truncate text-base font-bold" : "truncate text-base font-bold text-texto-suave"}>{pessoa.nome}</span>
        <span className="truncate text-sm text-texto-suave">{detalhe}</span>
      </span>
      {children}
    </li>
  );
}

const Vazio = ({ children }: { children: ReactNode }) => <p className="m-auto max-w-[32ch] text-center text-base text-texto-suave">{children}</p>;
