import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { sessaoDaConta, useConta } from "@/modules/conta";
import { Button } from "@/shared/ui/button";
import { apiDoRanking, type PosicaoNoGeral, type RespostaDoGeral } from "./api";
import { LinhaComPosicao } from "./LinhaComPosicao";

interface Props {
  aoVoltar: () => void;
  carregar?: (sinal: AbortSignal) => Promise<RespostaDoGeral>;
}

type Estado = { tipo: "carregando" } | { tipo: "pronto"; ranking: RespostaDoGeral } | { tipo: "erro" };

const carregarPadrao = (sinal: AbortSignal) => apiDoRanking.geral({ token: sessaoDaConta.token() ?? undefined, sinal });
const formatar = (n: number) => n.toLocaleString("pt-BR");

/** O ranking geral: os jogadores com mais XP e, para quem está logado, a própria posição fixa embaixo. */
export function TelaDeLeaderboard({ aoVoltar, carregar = carregarPadrao }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  // Entrar ou sair da conta muda a linha pessoal.
  const contaId = useConta().conta?.id ?? null;

  useEffect(() => {
    const controle = new AbortController();
    setEstado({ tipo: "carregando" });
    carregar(controle.signal)
      .then((ranking) => !controle.signal.aborted && setEstado({ tipo: "pronto", ranking }))
      .catch(() => !controle.signal.aborted && setEstado({ tipo: "erro" }));
    return () => controle.abort();
    // `carregar` só muda nos testes; o pedido se repete ao tentar de novo ou trocar de conta.
  }, [tentativa, contaId]);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] font-black tracking-[-0.02em]">Leaderboard</h1>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-2 placa p-4">
        {estado.tipo === "carregando" && <Loader2 aria-label="Carregando o leaderboard" className="m-auto size-6 animate-spin text-texto-suave" />}
        {estado.tipo === "erro" && (
          <div className="m-auto flex flex-col items-center gap-4 text-center">
            <p className="text-base text-texto-suave">Não deu para carregar o leaderboard agora.</p>
            <Button variant="outline" onClick={() => setTentativa((t) => t + 1)}>
              <RotateCcw className="opacity-70" /> Tentar de novo
            </Button>
          </div>
        )}
        {estado.tipo === "pronto" && <Conteudo ranking={estado.ranking} />}
      </div>
    </div>
  );
}

function Conteudo({ ranking: { top, meu, jogadores } }: { ranking: RespostaDoGeral }) {
  if (!top.length) {
    return <p className="m-auto text-base text-texto-suave">Ninguém ganhou XP ainda. Jogue uma música para abrir o placar!</p>;
  }
  return (
    <>
      <p className="px-2 text-base text-texto-suave">
        Os {formatar(top.length)} jogadores com mais XP, de {formatar(jogadores)} no total
      </p>
      <ol aria-label="Leaderboard" className="sem-barra-de-rolagem flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {top.map((linha) => (
          <Linha key={linha.posicao} linha={linha} minha={!!meu && meu.posicao === linha.posicao} />
        ))}
      </ol>
      {meu && meu.posicao > top.length && (
        <section aria-label="Sua posição" className="flex flex-col gap-1">
          <p className="px-2 text-base text-texto-suave">
            Sua posição (#{formatar(meu.posicao)} de {formatar(jogadores)})
          </p>
          <ol>
            <Linha linha={meu} minha />
          </ol>
        </section>
      )}
    </>
  );
}

function Linha({ linha, minha }: { linha: PosicaoNoGeral; minha: boolean }) {
  return (
    <LinhaComPosicao
      posicao={linha.posicao}
      nome={linha.nome}
      avatar={linha.avatar}
      minha={minha}
      detalhe={<span className="font-titulo text-destaque">Nv {linha.nivel.nivel}</span>}
      valor={`${formatar(linha.xp_total)} XP`}
    />
  );
}
