import type { EstadoOnline, PessoaOnline } from "@/modules/presenca";
import type { PessoaDaAmizade } from "./api";

export type AmigoOnline = PessoaDaAmizade & { estado: EstadoOnline };

const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");
const vistoEm = (a: PessoaDaAmizade) => (a.visto_em ? Date.parse(a.visto_em) : 0);

/** Quem está na lista de presença fica online, com o que está fazendo; o resto, do visto há menos tempo para o mais antigo. */
export function separarPorPresenca(amigos: PessoaDaAmizade[], pessoas: PessoaOnline[]) {
  const estados = new Map(pessoas.map((p) => [p.id, p.estado]));
  const online: AmigoOnline[] = [];
  const offline: PessoaDaAmizade[] = [];
  for (const amigo of amigos) {
    const estado = estados.get(amigo.conta_id);
    if (estado) online.push({ ...amigo, estado });
    else offline.push(amigo);
  }
  return { online: online.sort(porNome), offline: offline.sort((a, b) => vistoEm(b) - vistoEm(a) || porNome(a, b)) };
}

const semAcento = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function filtrarPorNome<T extends { nome: string }>(lista: T[], busca: string): T[] {
  const termo = semAcento(busca);
  return termo ? lista.filter((p) => semAcento(p.nome).includes(termo)) : lista;
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function vistoHa(visto: string | null, agora: Date): string {
  if (!visto) return "Offline";
  const passou = Math.max(0, agora.getTime() - Date.parse(visto));
  if (passou < MINUTO) return "Visto agora";
  if (passou < HORA) return `Visto há ${Math.floor(passou / MINUTO)} min`;
  if (passou < DIA) return `Visto há ${plural(Math.floor(passou / HORA), "hora", "horas")}`;
  if (passou < 2 * DIA) return "Visto ontem";
  if (passou < 7 * DIA) return `Visto há ${Math.floor(passou / DIA)} dias`;
  if (passou < 60 * DIA) return `Visto há ${plural(Math.floor(passou / (7 * DIA)), "semana", "semanas")}`;
  return `Visto há ${Math.floor(passou / (30 * DIA))} meses`;
}

/** Convidar só faz sentido de uma sala online e para quem não está no meio de uma música. */
export const convitePodeSair = (codigoDaSala: string | undefined, estado: EstadoOnline) => !!codigoDaSala && estado.tipo !== "tocando";
