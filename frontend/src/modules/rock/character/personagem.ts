import { PERSONAGENS, definicaoDoPersonagem, skinDoPersonagem } from "./catalogo";

/** O que o jogador escolheu: um personagem do catálogo e uma das skins dele. O instrumento vem do personagem. */
export interface Personagem {
  versao: 4;
  nome: string;
  personagem: string;
  skin: string;
}

export const PERSONAGEM_PADRAO: Personagem = {
  versao: 4,
  nome: "Rockstar",
  personagem: PERSONAGENS[0].id,
  skin: PERSONAGENS[0].skins[0].id,
};

const objeto = (valor: unknown): Record<string, unknown> => (valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {});

/**
 * Normaliza qualquer dado recebido (armazenamento local ou rede) para a versão atual.
 * Das versões antigas, com customização livre, só o nome é aproveitado.
 */
export function migrarPersonagem(dado: unknown): Personagem {
  const d = objeto(dado);
  const nome = typeof d.nome === "string" && d.nome.trim() ? d.nome.slice(0, 16) : PERSONAGEM_PADRAO.nome;
  if (d.versao !== 4) return { ...PERSONAGEM_PADRAO, nome };
  const escolha = { personagem: String(d.personagem), skin: String(d.skin) };
  return { versao: 4, nome, personagem: definicaoDoPersonagem(escolha).id, skin: skinDoPersonagem(escolha).id };
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
