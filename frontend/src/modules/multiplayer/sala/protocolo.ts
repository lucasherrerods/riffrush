import { BALDE_CHEIO, adicionarMensagem, gastarDoBalde, limparTexto, type Balde } from "@/modules/chat";

/*
 * A sala em rede como função pura: recebe o estado e uma mensagem, devolve o estado novo
 * e o que precisa ser enviado. O servidor só repassa; quem manda é o cliente do host.
 * Cada modo diz o que o host escolhe (a música do Rock, o mapa do Mania) e como isso viaja.
 */

export const MAXIMO_DE_JOGADORES = 4;
/** Tempo entre o "começar" e a música: dá para todo mundo carregar e largar junto. */
export const ATRASO_DO_INICIO_MS = 5000;
/** O servidor usa o id 0 para as mensagens dele. */
const SERVIDOR = 0;

/** O mínimo que todo jogador tem na sala. Cada modo junta o resto (o personagem do Rock, por exemplo). */
export interface PerfilNaSala {
  nome: string;
  /** O nível da conta, quando o jogador está logado. */
  nivel?: number;
}

/** O mínimo do placar ao vivo de cada jogador. */
export interface JogadaNaSala {
  pontos: number;
  terminou: boolean;
  derrota?: boolean;
}

/**
 * O que muda de um modo para outro. A escolha viaja espalhada nas mensagens "sala" e "comecar",
 * para o Rock continuar falando com as versões antigas do jogo.
 */
export interface ModoDaSala<Escolha, NaRede> {
  /** Como o modo aparece nos avisos. */
  nome: string;
  escolhaInicial: Escolha;
  /** O que o convidado precisa ter para dar pronto (a música, o mapa). */
  idDaEscolha: (escolha: Escolha) => string;
  escreverEscolha: (escolha: Escolha) => NaRede;
  /** Null quando a mensagem é de outro modo ou veio estragada. */
  lerEscolha: (naRede: NaRede) => Escolha | null;
}

export interface Jogador<P extends PerfilNaSala = PerfilNaSala> {
  id: number;
  personagem: P;
}

export type MensagemDaSalaEmRede<NaRede, P extends PerfilNaSala, J extends JogadaNaSala> =
  | { tipo: "bemVindo"; id: number; /** Só no online: o código para os amigos entrarem. */ codigo?: string }
  | { tipo: "cheia" }
  | { tipo: "semSala" }
  | { tipo: "saiu" }
  | { tipo: "oi"; personagem: P }
  /** O host tirou o jogador `id` da sala. */
  | { tipo: "expulsar"; id: number }
  /** O host passou a liderança para o jogador `id` (só no online). Os expulsos continuam de fora. */
  | { tipo: "transferirHost"; id: number; expulsos: number[] }
  | ({ tipo: "sala"; jogadores: Jogador<P>[]; prontos: number[] } & NaRede)
  /** O convidado já tem a escolha `musicaId` e está (ou deixou de estar) pronto para começar. */
  | { tipo: "pronto"; musicaId: string; pronto: boolean }
  /** `rodada` junta as partidas desta largada, para o ranking contar uma vez só. Versões antigas não mandam. */
  | ({ tipo: "comecar"; rodada?: string } & NaRede)
  | ({ tipo: "estado" } & J)
  | { tipo: "chat"; texto: string };

export interface MensagemDoChatDaSala {
  /** Ordem de chegada, para a tela. */
  n: number;
  de: number;
  autor: string;
  texto: string;
  /** Hora de chegada neste aparelho, em ms desde 1970. */
  em: number;
}

export interface EstadoBaseDaSala<P extends PerfilNaSala, J extends JogadaNaSala> {
  status: "conectando" | "naSala" | "jogando";
  souHost: boolean;
  meuId: number;
  hostId: number;
  personagem: P;
  jogadores: Jogador<P>[];
  /** Só no host: quem foi expulso não entra de novo nesta sala. */
  expulsos: number[];
  /** Convidados prontos para a escolha atual. O host mantém a lista e manda para todos. */
  prontos: number[];
  adversarios: Record<number, J>;
  /** Conta quantas partidas começaram: a tela de jogo abre a cada aumento. */
  partidas: number;
  /** Instante (performance.now) em que a música começa para todos. */
  inicio: number;
  /** A largada atual, que cada jogador manda junto com a partida. */
  rodada?: string;
  chat: MensagemDoChatDaSala[];
  /** O limite do chat de cada jogador, contado por quem recebe: um cliente modificado não inunda a sala. */
  baldesDoChat: Record<number, Balde>;
}

/** A escolha do host fica espalhada no estado, ao lado dos campos da sala. */
export type EstadoDaSalaEmRede<Escolha, P extends PerfilNaSala, J extends JogadaNaSala> = EstadoBaseDaSala<P, J> & Escolha;

export interface ReacaoDaSala<E, M> {
  estado: E;
  enviar: M[];
  /** Quando existe, a sala acabou para este jogador, com esse aviso. */
  sair?: string;
}

