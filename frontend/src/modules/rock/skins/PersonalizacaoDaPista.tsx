import { useState } from "react";
import { Upload } from "lucide-react";
import { CartaoDeSkin, GRADE_DE_SKINS } from "./CartaoDeSkin";
import { carregarHighways, salvarHighways } from "./armazenamento";
import { adicionarHighway, lerHighway, removerHighway } from "./importacao";
import { SKIN_PADRAO, SKINS_PRONTAS, type SkinDaPista } from "./skins";

interface Props {
  escolhida: string;
  aoEscolher: (id: string) => void;
  /** Troca nos testes: o jsdom não decodifica imagens. */
  ler?: (arquivo: File) => Promise<SkinDaPista>;
}

/** Miniatura da pista: o braço ou a imagem da highway. */
function Amostra({ skin }: { skin: SkinDaPista }) {
  return (
    <div
      aria-hidden
      className="h-24 w-full rounded-md border border-borda bg-cover bg-center"
      style={{ backgroundColor: skin.cores.braco, backgroundImage: skin.highway ? `url(${skin.highway})` : undefined }}
    />
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

  const cartao = (skin: SkinDaPista) => (
    <CartaoDeSkin
      key={skin.id}
      nome={skin.nome}
      marcada={skin.id === escolhida}
      aoEscolher={() => aoEscolher(skin.id)}
      amostra={<Amostra skin={skin} />}
      aoApagar={skin.highway ? () => apagar(skin.id) : undefined}
    />
  );

  return (
    <div className="flex flex-col gap-4 p-2">
      <div role="radiogroup" aria-label="Skin da pista" className={GRADE_DE_SKINS}>
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
