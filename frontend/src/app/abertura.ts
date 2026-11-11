/** Quanto a cortina da abertura espera, no máximo, antes de mostrar o app do jeito que estiver. */
export const LIMITE_DA_ABERTURA_MS = 2500;

export interface EstadoDaAbertura {
  contasLigadas: boolean;
  /** O `sessaoDaConta.iniciar()` da abertura já terminou. */
  contaIniciada: boolean;
  contaCarregando: boolean;
  /** A primeira música do player abriu: com ela vêm a capa do fundo e o cabeçalho do player. */
  trilhaPronta: boolean;
  esgotou: boolean;
}

/** A tela só aparece quando o perfil e a trilha estão prontos, para não ir se montando aos pedaços. */
export function aberturaPronta({ contasLigadas, contaIniciada, contaCarregando, trilhaPronta, esgotou }: EstadoDaAbertura) {
  if (esgotou) return true;
  const contaPronta = !contasLigadas || (contaIniciada && !contaCarregando);
  return contaPronta && trilhaPronta;
}
