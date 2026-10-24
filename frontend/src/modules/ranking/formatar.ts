const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
const MES = 30 * DIA;
const ANO = 365 * DIA;

/** Curto, para caber na linha do ranking: "há 5 h", "há 3 meses". */
export function haQuantoTempo(data: string, agora = new Date()) {
  const passou = agora.getTime() - new Date(data).getTime();
  if (passou < MINUTO) return "agora";
  if (passou < HORA) return `há ${Math.floor(passou / MINUTO)} min`;
  if (passou < DIA) return `há ${Math.floor(passou / HORA)} h`;
  if (passou < MES) return `há ${Math.floor(passou / DIA)} d`;
  if (passou < ANO) {
    const meses = Math.floor(passou / MES);
    return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  }
  const anos = Math.floor(passou / ANO);
  return `há ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

export function precisaoDaPartida(acertos: number, total: number) {
  const fracao = total ? acertos / total : 0;
  return `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
