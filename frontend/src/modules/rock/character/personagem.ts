import {
  AJUSTES_DO_CORPO,
  BASES,
  EXPRESSOES,
  INSTRUMENTOS,
  PALETAS,
  PARTES_COLORIVEIS,
  PECAS,
  type Expressao,
  type Instrumento,
  type Opcao,
  type ParteColorivel,
} from "./catalogo";

export interface Personagem {
  versao: 3;
  nome: string;
  /** Id do modelo .vrm em BASES. */
  base: string;
  instrumento: Instrumento;
  corpo: Record<(typeof AJUSTES_DO_CORPO)[number]["id"], number>;
  expressao: Expressao;
  /** null mantém a cor original da textura do modelo. */
  cores: Record<ParteColorivel, string | null>;
  /** Ids de peças extras vestidas por cima da base. */
  pecas: string[];
}

const SEM_CORES = Object.fromEntries(PARTES_COLORIVEIS.map((p) => [p.id, null])) as Personagem["cores"];

export const PERSONAGEM_PADRAO: Personagem = {
  versao: 3,
  nome: "Rockstar",
  base: BASES[0].id,
  instrumento: "guitarra",
  corpo: { altura: 0.5, porte: 0.5, ombros: 0.5 },
  expressao: "confiante",
  cores: SEM_CORES,
  pecas: [],
};

const objeto = (valor: unknown): Record<string, unknown> => (valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {});
const ehCor = (valor: unknown): valor is string => typeof valor === "string" && /^#[0-9a-f]{6}$/i.test(valor);
const opcao = <T extends string>(valor: unknown, opcoes: Opcao<T>[], padrao: T) => opcoes.find((o) => o.id === valor)?.id ?? padrao;

function ajustes(valor: unknown) {
  const dados = objeto(valor);
  const resultado = { ...PERSONAGEM_PADRAO.corpo };
  for (const { id } of AJUSTES_DO_CORPO) {
    const numero = dados[id];
    if (typeof numero === "number" && Number.isFinite(numero)) resultado[id] = Math.min(1, Math.max(0, numero));
  }
  return resultado;
}

/** Cores salvas em versões antigas, já no formato atual. */
function coresAntigas(d: Record<string, unknown>): Record<string, unknown> {
  if (d.versao === undefined) return { pele: d.pele, cabelo: d.corDoCabelo };
  return objeto(d.cores);
}

/**
 * Normaliza qualquer dado recebido (armazenamento local ou rede) para a versão atual.
 * Chibis (v1) e bonecos procedurais (v2) aproveitam nome, instrumento, corpo e cores.
 */
export function migrarPersonagem(dado: unknown): Personagem {
  const d = objeto(dado);
  const p = PERSONAGEM_PADRAO;
  const cores = coresAntigas(d);
  return {
    versao: 3,
    nome: typeof d.nome === "string" && d.nome.trim() ? d.nome.slice(0, 16) : p.nome,
    base: opcao(d.base, BASES, p.base),
    instrumento: opcao(d.instrumento, INSTRUMENTOS, p.instrumento),
    corpo: ajustes(d.corpo),
    expressao: opcao(d.expressao, EXPRESSOES, p.expressao),
    cores: Object.fromEntries(PARTES_COLORIVEIS.map(({ id }) => [id, ehCor(cores[id]) ? cores[id] : null])) as Personagem["cores"],
    pecas: Array.isArray(d.pecas) ? d.pecas.filter((id) => PECAS.some((peca) => peca.id === id)) : [],
  };
}

const CHAVE = "riffrush.personagem";

export function carregarPersonagem(): Personagem {
  try {
    const salvo = localStorage.getItem(CHAVE);
    return salvo ? migrarPersonagem(JSON.parse(salvo)) : PERSONAGEM_PADRAO;
  } catch {
    return PERSONAGEM_PADRAO;
  }
}

export function salvarPersonagem(personagem: Personagem) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(personagem));
  } catch {
    // Sem armazenamento: o personagem vale só até fechar o jogo.
  }
}

export function personagemAleatorio(nome: string, aleatorio: () => number = Math.random): Personagem {
  const sortear = <T,>(lista: readonly T[]) => lista[Math.floor(aleatorio() * lista.length)];
  return {
    versao: 3,
    nome,
    base: sortear(BASES).id,
    instrumento: sortear(INSTRUMENTOS).id,
    corpo: Object.fromEntries(AJUSTES_DO_CORPO.map(({ id }) => [id, Math.round(aleatorio() * 100) / 100])) as Personagem["corpo"],
    expressao: sortear(EXPRESSOES).id,
    // Metade das vezes mantém a cor original do modelo.
    cores: Object.fromEntries(PARTES_COLORIVEIS.map(({ id }) => [id, aleatorio() < 0.5 ? null : sortear(PALETAS[id])])) as Personagem["cores"],
    pecas: [],
  };
}