/** O nível vem do cliente de cada um: só um número de verdade aparece no lobby. */
const NIVEL_MAXIMO = 9999;
function limparNivel<P extends PerfilNaSala>(personagem: P): P {
  const { nivel, ...resto } = personagem;
  return (Number.isInteger(nivel) && nivel! >= 1 && nivel! <= NIVEL_MAXIMO ? { ...resto, nivel } : resto) as P;
}

/** O nome é livre: repetido, ganha um número, para ninguém se passar por outro na sala e no chat. */
function nomeUnico(nome: string, outros: Jogador[]): string {
  const base = String(nome ?? "").trim() || "Jogador";
  const usados = new Set(outros.map((j) => j.personagem.nome.trim().toLowerCase()));
  if (!usados.has(base.toLowerCase())) return base;
  let n = 2;
  while (usados.has(`${base} (${n})`.toLowerCase())) n++;
  return `${base} (${n})`;
}

const ID_DA_RODADA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OUTRO_MODO = "Esta sala é de outro modo do jogo. Troque de modo para entrar.";

/** Todos os convidados já têm a escolha e deram pronto. O host não precisa: ele dá a largada. */
export const todosProntos = (estado: { jogadores: Jogador[]; hostId: number; prontos: number[] }) =>
  estado.jogadores.every((j) => j.id === estado.hostId || estado.prontos.includes(j.id));

