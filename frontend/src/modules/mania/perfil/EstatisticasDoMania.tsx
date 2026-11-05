import { sessaoDaConta } from "@/modules/conta";
import { useCarregamento } from "@/shared/hooks/useCarregamento";
import { porcentagem } from "@/shared/lib/formatar";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import { ComCarregamento } from "@/shared/ui/ComCarregamento";
import { NumeroDestacado } from "@/shared/ui/NumeroDestacado";
import { apiDoRanking, type EstatisticasDoMania as Estatisticas } from "../ranking/api";

interface Props {
  carregar?: (sinal: AbortSignal) => Promise<Estatisticas>;
}

const formatar = (n: number) => n.toLocaleString("pt-BR");
const JULGAMENTOS = ["MAX", "300", "200", "100", "50", "Miss"] as const;

const carregarPadrao = (sinal: AbortSignal) => apiDoRanking.estatisticas(sessaoDaConta.token() ?? "", sinal);

/** Os números do Mania no perfil, nos mesmos cartões dos números do Rock. */
export function EstatisticasDoMania({ carregar = carregarPadrao }: Props) {
  const { estado, tentarDeNovo } = useCarregamento(carregar);
  return (
    <ComCarregamento estado={estado} tentarDeNovo={tentarDeNovo} oQue="os números do Mania">
      {(e) => {
        const julgados = e.contagem.reduce((soma, n) => soma + n, 0);
        return (
          <>
            <section aria-label="Números do Mania" className="grid grid-cols-2 gap-4 max-md:gap-2 md:grid-cols-4">
              <NumeroDestacado rotulo="Partidas" valor={formatar(e.partidas)} detalhe={`${formatar(e.mapas)} ${e.mapas === 1 ? "mapa" : "mapas"}`} />
              <NumeroDestacado rotulo="Precisão" valor={porcentagem(e.precisao_media)} detalhe="média das partidas" />
              <NumeroDestacado rotulo="Maior combo" valor={formatar(e.maior_combo)} />
              <NumeroDestacado rotulo="No top 10" valor={formatar(e.no_top)} detalhe={`${formatar(e.ss)} SS · ${formatar(e.s)} S`} />
            </section>
            {e.partidas === 0 ? (
              <p className="placa p-6 text-center text-base text-texto-suave">Nenhuma partida no Mania ainda. Jogue um mapa ranked para começar a encher o perfil.</p>
            ) : (
              <section className="placa flex flex-col gap-4 p-6 max-md:gap-3 max-md:p-3">
                <h3 className="titulo-de-secao font-titulo tracking-wide">Julgamentos</h3>
                {JULGAMENTOS.map((nome, i) => (
                  <div key={nome} className="flex flex-col gap-2 max-md:gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-bold max-md:text-sm">{nome}</span>
                      <span className="text-sm text-texto-suave tabular-nums max-md:text-xs">{formatar(e.contagem[i])}</span>
                    </div>
                    <BarraDeProgresso fracao={julgados ? e.contagem[i] / julgados : 0} rotulo={`Julgamentos ${nome}`} className="h-1" />
                  </div>
                ))}
                <p className="text-sm text-texto-suave">{formatar(e.pontuacao_total)} pontos no total</p>
              </section>
            )}
          </>
        );
      }}
    </ComCarregamento>
  );
}
