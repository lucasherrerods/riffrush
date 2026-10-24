import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { DIFICULDADES } from "@/modules/songs";
import { haQuantoTempo, porcentagem, precisaoDaPartida } from "@/shared/lib/formatar";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import type { PerfilDaApi } from "./api";
import { FotoDaConta } from "./FotoDaConta";
import { sessaoDaConta } from "./sessao";

interface Props {
  aoVoltar: () => void;
  /** O nome da música na biblioteca a partir do id do ranking. Música que não está aqui aparece pelo id. */
  tituloDaMusica: (id: string) => string | undefined;
  carregar?: (sinal: AbortSignal) => Promise<PerfilDaApi>;
}

type Estado = { tipo: "carregando" } | { tipo: "pronto"; perfil: PerfilDaApi } | { tipo: "erro" };

const formatar = (n: number) => n.toLocaleString("pt-BR");
const rotuloDa = (dificuldade: string) => DIFICULDADES.find((d) => d.id === dificuldade)?.rotulo ?? dificuldade;
const mesEAno = (data: string) => new Date(data).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="chapa flex flex-col gap-1 bg-superficie p-4">
      <span className="text-sm text-texto-suave">{rotulo}</span>
      <span className="font-titulo text-4xl leading-none tracking-wide">{valor}</span>
      {detalhe && <span className="text-sm text-texto-suave">{detalhe}</span>}
    </div>
  );
}

/** O perfil de quem está logado: nível, números das partidas, desempenho por dificuldade e as últimas jogadas. */
export function TelaDePerfil({ aoVoltar, tituloDaMusica, carregar = (sinal) => sessaoDaConta.perfil(sinal) }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const tentarDeNovo = useCallback(() => setTentativa((t) => t + 1), []);

  useEffect(() => {
    const controle = new AbortController();
    setEstado({ tipo: "carregando" });
    carregar(controle.signal)
      .then((perfil) => !controle.signal.aborted && setEstado({ tipo: "pronto", perfil }))
      .catch(() => !controle.signal.aborted && setEstado({ tipo: "erro" }));
    return () => controle.abort();
    // `carregar` muda a cada render quando vem do padrão; só a tentativa pede de novo.
  }, [tentativa]);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] font-black tracking-[-0.02em]">Perfil</h1>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-4 overflow-y-auto">
        {estado.tipo === "carregando" && <Loader2 aria-label="Carregando o perfil" className="m-auto size-6 animate-spin text-texto-suave" />}
        {estado.tipo === "erro" && (
          <div className="m-auto flex flex-col items-center gap-4 text-center">
            <p className="text-base text-texto-suave">Não deu para carregar o perfil agora.</p>
            <Button variant="outline" onClick={tentarDeNovo}>
              <RotateCcw className="opacity-70" /> Tentar de novo
            </Button>
          </div>
        )}
        {estado.tipo === "pronto" && <Conteudo perfil={estado.perfil} tituloDaMusica={tituloDaMusica} />}
      </div>
    </div>
  );
}

function Conteudo({ perfil, tituloDaMusica }: { perfil: PerfilDaApi; tituloDaMusica: Props["tituloDaMusica"] }) {
  const { nivel, xp_no_nivel, xp_para_o_proximo } = perfil.nivel;
  const concluidas = perfil.partidas - perfil.derrotas;

  return (
    <>
      <section className="placa flex items-center gap-6 p-6">
        <FotoDaConta avatar={perfil.avatar} className="size-20" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="truncate text-2xl leading-[1.1] font-bold">{perfil.nome}</h2>
          <p className="text-base text-texto-suave">Jogando desde {mesEAno(perfil.criada_em)}</p>
          <div className="flex items-center gap-4">
            <span className="font-titulo text-3xl leading-none text-destaque">Nv {nivel}</span>
            <BarraDeProgresso fracao={xp_no_nivel / xp_para_o_proximo} rotulo={`XP do nível ${nivel}`} className="flex-1" />
            <span className="text-sm whitespace-nowrap text-texto-suave tabular-nums">
              {formatar(xp_no_nivel)} / {formatar(xp_para_o_proximo)} XP
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Numero rotulo="Partidas" valor={formatar(perfil.partidas)} detalhe={`${formatar(concluidas)} até o fim`} />
        <Numero rotulo="Precisão" valor={porcentagem(perfil.precisao)} detalhe="de todas as notas" />
        <Numero rotulo="Melhor pontuação" valor={formatar(perfil.melhor_pontuacao)} />
        <Numero rotulo="Músicas tocadas" valor={formatar(perfil.musicas_distintas)} detalhe={`${formatar(perfil.xp_total)} XP no total`} />
      </section>

      {perfil.partidas === 0 ? (
        <p className="placa p-6 text-center text-base text-texto-suave">Nenhuma partida ainda. Jogue uma música para começar a encher o perfil.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-12">
          <section className="placa flex flex-col gap-4 p-6 md:col-span-5">
            <h3 className="font-titulo text-2xl leading-none tracking-wide">Por dificuldade</h3>
            {perfil.por_dificuldade.map((d) => (
              <div key={d.dificuldade} className={cn("flex flex-col gap-2", d.partidas === 0 && "opacity-50")}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-bold">{rotuloDa(d.dificuldade)}</span>
                  <span className="text-sm text-texto-suave tabular-nums">
                    {formatar(d.partidas)} {d.partidas === 1 ? "partida" : "partidas"}
                  </span>
                </div>
                <BarraDeProgresso fracao={d.precisao} rotulo={`Precisão no ${rotuloDa(d.dificuldade)}`} className="h-1" />
                <div className="flex justify-between text-sm text-texto-suave tabular-nums">
                  <span>{porcentagem(d.precisao)}</span>
                  <span>Melhor {formatar(d.melhor_pontuacao)}</span>
                </div>
              </div>
            ))}
          </section>

          <section className="placa flex flex-col gap-2 p-6 md:col-span-7">
            <h3 className="mb-2 font-titulo text-2xl leading-none tracking-wide">Últimas partidas</h3>
            {perfil.recentes.map((p) => (
              <div key={`${p.musica_id}-${p.jogada_em}`} className="chapa flex items-center gap-4 bg-superficie px-4 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-bold">{tituloDaMusica(p.musica_id) ?? p.musica_id}</span>
                  <span className="text-sm text-texto-suave">
                    {rotuloDa(p.dificuldade)} · {haQuantoTempo(p.jogada_em)}
                    {p.derrota && <span className="ml-2 text-perigo">Vaiada</span>}
                  </span>
                </div>
                <div className="flex flex-col items-end tabular-nums">
                  <span className="font-titulo text-xl leading-none">{formatar(p.pontos)}</span>
                  <span className="text-sm text-texto-suave">{precisaoDaPartida(p.acertos, p.total)}</span>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
