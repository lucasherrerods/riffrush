// Pedidos HTTP entre o relay e a API (denúncias e avisos de banimento), assinados com o segredo em comum.
// Mesmo formato de backend/src/modules/moderacao/dominio.rs.

export const CABECALHO_DA_HORA = "x-riffrush-hora";
export const CABECALHO_DA_ASSINATURA = "x-riffrush-assinatura";
/** Um pedido copiado não serve depois disso. */
const VALIDADE_EM_SEGUNDOS = 5 * 60;

const paraBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const deBase64Url = (texto: string) => Uint8Array.from(atob(texto.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const chave = (segredo: string, uso: "sign" | "verify") =>
  crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, [uso]);

/** `base64url(hmac-sha256(segredo, "{hora}.{corpo}"))`. */
export async function assinarPedido(segredo: string, hora: number, corpo: string): Promise<string> {
  return paraBase64Url(await crypto.subtle.sign("HMAC", await chave(segredo, "sign"), new TextEncoder().encode(`${hora}.${corpo}`)));
}

export async function conferirPedido(segredo: string, hora: number, agora: number, corpo: string, assinatura: string): Promise<boolean> {
  if (!segredo || !Number.isInteger(hora) || Math.abs(agora - hora) > VALIDADE_EM_SEGUNDOS) return false;
  try {
    // verify compara em tempo constante.
    return await crypto.subtle.verify("HMAC", await chave(segredo, "verify"), deBase64Url(assinatura), new TextEncoder().encode(`${hora}.${corpo}`));
  } catch {
    return false;
  }
}
