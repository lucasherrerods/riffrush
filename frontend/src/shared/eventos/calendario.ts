
export interface DiaDoAno {
  /** 1 a 12. */
  mes: number;
  dia: number;
}

/** Período que se repete todo ano. Se o fim vem antes do início, ele atravessa a virada do ano. */
export interface Periodo {
  inicio: DiaDoAno;
  fim: DiaDoAno;
}

/**
 * Uma versão de evento do Riff Rush: liga a decoração dela por cima das telas.
 * Para criar um evento novo, registre-o em EVENTOS e a decoração em DecoracaoDoEvento.
 */
export interface Evento {
  id: "natal";
  nome: string;
  periodo: Periodo;
}

export const EVENTOS: Evento[] = [
  {
    id: "natal",
    nome: "Natal",
    periodo: { inicio: { mes: 11, dia: 1 }, fim: { mes: 1, dia: 1 } },
  },
];

const numero = ({ mes, dia }: DiaDoAno) => mes * 100 + dia;

export function estaNoPeriodo(data: Date, { inicio, fim }: Periodo) {
  const hoje = numero({ mes: data.getMonth() + 1, dia: data.getDate() });
  const [de, ate] = [numero(inicio), numero(fim)];
  return de <= ate ? hoje >= de && hoje <= ate : hoje >= de || hoje <= ate;
}

export const eventoDoDia = (data: Date, eventos = EVENTOS) => eventos.find((evento) => estaNoPeriodo(data, evento.periodo));

/** O pedido vem de fora (`?evento=natal` na URL): força um evento para ver o visual ou desliga com "nenhum". */
export function escolherEvento(data: Date, pedido: string | null, eventos = EVENTOS): Evento | undefined {
  if (pedido === "nenhum") return undefined;
  return eventos.find((evento) => evento.id === pedido) ?? eventoDoDia(data, eventos);
}