/** Monta as regras da sala para um modo. */
export function criarProtocolo<Escolha extends object, NaRede extends object, P extends PerfilNaSala, J extends JogadaNaSala>(modo: ModoDaSala<Escolha, NaRede>) {
  type Estado = EstadoDaSalaEmRede<Escolha, P, J>;
  type Mensagem = MensagemDaSalaEmRede<NaRede, P, J>;
  type Reacao = ReacaoDaSala<Estado, Mensagem>;

  const escolhaDe = (estado: Estado): Escolha => {
    const escolha: Record<string, unknown> = {};
    for (const chave of Object.keys(modo.escolhaInicial)) escolha[chave] = (estado as Record<string, unknown>)[chave];
    return escolha as Escolha;
  };

  const mensagemDaSala = (estado: Estado): Mensagem => ({ tipo: "sala", jogadores: estado.jogadores, prontos: estado.prontos, ...modo.escreverEscolha(escolhaDe(estado)) }) as Mensagem;

  function estadoInicial(personagem: P, souHost: boolean): Estado {
    return {
      status: "conectando",
      souHost,
      meuId: 0,
      hostId: 0,
      personagem,
      jogadores: [],
      expulsos: [],
      prontos: [],
      adversarios: {},
      partidas: 0,
      inicio: 0,
      chat: [],
      baldesDoChat: {},
      ...modo.escolhaInicial,
    } as Estado;
  }

  /** Atualiza a sala com uma mensagem recebida de `de`. `agora` é o performance.now() da chegada. */
  function reduzir(estado: Estado, de: number, mensagem: Mensagem, agora: number, horario = Date.now()): Reacao {
    const nada = { estado, enviar: [] };
    switch (mensagem.tipo) {
      case "bemVindo":
        return {
          estado: { ...estado, status: "naSala", meuId: mensagem.id, hostId: estado.souHost ? mensagem.id : estado.hostId },
          enviar: [{ tipo: "oi", personagem: estado.personagem }],
        };
      case "cheia":
        return { ...nada, sair: `A sala já tem ${MAXIMO_DE_JOGADORES} jogadores.` };
      case "semSala":
        return { ...nada, sair: "Sala não encontrada. Confira o código ou peça um novo ao host." };
      case "oi": {
        if (!estado.souHost || estado.expulsos.includes(de)) return nada;
        const outros = estado.jogadores.filter((j) => j.id !== de);
        const personagem = { ...limparNivel(mensagem.personagem), nome: nomeUnico(mensagem.personagem.nome, outros) };
        const jogadores = [...outros, { id: de, personagem }].sort((a, b) => a.id - b.id);
        const novo = { ...estado, jogadores };
        return { estado: novo, enviar: [mensagemDaSala(novo)] };
      }
      case "saiu": {
        if (de === estado.hostId && !estado.souHost) return { ...nada, sair: "O host fechou a sala." };
        const novo = { ...estado, jogadores: estado.jogadores.filter((j) => j.id !== de), prontos: estado.prontos.filter((id) => id !== de) };
        return { estado: novo, enviar: estado.souHost ? [mensagemDaSala(novo)] : [] };
      }
      case "sala": {
        if (estado.souHost) return nada;
        const { tipo: _, jogadores, prontos, ...naRede } = mensagem;
        const escolha = modo.lerEscolha(naRede as unknown as NaRede);
        if (!escolha) return { ...nada, sair: OUTRO_MODO };
        return { estado: { ...estado, ...escolha, hostId: de, jogadores, prontos: prontos ?? [] }, enviar: [] };
      }
      case "pronto": {
        if (!estado.souHost || mensagem.musicaId !== modo.idDaEscolha(escolhaDe(estado))) return nada;
        const outros = estado.prontos.filter((id) => id !== de);
        const novo = { ...estado, prontos: mensagem.pronto ? [...outros, de].sort((a, b) => a - b) : outros };
        return { estado: novo, enviar: [mensagemDaSala(novo)] };
      }
      case "comecar": {
        const { tipo: _, rodada, ...naRede } = mensagem;
        const escolha = modo.lerEscolha(naRede as unknown as NaRede);
        if (!escolha) return { ...nada, sair: OUTRO_MODO };
        return {
          estado: {
            ...estado,
            ...escolha,
            status: "jogando",
            prontos: [],
            adversarios: {},
            partidas: estado.partidas + 1,
            inicio: agora + ATRASO_DO_INICIO_MS,
            // A API recusaria a partida com um id malformado: um host modificado não tira o XP de ninguém.
            rodada: typeof rodada === "string" && ID_DA_RODADA.test(rodada) ? rodada : undefined,
          },
          enviar: [],
        };
      }
      case "expulsar":
        if (estado.souHost || de !== estado.hostId || mensagem.id !== estado.meuId) return nada;
        return { ...nada, sair: "O host tirou você da sala." };
      case "transferirHost": {
        if (de !== estado.hostId || estado.souHost) return nada;
        if (mensagem.id !== estado.meuId) return { estado: { ...estado, hostId: mensagem.id }, enviar: [] };
        // O antigo host vira convidado e também precisa dar pronto: a lista começa de novo.
        const novo = { ...estado, souHost: true, hostId: estado.meuId, expulsos: mensagem.expulsos.filter(Number.isInteger), prontos: [] };
        return { estado: novo, enviar: [mensagemDaSala(novo)] };
      }
      case "estado": {
        if (de === estado.meuId || de === SERVIDOR) return nada;
        const { tipo: _, ...jogada } = mensagem;
        return { estado: { ...estado, adversarios: { ...estado.adversarios, [de]: jogada as unknown as J } }, enviar: [] };
      }
      case "chat": {
        // O "de" vem do servidor, então ninguém fala pelo outro; só vale quem está na sala.
        const autor = estado.jogadores.find((j) => j.id === de)?.personagem.nome;
        const texto = limparTexto(mensagem.texto);
        if (!autor || !texto) return nada;
        const limite = gastarDoBalde(estado.baldesDoChat[de] ?? BALDE_CHEIO, agora);
        const baldesDoChat = { ...estado.baldesDoChat, [de]: limite.balde };
        if (!limite.passa) return { estado: { ...estado, baldesDoChat }, enviar: [] };
        const n = (estado.chat.at(-1)?.n ?? 0) + 1;
        return { estado: { ...estado, baldesDoChat, chat: adicionarMensagem(estado.chat, { n, de, autor, texto, em: horario }) }, enviar: [] };
      }
    }
  }

  /** Só o host: troca a escolha da sala. Escolha nova pede o pronto de todos de novo. */
  function escolher(estado: Estado, escolha: Escolha): Reacao {
    if (!estado.souHost) return { estado, enviar: [] };
    const prontos = modo.idDaEscolha(escolha) === modo.idDaEscolha(escolhaDe(estado)) ? estado.prontos : [];
    const novo = { ...estado, ...escolha, prontos };
    return { estado: novo, enviar: [mensagemDaSala(novo)] };
  }

  /** Só o host: tira um convidado da sala. Ele recebe o aviso e sai; se insistir, o host o ignora. */
  function expulsarJogador(estado: Estado, id: number): Reacao {
    if (!estado.souHost || id === estado.hostId || !estado.jogadores.some((j) => j.id === id)) return { estado, enviar: [] };
    const novo = {
      ...estado,
      jogadores: estado.jogadores.filter((j) => j.id !== id),
      prontos: estado.prontos.filter((p) => p !== id),
      expulsos: [...estado.expulsos, id],
    };
    return { estado: novo, enviar: [{ tipo: "expulsar", id }, mensagemDaSala(novo)] };
  }

  /** Só o host, no lobby: passa a liderança para outro jogador da sala e vira convidado. */
  function transferirHost(estado: Estado, id: number): Reacao {
    if (!estado.souHost || estado.status !== "naSala" || id === estado.meuId || !estado.jogadores.some((j) => j.id === id)) return { estado, enviar: [] };
    return { estado: { ...estado, souHost: false, hostId: id, prontos: [] }, enviar: [{ tipo: "transferirHost", id, expulsos: estado.expulsos }] };
  }

  function comecarPartida(estado: Estado, rodada: string = crypto.randomUUID()): Mensagem[] {
    return estado.souHost && todosProntos(estado) ? [{ tipo: "comecar", ...modo.escreverEscolha(escolhaDe(estado)), rodada } as Mensagem] : [];
  }

  return { modo, estadoInicial, reduzir, escolher, escolhaDe, expulsarJogador, transferirHost, todosProntos, comecarPartida };
}

export type ProtocoloDaSala<Escolha extends object, NaRede extends object, P extends PerfilNaSala, J extends JogadaNaSala> = ReturnType<typeof criarProtocolo<Escolha, NaRede, P, J>>;
