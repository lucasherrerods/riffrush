import type { Modo } from "@/shared/modo";
import { porcentagem } from "@/shared/lib/formatar";
import type { Atividade, EventoDaAtividade } from "./api";

const INSTRUMENTOS: Record<string, string> = { guitarra: "Guitarra", baixo: "Baixo", ritmica: "Rítmica", coop: "Co-op", teclado: "Teclado" };
const DIFICULDADES: Record<string, string> = { facil: "Fácil", medio: "Médio", dificil: "Difícil", expert: "Expert" };

/** Nomes que o app conhece pela biblioteca, para quando a API ainda não tem o da música ou do mapa. */
export interface NomesLocais {
  tituloDaMusica?: (musicaId: string) => string | undefined;
  nomeDoMapa?: (beatmapId: number) => string | undefined;
}

export interface Descricao {
  modo?: Modo;
  /** O verbo, depois do nome de quem fez. */
  acao: string;
  oQue?: string;
  detalhe?: string;
}

const juntar = (...partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(" · ");
const comArtista = (titulo: string, artista: string | null) => (artista ? `${titulo} — ${artista}` : titulo);

export function descreverAtividade(evento: EventoDaAtividade, nomes: NomesLocais = {}): Descricao {
  switch (evento.tipo) {
    case "partida_do_rock":
      return {
        modo: "rock",
        acao: evento.derrota ? "falhou em" : "jogou",
        oQue: evento.titulo ? comArtista(evento.titulo, evento.artista) : (nomes.tituloDaMusica?.(evento.musica_id) ?? "uma música"),
        detalhe: juntar(INSTRUMENTOS[evento.instrumento] ?? evento.instrumento, DIFICULDADES[evento.dificuldade] ?? evento.dificuldade, evento.precisao !== null && porcentagem(evento.precisao)),
      };
    case "partida_do_mania":
      return {
        modo: "mania",
        acao: evento.derrota ? "falhou em" : "jogou",
        oQue: evento.titulo ? comArtista(evento.titulo, evento.artista) : (nomes.nomeDoMapa?.(evento.beatmap_id) ?? `o mapa ${evento.beatmap_id}`),
        detalhe: juntar(evento.dificuldade, porcentagem(evento.precisao)),
      };
    case "conta_nova":
      return { acao: "entrou no Riff Rush" };
  }
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** "14:05" se foi hoje; "10/11 22:30" se foi antes. */
export function horaDaAtividade(quando: string, agora = new Date()) {
  const data = new Date(quando);
  const hora = `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
  return data.toDateString() === agora.toDateString() ? hora : `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)} ${hora}`;
}

const chave = (a: Atividade) => `${a.conta_id}|${a.quando}|${a.evento.tipo}`;

/** As recém-chegadas no topo, sem repetir as que a lista já tem. */
export function juntarSemRepetir(novas: Atividade[], atuais: Atividade[]): Atividade[] {
  const vistas = new Set(atuais.map(chave));
  return [...novas.filter((a) => !vistas.has(chave(a))), ...atuais];
}
