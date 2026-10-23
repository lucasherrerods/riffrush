import { openDB, type DBSchema } from "idb";
import type { Musica } from "@/modules/songs";
import type { Biblioteca } from "./biblioteca";
import { quemPerdeOAudio } from "./fila";

/** O que fica no histórico: os dados da música, sem os arquivos, que não sobrevivem fora da sessão. */
type DadosDaMusica = Omit<Musica, "arquivo" | "imagemDeCapa" | "arquivoDeVideo">;

interface Registro {
  id: string;
  dados: DadosDaMusica;
  usadaEm: number;
  tamanho: number;
  nomeDoArquivo: string;
  tipoDoArquivo: string;
  capa?: Blob;
}

interface Esquema extends DBSchema {
  musicas: { key: string; value: Registro };
  audios: { key: string; value: Blob };
}

const VERSAO = 1;

export async function abrirBibliotecaDoNavegador({ nome = "riffrush", relogio = Date.now } = {}): Promise<Biblioteca> {
  const banco = await openDB<Esquema>(nome, VERSAO, {
    upgrade(db) {
      db.createObjectStore("musicas", { keyPath: "id" });
      db.createObjectStore("audios");
    },
  });

  return {
    async listar() {
      const transacao = banco.transaction(["musicas", "audios"]);
      const registros = await transacao.objectStore("musicas").getAll();
      const audios = await Promise.all(registros.map((r) => transacao.objectStore("audios").get(r.id)));
      return registros
        .map((registro, i) => ({ registro, audio: audios[i] }))
        .sort((a, b) => b.registro.usadaEm - a.registro.usadaEm)
        .map(({ registro, audio }) => ({
          ...registro.dados,
          arquivo: audio && new File([audio], registro.nomeDoArquivo, { type: registro.tipoDoArquivo }),
          imagemDeCapa: registro.capa && URL.createObjectURL(registro.capa),
        }));
    },

    async guardar(musica, capa) {
      if (!musica.arquivo) return;
      const { arquivo, imagemDeCapa: _capa, arquivoDeVideo: _video, ...dados } = musica;
      const transacao = banco.transaction(["musicas", "audios"], "readwrite");
      const musicas = transacao.objectStore("musicas");
      const anterior = await musicas.get(musica.id);
      await musicas.put({
        id: musica.id,
        dados,
        usadaEm: relogio(),
        tamanho: arquivo.size,
        nomeDoArquivo: arquivo.name,
        tipoDoArquivo: arquivo.type,
        capa: capa ?? anterior?.capa,
      });
      await transacao.objectStore("audios").put(arquivo, musica.id);

      const idsComAudio = new Set(await transacao.objectStore("audios").getAllKeys());
      const comAudio = (await musicas.getAll()).filter((r) => idsComAudio.has(r.id));
      for (const id of quemPerdeOAudio(comAudio)) await transacao.objectStore("audios").delete(id);
      await transacao.done;
    },

    async usar(id) {
      const transacao = banco.transaction("musicas", "readwrite");
      const registro = await transacao.store.get(id);
      if (registro) await transacao.store.put({ ...registro, usadaEm: relogio() });
      await transacao.done;
    },

    async remover(id) {
      const transacao = banco.transaction(["musicas", "audios"], "readwrite");
      await transacao.objectStore("musicas").delete(id);
      await transacao.objectStore("audios").delete(id);
      await transacao.done;
    },
  };
}
