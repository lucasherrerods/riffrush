import { useEffect, useState } from "react";
import { Loader2, Trophy, UserRound } from "lucide-react";
import { sessaoDaConta, useConta } from "@/modules/conta";
import type { Dificuldade } from "@/modules/songs";
import { URL_DA_API } from "@/shared/lib/api";
import { useValorAtrasado } from "@/shared/hooks/useValorAtrasado";
import { cn } from "@/shared/lib/utils";
import { criarApiDoRanking, type ApiDoRanking, type PosicaoNoRanking, type RespostaDoRanking } from "./api";
import { haQuantoTempo, precisaoDaPartida } from "./formatar";

interface Props {
  /** O id da música no ranking (`idDoRanking` do módulo songs). */
  musicaId: string;
  dificuldade: Dificuldade;
  api?: ApiDoRanking;
  /** Espera a seleção parar antes de pedir: girar o carrossel passa por muitas músicas. */
  atrasoMs?: number;
  lerToken?: () => string | null;
}

type Estado = { tipo: "carregando" } | { tipo: "pronto"; ranking: RespostaDoRanking } | { tipo: "erro" };

const apiPadrao = criarApiDoRanking(URL_DA_API);
const formatar = (n: number) => n.toLocaleString("pt-BR");

/** O ranking da música selecionada, como no osu!: o top rolável e o recorde pessoal fixo embaixo. */
export function PainelDeRanking({ musicaId, dificuldade, api = apiPadrao, atrasoMs = 300, lerToken = () => sessaoDaConta.token() }: Props) {
  // Entrar ou sair da conta muda o recorde pessoal: a conta entra no pedido.
  const contaId = useConta().conta?.id ?? null;
  const pedido = useValorAtrasado(`${musicaId}\n${dificuldade}\n${contaId}`, atrasoMs);
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    const [id, dificuldadePedida] = pedido.split("\n") as [string, Dificuldade];
    const controle = new AbortController();
    setEstado({ tipo: "carregando" });
    api
      .buscar(id, dificuldadePedida, { token: lerToken() ?? undefined, sinal: controle.signal })
      .then((ranking) => !controle.signal.aborted && setEstado({ tipo: "pronto", ranking }))
      .catch(() => !controle.signal.aborted && setEstado({ tipo: "erro" }));
    return () => controle.abort();
    // lerToken é lido na hora do pedido; a conta já está na chave do pedido.
  }, [pedido, api]);

  if (estado.tipo === "carregando") {
    return (
      <p className="flex items-center gap-2 p-4 text-base text-texto-suave">
        <Loader2 className="size-4 animate-spin opacity-70" aria-hidden /> Carregando o ranking...
      </p>
    );
  }
  if (estado.tipo === "erro") {
    return (
      <p role="alert" className="p-4 text-base text-texto-suave">
        Não deu para carregar o ranking.
      </p>
    );
  }

  const { top, meu, jogadores } = estado.ranking;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {top.length ? (
        <ol aria-label="Ranking" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {top.map((linha) => (
            <LinhaDoRanking key={linha.posicao} linha={linha} minha={!!meu && meu.posicao === linha.posicao} />
          ))}
        </ol>
      ) : (
        <p className="flex-1 p-4 text-base text-texto-suave">Ninguém terminou esta música nesta dificuldade ainda. Seja o primeiro!</p>
      )}
      {meu && (
        <section aria-label="Recorde pessoal" className="flex flex-col gap-1">
          <p className="px-2 text-base text-texto-suave">
            Recorde pessoal (#{formatar(meu.posicao)} de {formatar(jogadores)})
          </p>
          <ol>
            <LinhaDoRanking linha={meu} minha />
          </ol>
        </section>
      )}
    </div>
  );
}

function LinhaDoRanking({ linha, minha }: { linha: PosicaoNoRanking; minha: boolean }) {
  return (
    <li className={cn("chapa flex items-center gap-4 p-2 pr-4", minha ? "border-primaria bg-superficie-elevada" : "border-borda bg-superficie")}>
      <span className={cn("w-12 shrink-0 text-center font-titulo text-2xl", linha.posicao <= 3 ? "text-ouro" : "text-texto-suave")}>#{linha.posicao}</span>
      {linha.avatar ? (
        <img src={linha.avatar} alt="" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-sm" />
      ) : (
        <UserRound className="size-10 shrink-0 text-texto-suave opacity-70" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold">{linha.nome}</span>
        <span className="block truncate text-base text-texto-suave">
          {precisaoDaPartida(linha.acertos, linha.total)} · {haQuantoTempo(linha.jogada_em)}
        </span>
      </span>
      {linha.posicao === 1 && <Trophy className="size-4 shrink-0 text-ouro opacity-70" aria-label="Primeiro lugar" />}
      <span className="shrink-0 font-mono text-xl font-black tabular-nums">{formatar(linha.pontos)}</span>
    </li>
  );
}
