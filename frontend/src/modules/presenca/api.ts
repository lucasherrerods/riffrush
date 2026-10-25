import { URL_DA_API, criarCliente } from "@/shared/lib/api";

/** Uma denúncia do chat global, como a moderação vê (a cópia da mensagem fica no banco da API). */
export interface DenunciaDaModeracao {
  mensagem_n: number;
  autor_id: string;
  autor_nome: string;
  texto: string;
  mensagem_em: string;
  denunciante_nome: string;
  criada_em: string;
}

export interface BanidoDaModeracao {
  conta_id: string;
  nome: string;
}

export function criarApiDaPresenca(base: string, buscar?: typeof fetch) {
  const chamar = criarCliente(base, buscar);
  return {
    /** Uma ficha assinada de poucos minutos: é o que o relay confere para saber quem é a pessoa. */
    ficha: (token: string) => chamar<{ ficha: string }>("POST", "/presenca/ficha", { token }).then((r) => r.ficha),
    /* Moderação do chat global: só a moderação consegue (a API responde 403 para o resto). */
    denuncias: (token: string) => chamar<DenunciaDaModeracao[]>("GET", "/moderacao/denuncias", { token }),
    resolver: (token: string, mensagemN: number) => chamar<void>("DELETE", `/moderacao/denuncias/${mensagemN}`, { token }),
    banidos: (token: string) => chamar<BanidoDaModeracao[]>("GET", "/moderacao/banidos", { token }),
    banir: (token: string, contaId: string) => chamar<void>("POST", `/moderacao/banidos/${encodeURIComponent(contaId)}`, { token }),
    desbanir: (token: string, contaId: string) => chamar<void>("DELETE", `/moderacao/banidos/${encodeURIComponent(contaId)}`, { token }),
  };
}

export type ApiDaPresenca = ReturnType<typeof criarApiDaPresenca>;

export const apiDaPresenca = criarApiDaPresenca(URL_DA_API);
