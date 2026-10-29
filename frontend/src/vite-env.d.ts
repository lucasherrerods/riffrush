/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereço wss:// do relay do modo online. */
  readonly VITE_URL_DO_RELAY?: string;
  /** Endereço https:// da API (contas e XP). */
  readonly VITE_URL_DA_API?: string;
  /** Client ID OAuth do Google, o mesmo configurado na API. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_CONTA_FALSA?: string;
  /** Client ID do tipo "App para computador", usado pelo app desktop. */
  readonly VITE_GOOGLE_CLIENT_ID_DESKTOP?: string;
  /** Com 1, o modo Mania aparece no app (enquanto ele está em desenvolvimento). */
  readonly VITE_MODO_MANIA?: string;
}
