import { ArrowLeft } from "lucide-react";
import { CapaPequena, DIFICULDADES, INSTRUMENTOS, nomeDaMusica } from "@/modules/rock/songs";
import { useCarregamento } from "@/shared/hooks/useCarregamento";
import { haQuantoTempo, porcentagem } from "@/shared/lib/formatar";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import { ComCarregamento } from "@/shared/ui/ComCarregamento";
import type { PerfilDaApi } from "./api";
import { FotoDaConta } from "./FotoDaConta";
import { SeloMod } from "@/shared/ui/SeloMod";
import { sessaoDaConta } from "./sessao";

interface Props {
  aoVoltar: () => void;
  /** O nome da música na biblioteca a partir do id do ranking. Música que não está aqui aparece pelo id. */
  tituloDaMusica: (id: string) => string | undefined;
  /** Mostra o selo Mod embaixo do nome. */
  mod?: boolean;
  carregar?: (sinal: AbortSignal) => Promise<PerfilDaApi>;
}

const formatar = (n: number) => n.toLocaleString("pt-BR");
const rotuloDa = (dificuldade: string) => DIFICULDADES.find((d) => d.id === dificuldade)?.rotulo ?? dificuldade;
const rotuloDoInstrumento = (instrumento: string) => INSTRUMENTOS.find((i) => i.id === instrumento)?.rotulo ?? instrumento;
const vezes = (n: number) => `${formatar(n)} ${n === 1 ? "vez" : "vezes"}`;
const mesEAno = (data: string) => new Date(data).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="chapa flex flex-col gap-1 bg-superficie p-4 max-md:gap-0.5 max-md:p-2">
      <span className="text-sm text-texto-suave max-md:text-xs">{rotulo}</span>
      <span className="font-titulo text-4xl leading-none tracking-wide max-md:text-xl">{valor}</span>
      {detalhe && <span className="text-sm text-texto-suave max-md:text-xs">{detalhe}</span>}
    </div>
  );
}

/** O perfil de quem está logado: nível, números das partidas, desempenho por dificuldade e as últimas jogadas. */
export function TelaDePerfil({ aoVoltar, tituloDaMusica, mod = false, carregar = (sinal) => sessaoDaConta.perfil(sinal) }: Props) {
  const { estado, tentarDeNovo } = useCarregamento(carregar);

  return (
    <div className="respiro-de-tela flex h-full flex-col">
      <header className="flex items-center gap-4 max-md:gap-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela">Perfil</h1>
      </header>

      <div className="sem-barra-de-rolagem rolagem-de-toque mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-4 max-md:gap-2">
        <ComCarregamento estado={estado} tentarDeNovo={tentarDeNovo} oQue="o perfil">
          {(perfil) => <Conteudo perfil={perfil} tituloDaMusica={tituloDaMusica} mod={mod} />}
        </ComCarregamento>
      </div>
    </div>
  );
}

