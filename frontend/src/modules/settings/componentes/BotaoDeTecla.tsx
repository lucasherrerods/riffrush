interface Props {
  /** Nome para leitores de tela. */
  rotulo: string;
  texto: string;
  esperando: boolean;
  /** Cor da borda (a do traste no Rock); sem ela, a borda comum. */
  cor?: string;
  aoClicar: () => void;
}

/** O botão que mostra uma tecla e, clicado, espera a nova. É o mesmo nos dois modos. */
export function BotaoDeTecla({ rotulo, texto, esperando, cor = "var(--cor-borda)", aoClicar }: Props) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={aoClicar}
      className="min-w-28 rounded-lg border-2 bg-superficie px-4 py-2 font-mono text-base font-bold max-md:min-w-16 max-md:px-2 max-md:py-1 max-md:text-sm transition-colors hover:bg-superficie-hover"
      style={{ borderColor: esperando ? "var(--cor-texto)" : cor }}
    >
      {esperando ? "Aperte..." : texto}
    </button>
  );
}
