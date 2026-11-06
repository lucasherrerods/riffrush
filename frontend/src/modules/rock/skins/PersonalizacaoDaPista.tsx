import { useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { carregarHighways, salvarHighways } from "./armazenamento";
import { adicionarHighway, lerHighway, removerHighway } from "./importacao";
import { SKIN_PADRAO, SKINS_PRONTAS, type SkinDaPista } from "./skins";

interface Props {
  escolhida: string;
  aoEscolher: (id: string) => void;
  /** Troca nos testes: o jsdom não decodifica imagens. */
  ler?: (arquivo: File) => Promise<SkinDaPista>;
}

/** Miniatura da pista: o braço (ou a imagem da highway) com as cinco caçapas na base. */
function Amostra({ skin }: { skin: SkinDaPista }) {
  return (
    <div
      aria-hidden
      className="flex h-24 w-full items-end justify-center gap-1.5 rounded-md bg-cover bg-center pb-2"
      style={{ backgroundColor: skin.cores.braco, backgroundImage: skin.highway ? `url(${skin.highway})` : undefined }}
    >
      {skin.cores.trastes.map((cor, i) => (
        <span key={i} className="size-4 rounded-full border-2 border-texto-suave" style={{ backgroundColor: cor }} />
      ))}
    </div>
  );
}

export function PersonalizacaoDaPista({ escolhida, aoEscolher, ler = lerHighway }: Props) {
  const [importadas, setImportadas] = useState(carregarHighways);
  const [erro, setErro] = useState<string | null>(null);

  const guardar = (lista: SkinDaPista[]) => {
    if (!salvarHighways(lista)) throw new Error("Sem espaço para guardar a imagem. Apague uma highway e tente de novo.");
    setImportadas(lista);
  };

  const importar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro(null);
    try {
      const skin = await ler(arquivo);
      guardar(adicionarHighway(importadas, skin));
      aoEscolher(skin.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para importar a imagem.");
    }
  };

  const apagar = (id: string) => {
    guardar(removerHighway(importadas, id));
    if (id === escolhida) aoEscolher(SKIN_PADRAO.id);
  };

  const cartao = (skin: SkinDaPista) => {
    const marcada = skin.id === escolhida;
    return (
      <div key={skin.id} className="relative">
        <button
          role="radio"
          aria-checked={marcada}
          aria-label={skin.nome}
          onClick={() => aoEscolher(skin.id)}
          className={cn("flex w-full flex-col gap-2 rounded-lg border-2 bg-superficie p-2 text-left transition-colors hover:bg-superficie-hover", marcada ? "border-primaria" : "border-borda")}
        >
          <Amostra skin={skin} />
          <span className={cn("truncate text-sm font-semibold", marcada ? "text-texto" : "text-texto-suave")}>{skin.nome}</span>
        </button>
        {skin.highway && (
          <button
            aria-label={`Apagar ${skin.nome}`}
            onClick={() => apagar(skin.id)}
            className="absolute top-3 right-3 rounded-md bg-fundo/80 p-1 text-texto-suave hover:text-perigo"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-2">
      <div role="radiogroup" aria-label="Skin da pista" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {SKINS_PRONTAS.map(cartao)}
        {importadas.map(cartao)}
      </div>
      <div className="flex flex-col gap-1">
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-borda bg-superficie px-4 py-2 text-sm font-semibold hover:bg-superficie-hover">
          <Upload className="size-4 opacity-70" /> Importar highway
          <input
            type="file"
            accept="image/png,image/jpeg"
            aria-label="Importar highway"
            className="sr-only"
            onChange={(e) => {
              void importar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-sm text-texto-suave">PNG ou JPG no formato das highways do Clone Hero (512x1024). A imagem cobre o braço e corre com as notas.</p>
        {erro && (
          <p role="alert" className="text-sm text-perigo">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
