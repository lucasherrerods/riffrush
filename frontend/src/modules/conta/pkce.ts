const ENDERECO_DO_GOOGLE = "https://accounts.google.com/o/oauth2/v2/auth";

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** O segredo do PKCE: fica no aparelho e só vai para a API junto com o código. */
export function gerarVerificador() {
  return base64url(crypto.getRandomValues(new Uint8Array(48)));
}

export async function desafioDoVerificador(verificador: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador))));
}

interface PedidoAoGoogle {
  clientId: string;
  /** No desktop fica de fora: o app junta o endereço do loopback quando sabe a porta. */
  redirectUri?: string;
  desafio: string;
  /** Valor aleatório que volta na URL: prova que o retorno é do nosso pedido. */
  estado: string;
}

export function urlDoLoginDoGoogle({ clientId, redirectUri, desafio, estado }: PedidoAoGoogle) {
  const parametros = new URLSearchParams({
    client_id: clientId,
    ...(redirectUri && { redirect_uri: redirectUri }),
    response_type: "code",
    scope: "openid profile email",
    code_challenge: desafio,
    code_challenge_method: "S256",
    state: estado,
    prompt: "select_account",
  });
  return `${ENDERECO_DO_GOOGLE}?${parametros}`;
}

export type RetornoDoGoogle = { tipo: "nada" } | { tipo: "erro" } | { tipo: "codigo"; codigo: string };

export function lerRetornoDoGoogle(busca: string, estadoEsperado: string | null): RetornoDoGoogle {
  const parametros = new URLSearchParams(busca);
  if (!estadoEsperado || !parametros.has("state")) return { tipo: "nada" };
  const codigo = parametros.get("code");
  if (parametros.get("state") !== estadoEsperado || !codigo) return { tipo: "erro" };
  return { tipo: "codigo", codigo };
}
