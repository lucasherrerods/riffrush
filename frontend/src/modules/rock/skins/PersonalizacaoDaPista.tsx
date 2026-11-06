import { useState } from "react";
import { ExternalLink, Upload } from "lucide-react";
import { abrirLink } from "@/modules/platform";
import { Button } from "@/shared/ui/button";
import { CartaoDeSkin, GRADE_DE_SKINS } from "./CartaoDeSkin";
import { carregarHighways, salvarHighways } from "./armazenamento";
import { abrirImagem, adicionarHighway, recortarHighway, removerHighway, type ImagemAberta } from "./importacao";
import type { Recorte } from "./recorte";
import { RecorteDaHighway } from "./RecorteDaHighway";
import { SKIN_PADRAO, SKINS_PRONTAS, type SkinDaPista } from "./skins";

/** Onde a comunidade do Clone Hero publica highways prontas. O jogo só abre a página: quem baixa é o jogador. */
export const SITE_DE_HIGHWAYS = "https://www.fullcombo.net/clone-hero/clone-hero-highways/";

interface Props {
  escolhida: string;
  aoEscolher: (id: string) => void;
  /** Trocas nos testes: o jsdom não decodifica imagens. */
  abrir?: (arquivo: File) => Promise<ImagemAberta>;
  recortar?: (imagem: ImagemAberta, recorte: Recorte) => Promise<SkinDaPista>;
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

function AjudaDaImagem() {
  return (
    <details className="rounded-lg border border-borda bg-superficie p-3">
      <summary className="cursor-pointer font-semibold">Como deve ser a imagem</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-texto-suave">
        <li>PNG ou JPG, de até 8 MB. É o mesmo formato das highways do Clone Hero.</li>
        <li>Em pé, na proporção 1:2. O tamanho ideal é 512x1024: a imagem é guardada nesse tamanho.</li>
        <li>A imagem cobre o braço inteiro: a base fica na linha de batida e o topo no fim do braço. Ela se repete e corre junto com as notas, então fica melhor quando o topo e a base se emendam.</li>
        <li>Qualquer outra imagem também serve: ao importar, você escolhe o pedaço que vira a pista.</li>
        <li>Prefira imagens escuras no meio, para as notas aparecerem bem.</li>
      </ul>
    </details>
  );
}

export function PersonalizacaoDaPista({ escolhida, aoEscolher, abrir = abrirImagem, recortar = recortarHighway }: Props) {
  const [importadas, setImportadas] = useState(carregarHighways);
  const [erro, setErro] = useState<string | null>(null);
  const [recortando, setRecortando] = useState<ImagemAberta | null>(null);

  const guardar = (lista: SkinDaPista[]) => {
    if (!salvarHighways(lista)) throw new Error("Sem espaço para guardar a imagem. Apague uma highway e tente de novo.");
    setImportadas(lista);
  };

  const tentar = async (acao: () => Promise<void>) => {
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para importar a imagem.");
    }
  };

  const fecharRecorte = () => {
    if (recortando) URL.revokeObjectURL?.(recortando.url);
    setRecortando(null);
  };

  const usarRecorte = (recorte: Recorte) => {
    const imagem = recortando;
    fecharRecorte();
    if (!imagem) return;
    void tentar(async () => {
      const skin = await recortar(imagem, recorte);
      guardar(adicionarHighway(importadas, skin));
      aoEscolher(skin.id);
    });
  };

  const apagar = (id: string) => {
    guardar(removerHighway(importadas, id));
    if (id === escolhida) aoEscolher(SKIN_PADRAO.id);
  };

  const cartao = (skin: SkinDaPista, importada = false) => (
    <CartaoDeSkin
      key={skin.id}
      nome={skin.nome}
      marcada={skin.id === escolhida}
      aoEscolher={() => aoEscolher(skin.id)}
      amostra={<Amostra skin={skin} />}
      aoApagar={importada ? () => apagar(skin.id) : undefined}
    />
  );

  return (
    <div className="flex flex-col gap-4 p-2">
      <div role="radiogroup" aria-label="Skin da pista" className={GRADE_DE_SKINS}>
        {SKINS_PRONTAS.map((skin) => cartao(skin))}
        {importadas.map((skin) => cartao(skin, true))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-borda bg-superficie px-4 py-2 text-sm font-semibold hover:bg-superficie-hover">
          <Upload className="size-4 opacity-70" /> Importar imagem
          <input
            type="file"
            accept="image/png,image/jpeg"
            aria-label="Importar imagem"
            className="sr-only"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (arquivo) void tentar(async () => setRecortando(await abrir(arquivo)));
            }}
          />
        </label>
        <Button variant="ghost" onClick={() => abrirLink(SITE_DE_HIGHWAYS)}>
          <ExternalLink className="opacity-70" /> Baixar highways prontas
        </Button>
      </div>
      {erro && (
        <p role="alert" className="text-sm text-perigo">
          {erro}
        </p>
      )}
      <AjudaDaImagem />
      {recortando && <RecorteDaHighway imagem={recortando} aoUsar={usarRecorte} aoCancelar={fecharRecorte} />}
    </div>
  );
}
