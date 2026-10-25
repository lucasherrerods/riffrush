export class ErroDaApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

interface OpcoesDaChamada {
  token?: string;
  corpo?: unknown;
  /** Cancela o pedido quando a resposta não interessa mais. */
  sinal?: AbortSignal;
  /** A resposta vem em bytes (replay), não em JSON. */
  bytes?: boolean;
}

/** Fala com a API do Riff Rush (`VITE_URL_DA_API`). Cada módulo monta as próprias rotas no `api.ts` dele em cima disto. */
export function criarCliente(base: string, buscar: typeof fetch = (...args) => fetch(...args)) {
  // Com barra no fim, o endereço ficaria "//eu" e a API responderia 404.
  base = base.replace(/\/+$/, "");
  return async function chamar<T>(metodo: string, caminho: string, { token, corpo, sinal, bytes }: OpcoesDaChamada = {}): Promise<T> {
    const resposta = await buscar(`${base}${caminho}`, {
      method: metodo,
      headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: sinal,
    });
    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      throw new ErroDaApi(resposta.status, erro.erro ?? `Erro ${resposta.status} na API.`);
    }
    if (bytes) return new Uint8Array(await resposta.arrayBuffer()) as T;
    return resposta.status === 204 ? (undefined as T) : resposta.json();
  };
}

export const URL_DA_API: string = import.meta.env.VITE_URL_DA_API ?? "";
