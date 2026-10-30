/** Para comparar nomes numa busca: sem acento, minúsculo e sem espaço nas pontas. */
export const semAcento = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function filtrarPorNome<T extends { nome: string }>(lista: T[], busca: string): T[] {
  const termo = semAcento(busca);
  return termo ? lista.filter((p) => semAcento(p.nome).includes(termo)) : lista;
}
