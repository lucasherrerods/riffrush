import { openDB, type DBSchema } from "idb";
import { iniciarMotorDoMania } from "../gameplay/motor";
import { lerOsz, type Conjunto, type MapaDoPacote, type OszLido } from "./osz";

/** De onde veio o conjunto: só os baixados do osu! (e conferidos pela API) valem XP e ranking. */
export type OrigemDoConjunto = "osu" | "importado";

export type DificuldadeSalva = Omit<MapaDoPacote, "texto">;

export interface ConjuntoSalvo extends Conjunto {
  /** `osu:<beatmapset_id>` ou, sem id, `arquivo:<hash da primeira dificuldade>`. */
  id: string;
  origem: OrigemDoConjunto;
  /** Status no osu! (ranked, loved, qualified…), quando veio da busca. */
  status?: string;
  /** Estrelas de cada dificuldade, pelo hash do .osu, quando vieram da busca. */
  estrelas?: Record<string, number>;
  mapas: DificuldadeSalva[];
  usadoEm: number;
}

/** Os conjuntos ficam salvos com o .osz inteiro: o áudio e os .osu saem dele na hora de jogar. */
export interface BibliotecaDoMania {
  /** Do usado por último para o mais antigo. */
  listar(): Promise<ConjuntoSalvo[]>;
  guardar(conjunto: ConjuntoSalvo, osz: Blob): Promise<void>;
  /** O pacote lido, ou nada se o conjunto não está salvo. */
  abrir(id: string): Promise<OszLido | undefined>;
  usar(id: string): Promise<void>;
  remover(id: string): Promise<void>;
}

interface Esquema extends DBSchema {
  conjuntos: { key: string; value: ConjuntoSalvo };
  pacotes: { key: string; value: Blob };
}

const VERSAO = 1;

/** Um banco só do Mania, separado do Rock: um modo nunca mexe nas músicas do outro. */
export async function abrirBibliotecaDoMania({ nome = "riffrush-mania", relogio = Date.now } = {}): Promise<BibliotecaDoMania> {
  void navigator.storage?.persist?.().catch(() => false);
  const banco = await openDB<Esquema>(nome, VERSAO, {
    upgrade(db) {
      db.createObjectStore("conjuntos", { keyPath: "id" });
      db.createObjectStore("pacotes");
    },
  });

  return {
    async listar() {
      return (await banco.getAll("conjuntos")).sort((a, b) => b.usadoEm - a.usadoEm);
    },

    async guardar(conjunto, osz) {
      const transacao = banco.transaction(["conjuntos", "pacotes"], "readwrite");
      await transacao.objectStore("conjuntos").put({ ...conjunto, usadoEm: relogio() });
      await transacao.objectStore("pacotes").put(osz, conjunto.id);
      await transacao.done;
    },

    async abrir(id) {
      const osz = await banco.get("pacotes", id);
      if (!osz) return undefined;
      await iniciarMotorDoMania();
      return lerOsz(new Uint8Array(await osz.arrayBuffer()));
    },

    async usar(id) {
      const transacao = banco.transaction("conjuntos", "readwrite");
      const conjunto = await transacao.store.get(id);
      if (conjunto) await transacao.store.put({ ...conjunto, usadoEm: relogio() });
      await transacao.done;
    },

    async remover(id) {
      const transacao = banco.transaction(["conjuntos", "pacotes"], "readwrite");
      await transacao.objectStore("conjuntos").delete(id);
      await transacao.objectStore("pacotes").delete(id);
      await transacao.done;
    },
  };
}

/** Lê o .osz e guarda o conjunto. Lança `ErroDoOsz` se o pacote não serve para o Mania. */
export async function importarOsz(
  biblioteca: BibliotecaDoMania,
  osz: Blob,
  { origem, status, estrelas }: { origem: OrigemDoConjunto; status?: string; estrelas?: Record<string, number> },
): Promise<ConjuntoSalvo> {
  // O .osu é lido pelo motor em WASM, que só carrega quando o Mania abre.
  await iniciarMotorDoMania();
  const { conjunto, mapas } = lerOsz(new Uint8Array(await osz.arrayBuffer()));
  const salvo: ConjuntoSalvo = {
    ...conjunto,
    id: conjunto.beatmapsetId ? `osu:${conjunto.beatmapsetId}` : `arquivo:${mapas[0].hash}`,
    origem,
    status,
    estrelas,
    mapas: mapas.map(({ texto: _texto, ...dificuldade }) => dificuldade),
    usadoEm: 0,
  };
  await biblioteca.guardar(salvo, osz);
  return salvo;
}
