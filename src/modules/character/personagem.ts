export type Cabelo = "espetado" | "chanel" | "longo" | "moicano" | "coquinhos";
export type Olhos = "fofo" | "feliz" | "marrento" | "estrela";
export type Acessorio = "nenhum" | "oculos" | "fone" | "bandana" | "coroa";
export type Instrumento = "guitarra" | "baixo" | "keytar" | "bateria" | "vocal";

export interface Personagem {
  nome: string;
  pele: string;
  cabelo: Cabelo;
  corDoCabelo: string;
  olhos: Olhos;
  roupa: string;
  acessorio: Acessorio;
  instrumento: Instrumento;
}

export const TONS_DE_PELE = ["#ffe0c7", "#f5c9a0", "#d9a074", "#a86b45", "#6e4128"];
export const CORES_DE_CABELO = ["#1f1b24", "#6b3f1f", "#f5d36b", "#ef4444", "#ec4899", "#3b82f6", "#22c55e", "#e5e7eb"];
export const CORES_DE_ROUPA = ["#1a1722", "#7c3aed", "#db2777", "#ef4444", "#f97316", "#0ea5e9", "#16a34a", "#f3f2f7"];

export const CABELOS: { id: Cabelo; rotulo: string }[] = [
  { id: "espetado", rotulo: "Espetado" },
  { id: "chanel", rotulo: "Chanel" },
  { id: "longo", rotulo: "Longo" },
  { id: "moicano", rotulo: "Moicano" },
  { id: "coquinhos", rotulo: "Coquinhos" },
];
export const OLHOS: { id: Olhos; rotulo: string }[] = [
  { id: "fofo", rotulo: "Fofo" },
  { id: "feliz", rotulo: "Feliz" },
  { id: "marrento", rotulo: "Marrento" },
  { id: "estrela", rotulo: "Estrela" },
];
export const ACESSORIOS: { id: Acessorio; rotulo: string }[] = [
  { id: "nenhum", rotulo: "Nada" },
  { id: "oculos", rotulo: "Óculos escuros" },
  { id: "fone", rotulo: "Fone" },
  { id: "bandana", rotulo: "Bandana" },
  { id: "coroa", rotulo: "Coroa" },
];
export const INSTRUMENTOS: { id: Instrumento; rotulo: string }[] = [
  { id: "guitarra", rotulo: "Guitarra" },
  { id: "baixo", rotulo: "Baixo" },
  { id: "keytar", rotulo: "Keytar" },
  { id: "bateria", rotulo: "Bateria" },
  { id: "vocal", rotulo: "Vocal" },
];

export const PERSONAGEM_PADRAO: Personagem = {
  nome: "Rockstar",
  pele: TONS_DE_PELE[1],
  cabelo: "espetado",
  corDoCabelo: CORES_DE_CABELO[4],
  olhos: "fofo",
  roupa: CORES_DE_ROUPA[0],
  acessorio: "nenhum",
  instrumento: "guitarra",
};

const CHAVE = "riffrush.personagem";

export function carregarPersonagem(): Personagem {
  try {
    return { ...PERSONAGEM_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) ?? "{}") };
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
    nome,
    pele: sortear(TONS_DE_PELE),
    cabelo: sortear(CABELOS).id,
    corDoCabelo: sortear(CORES_DE_CABELO),
    olhos: sortear(OLHOS).id,
    roupa: sortear(CORES_DE_ROUPA),
    acessorio: sortear(ACESSORIOS).id,
    instrumento: sortear(INSTRUMENTOS).id,
  };
}
