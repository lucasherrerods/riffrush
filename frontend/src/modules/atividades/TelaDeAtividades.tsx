import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, UserRound } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { haQuantoTempo } from "@/shared/lib/formatar";
import { Button } from "@/shared/ui/button";
import { EtiquetaDeModo } from "@/shared/ui/EtiquetaDeModo";
import { apiDeAtividades, type Atividade } from "./api";
import { descreverAtividade, horaDaAtividade, juntarSemRepetir, type NomesLocais } from "./descrever";

/** O mesmo número que a API manda sem pedir outro: página cheia quer dizer que pode haver mais. */
const POR_PAGINA = 50;
/** De quanto em quanto tempo o log procura as novidades. */
const INTERVALO_MS = 30_000;

interface Props extends NomesLocais {
  aoVoltar: () => void;
  /** Para os testes. */
  carregar?: (antes: string | undefined, sinal: AbortSignal) => Promise<Atividade[]>;
  porPagina?: number;
  intervaloMs?: number;
}

/** O log do que a galera anda jogando nos dois modos, com a hora de cada coisa. Se atualiza sozinho. */
export function TelaDeAtividades({ aoVoltar, carregar = apiDeAtividades.recentes, porPagina = POR_PAGINA, intervaloMs = INTERVALO_MS, ...nomes }: Props) {
  useTeclado((evento) => evento.code === "Escape" && aoVoltar());
  const [atividades, setAtividades] = useState<Atividade[] | null>(null);
  const [erro, setErro] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);

  useEffect(() => {
    const controle = new AbortController();
    const atualizar = (primeira: boolean) =>
      carregar(undefined, controle.signal)
        .then((novas) => {
          if (controle.signal.aborted) return;
          setErro(false);
          setAtividades((atuais) => (atuais ? juntarSemRepetir(novas, atuais) : novas));
          if (primeira) setTemMais(novas.length >= porPagina);
        })
        .catch(() => !controle.signal.aborted && primeira && setErro(true));
    void atualizar(true);
    const relogio = setInterval(() => void atualizar(false), intervaloMs);
    return () => {
      controle.abort();
      clearInterval(relogio);
    };
    // `carregar` costuma ser recriada a cada render; o log só recomeça ao abrir a tela.
  }, [intervaloMs, porPagina]);

  const carregarMais = async () => {
    const ultima = atividades?.at(-1);
    if (!ultima) return;
    setCarregandoMais(true);
    try {
      const antigas = await carregar(ultima.quando, new AbortController().signal);
      setAtividades((atuais) => [...(atuais ?? []), ...antigas]);
      setTemMais(antigas.length >= porPagina);
    } catch {
      setErro(true);
    } finally {
      setCarregandoMais(false);
    }
  };

  return (
    <div className="respiro-de-tela flex h-full flex-col">
      <header className="flex items-center gap-4 max-md:gap-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela">Atividades</h1>
      </header>

      <section className="placa mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-2 p-4 max-md:p-2">
        {atividades === null ? (
          erro ? (
            <p className="m-auto text-base text-texto-suave">Não deu para carregar as atividades agora.</p>
          ) : (
            <Loader2 aria-label="Carregando as atividades" className="m-auto size-6 animate-spin text-texto-suave" />
          )
        ) : !atividades.length ? (
          <p className="m-auto text-base text-texto-suave">Ninguém jogou nada ainda.</p>
        ) : (
          <ol aria-label="Atividades" className="sem-barra-de-rolagem rolagem-de-toque flex min-h-0 flex-1 flex-col gap-1">
            {atividades.map((a) => (
              <LinhaDaAtividade key={`${a.conta_id}|${a.quando}|${a.evento.tipo}`} atividade={a} nomes={nomes} />
            ))}
            {temMais && (
              <li className="flex justify-center py-2">
                <Button variant="ghost" disabled={carregandoMais} onClick={() => void carregarMais()}>
                  {carregandoMais && <Loader2 className="animate-spin" aria-hidden />}
                  Carregar mais
                </Button>
              </li>
            )}
          </ol>
        )}
      </section>
    </div>
  );
}

function LinhaDaAtividade({ atividade, nomes }: { atividade: Atividade; nomes: NomesLocais }) {
  const { modo, acao, oQue, detalhe } = descreverAtividade(atividade.evento, nomes);
  return (
    <li className="chapa flex items-center gap-2 border-borda bg-superficie px-2 py-1 max-md:gap-1.5">
      <time dateTime={atividade.quando} title={haQuantoTempo(atividade.quando)} className="w-24 shrink-0 font-mono text-sm tabular-nums text-texto-suave max-md:w-16 max-md:text-xs">
        {horaDaAtividade(atividade.quando)}
      </time>
      {atividade.avatar ? (
        <img src={atividade.avatar} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-sm" />
      ) : (
        <UserRound className="size-8 shrink-0 text-texto-suave opacity-70" aria-hidden />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base max-md:text-sm">
          <strong>{atividade.nome}</strong> {acao} {oQue && <span className="font-bold">{oQue}</span>}
        </span>
        {detalhe && <span className="truncate text-sm text-texto-suave max-md:text-xs">{detalhe}</span>}
      </span>
      {modo && <EtiquetaDeModo modo={modo} />}
    </li>
  );
}
