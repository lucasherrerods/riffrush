export const LIMITE_DE_MUSICAS = 3;
export const LIMITE_DE_BYTES = 150 * 1024 * 1024;

interface ComAudio {
  id: string;
  usadaEm: number;
  tamanho: number;
}

/** Das músicas com áudio guardado, quais perdem o áudio: fica quem foi usada por último, até 3 músicas e 150 MB. */
export function quemPerdeOAudio(musicas: ComAudio[]): string[] {
  const saem: string[] = [];
  let ficam = 0;
  let bytes = 0;
  for (const musica of [...musicas].sort((a, b) => b.usadaEm - a.usadaEm)) {
    if (ficam < LIMITE_DE_MUSICAS && bytes + musica.tamanho <= LIMITE_DE_BYTES) {
      ficam++;
      bytes += musica.tamanho;
    } else {
      saem.push(musica.id);
    }
  }
  return saem;
}
