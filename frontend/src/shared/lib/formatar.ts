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

/** De 0 a 1 para "87,65%" (ou "88%" com `casas` = 0). */
export function porcentagem(fracao: number, casas = 2) {
  return `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Minutos e segundos: "4:23". Vazio sem duração. */
export function formatarDuracao(ms: number): string {
  if (ms <= 0) return "";
  const segundos = Math.floor(ms / 1000);
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}