function Conteudo({ perfil, tituloDaMusica, mod }: { perfil: PerfilDaApi; tituloDaMusica: Props["tituloDaMusica"]; mod: boolean }) {
  const { nivel, xp_no_nivel, xp_para_o_proximo } = perfil.nivel;
  const concluidas = perfil.partidas ? (perfil.partidas - perfil.derrotas) / perfil.partidas : 0;

  return (
    <>
      <section className="placa flex items-center gap-6 p-6 max-md:gap-3 max-md:p-3">
        <FotoDaConta avatar={perfil.avatar} className="size-20 max-md:size-14" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="truncate text-2xl leading-[1.1] font-bold max-md:text-lg">{perfil.nome}</h2>
          {mod && <SeloMod />}
          <p className="truncate text-base text-texto-suave max-md:whitespace-normal max-md:text-xs">
            {perfil.email && (
              <>
                <span className="max-md:block max-md:truncate">{perfil.email}</span>
                <span className="max-md:hidden"> · </span>
              </>
            )}
            <span className="max-md:block">Jogando desde {mesEAno(perfil.criada_em)}</span>
          </p>
          <div className="flex items-center gap-4 max-md:gap-2">
            <span className="font-titulo text-3xl leading-none text-destaque max-md:text-xl">Nv {nivel}</span>
            <BarraDeProgresso fracao={xp_no_nivel / xp_para_o_proximo} rotulo={`XP do nível ${nivel}`} className="flex-1" />
            <span className="text-sm whitespace-nowrap max-md:text-xs text-texto-suave tabular-nums">
              {formatar(xp_no_nivel)} / {formatar(xp_para_o_proximo)} XP
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 max-md:gap-2 md:grid-cols-4">
        <Numero rotulo="Partidas" valor={formatar(perfil.partidas)} detalhe={`${porcentagem(concluidas, 0)} concluídas`} />
        <Numero rotulo="Precisão" valor={porcentagem(perfil.precisao)} detalhe="de todas as notas" />
        <Numero rotulo="Melhor pontuação" valor={formatar(perfil.melhor_pontuacao)} />
        <Numero rotulo="Músicas tocadas" valor={formatar(perfil.musicas_distintas)} detalhe={`${formatar(perfil.xp_total)} XP no total`} />
      </section>

      {perfil.partidas === 0 ? (
        <p className="placa p-6 text-center text-base text-texto-suave">Nenhuma partida ainda. Jogue uma música para começar a encher o perfil.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 max-md:gap-2 md:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-4 max-md:gap-2 md:col-span-5">
            <section className="placa flex flex-col gap-4 p-6 max-md:gap-3 max-md:p-3">
              <h3 className="titulo-de-secao font-titulo tracking-wide">Por dificuldade</h3>
              {perfil.por_dificuldade.map((d) => (
                <div key={d.dificuldade} className={cn("flex flex-col gap-2 max-md:gap-1", d.partidas === 0 && "opacity-50")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-bold max-md:text-sm">{rotuloDa(d.dificuldade)}</span>
                    <span className="text-sm text-texto-suave tabular-nums max-md:text-xs">
                      {formatar(d.partidas)} {d.partidas === 1 ? "partida" : "partidas"}
                    </span>
                  </div>
                  <BarraDeProgresso fracao={d.precisao} rotulo={`Precisão no ${rotuloDa(d.dificuldade)}`} className="h-1" />
                  <div className="flex justify-between text-sm text-texto-suave tabular-nums max-md:text-xs">
                    <span>{porcentagem(d.precisao)}</span>
                    <span>Melhor {formatar(d.melhor_pontuacao)}</span>
                  </div>
                </div>
              ))}
            </section>

            {perfil.por_instrumento.length > 0 && (
              <section className="placa flex flex-col gap-4 p-6 max-md:gap-3 max-md:p-3">
                <h3 className="titulo-de-secao font-titulo tracking-wide">Por instrumento</h3>
                {perfil.por_instrumento.map((i) => (
                  <div key={i.instrumento} className="flex flex-col gap-2 max-md:gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-bold max-md:text-sm">{rotuloDoInstrumento(i.instrumento)}</span>
                      <span className="text-sm text-texto-suave tabular-nums max-md:text-xs">{porcentagem(i.partidas / perfil.partidas, 0)}</span>
                    </div>
                    <BarraDeProgresso fracao={i.partidas / perfil.partidas} rotulo={`Partidas de ${rotuloDoInstrumento(i.instrumento)}`} className="h-1" />
                  </div>
                ))}
              </section>
            )}

            {perfil.mais_tocadas.length > 0 && (
              <section className="placa flex flex-col gap-4 p-6 max-md:gap-3 max-md:p-3">
                <h3 className="titulo-de-secao font-titulo tracking-wide">Mais tocadas</h3>
                <ol className="flex flex-col gap-2">
                  {perfil.mais_tocadas.map((m, posicao) => (
                    <li key={m.musica_id} className="flex items-center gap-4 max-md:gap-2">
                      <span className="w-6 font-titulo text-2xl leading-none text-destaque max-md:w-4 max-md:text-lg">{posicao + 1}</span>
                      <CapaPequena capa={m.capa} />
                      <span className="min-w-0 flex-1 truncate text-base font-bold max-md:text-sm">{nomeDaMusica(m, tituloDaMusica)}</span>
                      <span className="text-sm whitespace-nowrap text-texto-suave tabular-nums">{vezes(m.partidas)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <section className="placa flex min-w-0 flex-col gap-2 p-6 max-md:p-3 md:col-span-7">
            <h3 className="mb-2 max-md:mb-1 titulo-de-secao font-titulo tracking-wide">Últimas partidas</h3>
            {perfil.recentes.map((p) => (
              <div key={`${p.musica_id}-${p.jogada_em}`} className="chapa flex items-center gap-4 bg-superficie px-4 py-2 max-md:gap-2 max-md:px-2">
                <CapaPequena capa={p.capa} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-bold max-md:text-sm">{nomeDaMusica(p, tituloDaMusica)}</span>
                  <span className="text-sm text-texto-suave max-md:text-xs">
                    {rotuloDa(p.dificuldade)} · {haQuantoTempo(p.jogada_em)}
                    {p.derrota && <span className="ml-2 text-perigo">Vaiada</span>}
                  </span>
                </div>
                <div className="flex flex-col items-end tabular-nums">
                  <span className="font-titulo text-xl leading-none max-md:text-base">{formatar(p.pontos)}</span>
                  <span className="text-sm text-texto-suave max-md:text-xs">{porcentagem(p.precisao)}</span>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
