import { URL_DA_API, criarCliente } from "@/shared/lib/api";

export function criarApiDaPresenca(base: string, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  return {
    /** Uma ficha assinada de poucos minutos: é o que o relay confere para saber quem é a pessoa. */
    ficha: (token: string) => chamar<{ ficha: string }>("POST", "/presenca/ficha", { token }).then((r) => r.ficha),
  };
}

export const apiDaPresenca = criarApiDaPresenca(URL_DA_API);
