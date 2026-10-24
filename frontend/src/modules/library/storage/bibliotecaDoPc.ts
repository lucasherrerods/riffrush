import { invoke } from "@tauri-apps/api/core";
import type { Musica } from "@/modules/songs";
import { dadosDa, type Biblioteca } from "./biblioteca";

/** Como o Rust devolve cada música (src-tauri/src/biblioteca/armazem.rs). */
interface Registro {
  id: string;
  dados: string;
  usadaEm: number;
  nomeDoArquivo: string;
  tipoDoArquivo: string;
  temCapa: boolean;
}

type Chamar = (comando: string, ...args: unknown[]) => Promise<unknown>;

/** O .sng e alguns arquivos arrastados chegam sem tipo, e o WebView2 descarta cabeçalho vazio. */
const TIPO_GENERICO = "application/octet-stream";

/** Os cabeçalhos do invoke só aceitam ASCII; o Rust decodifica do outro lado. */
const cabecalhos = (valores: Record<string, string>) => ({
  headers: Object.fromEntries(Object.entries(valores).map(([nome, valor]) => [nome, encodeURIComponent(valor)])),
});

/**
 * No PC todas as músicas ficam salvas: os dados numa SQLite e os arquivos numa pasta do app.
 * Listar não lê os arquivos, que podem somar gigas: cada um é aberto só na hora de tocar.
 */
export async function abrirBibliotecaDoPc(chamar: Chamar = invoke as Chamar): Promise<Biblioteca> {
  const registros = new Map<string, Registro>();

  return {
    async listar() {
      const lista = (await chamar("biblioteca_listar")) as Registro[];
      return Promise.all(
        lista.map(async (registro): Promise<Musica> => {
          registros.set(registro.id, registro);
          const capa = registro.temCapa ? ((await chamar("biblioteca_ler_capa", { id: registro.id }).catch(() => undefined)) as ArrayBuffer | undefined) : undefined;
          return { ...JSON.parse(registro.dados), noAparelho: true, imagemDeCapa: capa && URL.createObjectURL(new Blob([capa])) };
        }),
      );
    },

    async guardar(musica, capa) {
      const { arquivo } = musica;
      if (!arquivo) return;
      const dados = JSON.stringify(dadosDa(musica));
      const tipo = arquivo.type || TIPO_GENERICO;
      await chamar("biblioteca_guardar", new Uint8Array(await arquivo.arrayBuffer()), cabecalhos({ "x-id": musica.id, "x-dados": dados, "x-nome": arquivo.name, "x-tipo": tipo }));
      registros.set(musica.id, { id: musica.id, dados, usadaEm: Date.now(), nomeDoArquivo: arquivo.name, tipoDoArquivo: tipo, temCapa: !!capa });
      if (capa) await chamar("biblioteca_guardar_capa", new Uint8Array(await capa.arrayBuffer()), cabecalhos({ "x-id": musica.id }));
    },

    async usar(id) {
      await chamar("biblioteca_usar", { id });
    },

    async remover(id) {
      await chamar("biblioteca_remover", { id });
      registros.delete(id);
    },

    async abrir(id) {
      const registro = registros.get(id);
      if (!registro) return undefined;
      const bytes = (await chamar("biblioteca_ler_arquivo", { id }).catch(() => undefined)) as ArrayBuffer | undefined;
      return bytes && new File([bytes], registro.nomeDoArquivo, { type: registro.tipoDoArquivo });
    },
  };
}
