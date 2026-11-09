import { SeloDaNota } from "@/shared/ui/SeloDaNota";

export interface Numero {
  rotulo: string;
  valor: React.ReactNode;
  /** Nome acessível do valor, quando ele não se lê sozinho (ex.: a contagem animada dos pontos). */
  rotuloDoValor?: string;
}

interface Props {
  titulo: string;
  subtitulo: React.ReactNode;
  precisao: number;
  /** Logo abaixo do subtítulo (ex.: de quem é a partida). */
  autor?: React.ReactNode;
  /** Abaixo do cabeçalho: estrelas, selos de recorde, aviso de derrota. */
  destaques?: React.ReactNode;
  numeros: Numero[];
  julgamentos?: Numero[];
  /** Depois dos números (ex.: XP ganho, placar da sala). */
  extra?: React.ReactNode;
  botoes: React.ReactNode;
}

/** O resultado da partida nos dois modos: um cartão com a nota, os números e as ações. */
export function CartaoDeResultado({ titulo, subtitulo, precisao, autor, destaques, numeros, julgamentos, extra, botoes }: Props) {
  return (
    // Com a sala cheia o placar não cabe: a tela rola e os botões ficam presos embaixo, sem fundo, para não esconder nada.
    <main className="flex h-full overflow-y-auto p-6 text-texto max-md:p-4">
      <section className="m-auto flex w-full max-w-xl flex-col gap-6 rounded-lg border border-borda bg-superficie p-8 max-md:gap-4 max-md:p-4">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-titulo text-4xl tracking-wide max-md:text-3xl">{titulo}</h1>
            <p className="text-texto-suave">{subtitulo}</p>
            {autor}
          </div>
          <SeloDaNota precisao={precisao} className="text-6xl" />
        </header>
        {destaques}
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-4">
          {numeros.map((n) => (
            <div key={n.rotulo}>
              <dt className="text-texto-suave">{n.rotulo}</dt>
              <dd aria-label={n.rotuloDoValor} className="font-titulo text-3xl tabular-nums">
                {n.valor}
              </dd>
            </div>
          ))}
        </dl>
        {julgamentos && (
          <dl aria-label="Julgamentos" className="grid auto-cols-fr grid-flow-col gap-2 text-center">
            {julgamentos.map((j) => (
              <div key={j.rotulo} className="rounded-md bg-superficie-elevada py-2">
                <dt className="text-sm text-texto-suave">{j.rotulo}</dt>
                <dd className="font-titulo text-2xl tabular-nums">{j.valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {extra}
        <div className="pointer-events-none sticky bottom-0 flex flex-wrap justify-end gap-4 [&>*]:pointer-events-auto">{botoes}</div>
      </section>
    </main>
  );
}
