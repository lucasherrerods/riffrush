import {
  ACESSORIOS,
  AJUSTES_DO_CORPO,
  AJUSTES_DO_ROSTO,
  BARBAS,
  CABELOS,
  CORES_DE_CABELO,
  CORES_DE_DETALHE,
  CORES_DE_ROUPA,
  CORES_DOS_OLHOS,
  INSTRUMENTOS,
  ROUPAS,
  TONS_DE_PELE,
  type Acessorio,
  type Barba,
  type Cabelo,
  type Instrumento,
  type Opcao,
  type Roupa,
} from "./catalogo";

type Ajustes<T extends readonly { id: string }[]> = Record<T[number]["id"], number>;

export interface Personagem {
  versao: 2;
  nome: string;
  instrumento: Instrumento;
  corpo: Ajustes<typeof AJUSTES_DO_CORPO>;
  rosto: Ajustes<typeof AJUSTES_DO_ROSTO>;
  cabelo: Cabelo;
  barba: Barba;
  roupa: Roupa;
  acessorio: Acessorio;
  cores: { pele: string; cabelo: string; olhos: string; roupa: string; detalhe: string };
}

export const PERSONAGEM_PADRAO: Personagem = {
  versao: 2,
  nome: "Rockstar",
  instrumento: "guitarra",
  corpo: { altura: 0.5, porte: 0.5, ombros: 0.5 },
  rosto: { mandibula: 0.5, olhos: 0.5, sobrancelhas: 0.5 },
  cabelo: "rebelde",
  barba: "nenhuma",
  roupa: "jaqueta",
  acessorio: "nenhum",
  cores: { pele: TONS_DE_PELE[1], cabelo: CORES_DE_CABELO[1], olhos: CORES_DOS_OLHOS[0], roupa: CORES_DE_ROUPA[1], detalhe: CORES_DE_DETALHE[2] },
};

/** Cabelos do chibi (versão 1) que têm um equivalente sério. */
const CABELO_DO_CHIBI: Record<string, Cabelo> = { espetado: "rebelde", chanel: "curto", longo: "longo", moicano: "moicano", coquinhos: "rabo" };

const objeto = (valor: unknown): Record<string, unknown> => (valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {});
const ehCor = (valor: unknown): valor is string => typeof valor === "string" && /^#[0-9a-f]{6}$/i.test(valor);
const cor = (valor: unknown, padrao: string) => (ehCor(valor) ? valor : padrao);
const opcao = <T extends string>(valor: unknown, opcoes: Opcao<T>[], padrao: T) => opcoes.find((o) => o.id === valor)?.id ?? padrao;
const ajustes = <T extends Record<string, number>>(valor: unknown, padrao: T): T => {
  const dados = objeto(valor);
  const resultado = { ...padrao };
  for (const chave of Object.keys(padrao) as (keyof T)[]) {
    const numero = dados[chave as string];
    if (typeof numero === "number" && Number.isFinite(numero)) resultado[chave] = Math.min(1, Math.max(0, numero)) as T[keyof T];
  }
  return resultado;
};

/**
 * Normaliza qualquer dado recebido (armazenamento local ou rede) para a versão atual.
 * Personagens chibi antigos aproveitam nome, instrumento, cores e acessório.
 */
export function migrarPersonagem(dado: unknown): Personagem {
  const d = objeto(dado);
  const p = PERSONAGEM_PADRAO;
  const doChibi = d.versao === undefined;
  const coresSalvas = doChibi ? { pele: d.pele, cabelo: d.corDoCabelo, roupa: d.roupa } : objeto(d.cores);
  return {
    versao: 2,
    nome: typeof d.nome === "string" && d.nome.trim() ? d.nome.slice(0, 16) : p.nome,
    instrumento: opcao(d.instrumento, INSTRUMENTOS, p.instrumento),
    corpo: ajustes(d.corpo, p.corpo),
    rosto: ajustes(d.rosto, p.rosto),
    cabelo: opcao(doChibi ? CABELO_DO_CHIBI[d.cabelo as string] : d.cabelo, CABELOS, p.cabelo),
    barba: opcao(d.barba, BARBAS, p.barba),
    roupa: opcao(d.roupa, ROUPAS, p.roupa),
    acessorio: opcao(d.acessorio, ACESSORIOS, p.acessorio),
    cores: {
      pele: cor(coresSalvas.pele, p.cores.pele),
      cabelo: cor(coresSalvas.cabelo, p.cores.cabelo),
      olhos: cor(objeto(coresSalvas).olhos, p.cores.olhos),
      roupa: cor(coresSalvas.roupa, p.cores.roupa),
      detalhe: cor(objeto(coresSalvas).detalhe, p.cores.detalhe),
    },
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
  const sortearAjustes = <T extends Record<string, number>>(base: T) =>
    Object.fromEntries(Object.keys(base).map((chave) => [chave, Math.round(aleatorio() * 100) / 100])) as T;
  return {
    versao: 2,
    nome,
    instrumento: sortear(INSTRUMENTOS).id,
    corpo: sortearAjustes(PERSONAGEM_PADRAO.corpo),
    rosto: sortearAjustes(PERSONAGEM_PADRAO.rosto),
    cabelo: sortear(CABELOS).id,
    barba: sortear(BARBAS).id,
    roupa: sortear(ROUPAS).id,
    acessorio: sortear(ACESSORIOS).id,
    cores: {
      pele: sortear(TONS_DE_PELE),
      cabelo: sortear(CORES_DE_CABELO),
      olhos: sortear(CORES_DOS_OLHOS),
      roupa: sortear(CORES_DE_ROUPA),
      detalhe: sortear(CORES_DE_DETALHE),
    },
  };
}
