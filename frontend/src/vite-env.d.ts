/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereço wss:// do relay do modo online. */
  readonly VITE_URL_DO_RELAY?: string;
  /** Endereço https:// da API (contas e XP). */
  readonly VITE_URL_DA_API?: string;
  /** Client ID OAuth do Google, o mesmo configurado na API. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Client ID do tipo "App para computador", usado pelo app desktop. */
  readonly VITE_GOOGLE_CLIENT_ID_DESKTOP?: string;
}
