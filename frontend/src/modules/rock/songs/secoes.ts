/*
 * Nomes de seção que os charts do Clone Hero usam: "section Intro" no .chart antigo,
 * "[section Riff 1]" e "[prc_verse_1]" (padrão do Rock Band) nos novos e no notes.mid.
 */

const PALAVRAS: Record<string, string> = {
  verse: "verso",
  chorus: "refrão",
  prechorus: "pré-refrão",
  bridge: "ponte",
  gtr: "guitarra",
  guitar: "guitarra",
  bass: "baixo",
  drum: "bateria",
  drums: "bateria",
  break: "pausa",
  breakdown: "pausa",
  ending: "final",
};

const SOLOS = /^(gtr|guitar|bass|drum|drums|keys?)_solo(.*)$/;

/** O nome da seção que o evento de texto marca, ou null se o evento não for de seção. */
export function secaoDoEvento(texto: string): string | null {
  const encontrado = texto
    .trim()
    .replace(/^\[(.*)\]$/, "$1")
    .match(/^(?:section\s+|prc_)(.*)$/i);
  const bruto = encontrado?.[1].trim();
  if (!bruto) return null;
  // Nome escrito à mão ("Riff 1", "Outro Riff") fica como o autor escreveu.
  if (!bruto.includes("_") && /[A-Z]/.test(bruto)) return bruto;
  const minusculo = bruto.toLowerCase().replace(/pre_chorus/g, "prechorus");
  const solo = minusculo.match(SOLOS);
  const partes = solo ? ["solo", "de", solo[1], ...solo[2].split("_").filter(Boolean)] : minusculo.split(/[_\s]+/).filter(Boolean);
  const nome = partes.map((p) => PALAVRAS[p] ?? (p.length === 1 ? p.toUpperCase() : p)).join(" ");
  return nome[0].toUpperCase() + nome.slice(1);
}
