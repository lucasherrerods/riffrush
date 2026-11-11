import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { Download, FileAudio, Info, ListOrdered } from "lucide-react"
import {
  AvisoDaLista,
  BarraDaSelecao,
  BotaoDaSelecao,
  BotaoDeAleatoria,
  BotaoDeFavoritar,
  BotaoDeModificadores,
  BotaoDeTocar,
  Carrossel,
  FiltrosDaBiblioteca,
  FundoDaSelecao,
  MenuDeApagar,
  RodapeDeComandos,
  SelecaoNoCelular,
  TituloDaSelecao,
  alternarFavorita,
  carregarFavoritas,
  indiceDandoAVolta,
  passosSemDarAVolta,
  salvarFavoritas,
  type DificuldadeDoCarrossel,
  type ItemDoCarrossel,
} from "@/modules/selecao"
import { useTeclado } from "@/shared/hooks/useTeclado"
import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita"
import { cn } from "@/shared/lib/utils"
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes"
import { NumeroDestacado } from "@/shared/ui/NumeroDestacado"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca"
import {
  faixaDasEstrelas,
  type FaixaDeDificuldade,
} from "../beatmaps/dificuldades"
import type { PosicaoNoRankingDoMania } from "../ranking/api"
import { PainelDoRankingDoMania } from "../ranking/PainelDoRankingDoMania"
import {
  filtrarConjuntos,
  teclasDaBiblioteca,
  type OrdemDaSelecao,
} from "./filtroDaSelecao"
import { soOQueCabeNoCelular } from "../beatmaps/celular"
import { CapaDoConjunto } from "./CapaDoConjunto"
import { SeletorDeMods } from "./SeletorDeMods"
import type { FiltroDoSorteio } from "../busca/sortear"
import {
  carregarFiltroDaAleatoria,
  FiltroDaAleatoria,
  salvarFiltroDaAleatoria,
} from "./FiltroDaAleatoria"

interface Props {
  /** O conjunto que abre selecionado (ex.: o que acabou de ser baixado na busca). */
  selecionado?: string
  aoVoltar?: () => void
  /** A cada troca de conjunto selecionado, para o player tocar a música dele. */
  aoMudarSelecao?: (conjuntoId: string) => void
  aoBuscarMapas?: () => void
  conjuntos: ConjuntoSalvo[] | null
  mods: number
  aoMudarMods: (mods: number) => void
  aoImportar: (arquivos: File[]) => void
  aoJogar: (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva) => void
  /** Apaga o conjunto da biblioteca; sem ele o menu de opções não aparece. */
  aoRemover?: (conjunto: ConjuntoSalvo) => void
  /** Abre o mapa no treino; sem ele o botão não aparece. */
  aoTreinar?: (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva) => void
  /** Baixa um mapa ranked sorteado, dentro do filtro da Aleatória, e o abre selecionado; sem ele o botão não aparece. */
  sortearMapa?: (filtro: FiltroDoSorteio) => Promise<unknown>
  /** Assistir ao replay de uma partida do ranking da dificuldade escolhida. */
  aoAssistir?: (
    conjunto: ConjuntoSalvo,
    dificuldade: DificuldadeSalva,
    linha: PosicaoNoRankingDoMania,
  ) => void
}

const CHAVE_DAS_FAVORITAS = "riffrush:mania:favoritas"

const COMANDOS = [
  { teclas: "← →", rotulo: "Dificuldade" },
  { teclas: "↑ ↓", rotulo: "Mapa" },
  { teclas: "Enter", rotulo: "Confirmar" },
  { teclas: "F", rotulo: "Favoritar" },
  { teclas: "Esc", rotulo: "Voltar" },
]

/** Quantos bits de mod estão ligados, para o número no botão. */
const contarMods = (mods: number) => mods.toString(2).split("1").length - 1

const ehOsz = (arquivo: File) => arquivo.name.toLowerCase().endsWith(".osz")

/** Quantos mapas o Page Up e o Page Down pulam. */
const PAGINA = 8

/** A faixa de estrelas do osu! dá a cor da faixa lateral, do verde ao rosa, como as dificuldades do Rock. */
const COR_DA_FAIXA: Record<FaixaDeDificuldade, string> = {
  Easy: "bg-sucesso",
  Normal: "bg-ouro",
  Hard: "bg-destaque",
  Insane: "bg-primaria",
  Expert: "bg-texto",
  "Expert+": "bg-texto",
}

const ORDENS: { id: OrdemDaSelecao; rotulo: string }[] = [
  { id: "recentes", rotulo: "Jogados por último" },
  { id: "titulo", rotulo: "Título" },
  { id: "artista", rotulo: "Artista" },
  { id: "estrelas", rotulo: "Estrelas" },
]

const formatarEstrelas = (estrelas: number) =>
  `${estrelas.toFixed(2).replace(".", ",")}★`
const formatarDuracao = (ms: number) => {
  const segundos = Math.round(ms / 1000)
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`
}

function rotuloDaDificuldade(
  conjunto: ConjuntoSalvo,
  dificuldade: DificuldadeSalva,
) {
  const estrelas = conjunto.estrelas?.[dificuldade.hash]
  return (
    <span className="flex items-baseline gap-2">
      <span>{dificuldade.teclas}K</span>
      <span className="truncate normal-case">{dificuldade.dificuldade}</span>
      {estrelas !== undefined && (
        <span className="font-mono text-base text-texto-suave">
          {formatarEstrelas(estrelas)}
        </span>
      )}
    </span>
  )
}

/** A seleção do Mania: os conjuntos na mesma roda da seleção do Rock, com busca, filtro de teclas, ordem e as abas de detalhes e ranking. */
export function TelaDeSelecaoMania({
  selecionado,
  aoVoltar,
  aoBuscarMapas,
  conjuntos,
  mods,
  aoMudarMods,
  aoImportar,
  aoJogar,
  aoRemover,
  aoTreinar,
  aoAssistir,
  sortearMapa,
  aoMudarSelecao,
}: Props) {
  // A seleção segue o id do conjunto: muda a ordem ou o filtro e ela continua no mesmo mapa, se ele ainda aparecer.
  const [id, setId] = useState<string | null>(selecionado ?? null)
  // O mapa sorteado chega depois de a tela abrir: a seleção vai para ele.
  useEffect(() => {
    if (selecionado) setId(selecionado)
  }, [selecionado])
  const [hash, setHash] = useState<string | null>(null)
  const [texto, setTexto] = useState("")
  const [teclas, setTeclas] = useState<number | "todas">("todas")
  const [ordem, setOrdem] = useState<OrdemDaSelecao>("recentes")
  const [arrastando, setArrastando] = useState(false)
  const [favoritas, setFavoritas] = useState(() =>
    carregarFavoritas(CHAVE_DAS_FAVORITAS),
  )
  const [soFavoritas, setSoFavoritas] = useState(false)
  const [filtroDaAleatoria, setFiltroDaAleatoria] = useState(
    carregarFiltroDaAleatoria,
  )
  const mudarFiltroDaAleatoria = (filtro: FiltroDoSorteio) => {
    setFiltroDaAleatoria(filtro)
    salvarFiltroDaAleatoria(filtro)
  }
  const seletor = useRef<HTMLInputElement>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [removendo, setRemovendo] = useState(false)

  const estreita = useTelaEstreita()
  // No celular só aparece o que dá para tocar com o dedo (até 5K), e o filtro de teclas só oferece essas.
  const todos = useMemo(
    () => (estreita ? soOQueCabeNoCelular(conjuntos ?? []) : (conjuntos ?? [])),
    [conjuntos, estreita],
  )
  const lista = useMemo(
    () =>
      filtrarConjuntos(todos, {
        texto,
        teclas,
        ordem,
        favoritas,
        soFavoritas,
      }),
    [todos, texto, teclas, ordem, favoritas, soFavoritas],
  )
  const opcoesDeTeclas = teclasDaBiblioteca(todos)
  const indice = Math.max(
    lista.findIndex((c) => c.id === id),
    0,
  )
  const conjunto = lista[indice] as ConjuntoSalvo | undefined
  const idDoConjunto = conjunto?.id
  useEffect(() => {
    if (idDoConjunto) aoMudarSelecao?.(idDoConjunto)
  }, [idDoConjunto, aoMudarSelecao])
  const dificuldade =
    conjunto?.mapas.find((m) => m.hash === hash) ?? conjunto?.mapas[0]

  const escolher = (i: number) => {
    const proximo = lista[i]
    if (!proximo || proximo.id === conjunto?.id) return
    setId(proximo.id)
    setHash(null)
  }
  const andar = (passos: number) =>
    escolher(indiceDandoAVolta(indice, passos, lista.length))
  const pular = (passos: number) =>
    escolher(indice + passosSemDarAVolta(indice, passos, lista.length))
  const jogar = () => conjunto && dificuldade && aoJogar(conjunto, dificuldade)
  const favorita = !!conjunto && favoritas.has(conjunto.id)
  const alternarFavoritaAtual = () => {
    if (!conjunto) return
    const novas = alternarFavorita(favoritas, conjunto.id)
    setFavoritas(novas)
    salvarFavoritas(CHAVE_DAS_FAVORITAS, novas)
  }

  useTeclado((evento) => {
    if (menuAberto || removendo) return
    // Com o foco num campo (a busca), as teclas são dele, menos as que andam pela roda.
    const digitando =
      evento.target instanceof HTMLInputElement ||
      evento.target instanceof HTMLSelectElement
    if (evento.code === "ArrowDown" || evento.code === "ArrowUp") {
      evento.preventDefault()
      return andar(evento.code === "ArrowDown" ? 1 : -1)
    }
    if (evento.code === "PageDown" || evento.code === "PageUp") {
      evento.preventDefault()
      return pular(evento.code === "PageDown" ? PAGINA : -PAGINA)
    }
    if (
      evento.code === "Enter" &&
      !(evento.target instanceof HTMLButtonElement)
    )
      return jogar()
    if (digitando) return
    if (evento.code === "KeyF") return alternarFavoritaAtual()
    if (evento.code === "Home") return escolher(0)
    if (evento.code === "End") return escolher(lista.length - 1)
    if (
      (evento.code === "ArrowLeft" || evento.code === "ArrowRight") &&
      conjunto &&
      dificuldade
    ) {
      const posicao = conjunto.mapas.indexOf(dificuldade)
      const proxima =
        conjunto.mapas[posicao + (evento.code === "ArrowRight" ? 1 : -1)]
      if (proxima) setHash(proxima.hash)
    }
  })

  const receber = (arquivos: FileList | null) => {
    const osz = [...(arquivos ?? [])].filter(ehOsz)
    if (osz.length) aoImportar(osz)
  }
  const aoSoltar = (evento: DragEvent) => {
    evento.preventDefault()
    setArrastando(false)
    receber(evento.dataTransfer.files)
  }

  const itens: ItemDoCarrossel[] = lista.map((c) => ({
    id: c.id,
    titulo: c.tituloUnicode || c.titulo,
    artista: c.artistaUnicode || c.artista,
    capa: <CapaDoConjunto conjunto={c} />,
    favorita: favoritas.has(c.id),
  }))
  const dificuldades: DificuldadeDoCarrossel[] = (conjunto?.mapas ?? []).map(
    (m) => {
      const estrelas = conjunto?.estrelas?.[m.hash]
      return {
        id: m.hash,
        rotulo: rotuloDaDificuldade(conjunto!, m),
        cor:
          estrelas === undefined
            ? "bg-borda"
            : COR_DA_FAIXA[faixaDasEstrelas(estrelas)],
      }
    },
  )

  const estrelas =
    conjunto && dificuldade ? conjunto.estrelas?.[dificuldade.hash] : undefined
  const detalhes = dificuldade && (
    <div className="grid grid-cols-3 gap-2 max-md:grid-cols-2">
      <NumeroDestacado
        rotulo="Duração"
        valor={formatarDuracao(dificuldade.duracaoMs)}
      />
      <NumeroDestacado rotulo="Notas" valor={String(dificuldade.notas)} />
      <NumeroDestacado
        rotulo="Notas longas"
        valor={String(dificuldade.notasLongas)}
      />
      <NumeroDestacado rotulo="Teclas" valor={`${dificuldade.teclas}K`} />
      <NumeroDestacado
        rotulo="OD"
        valor={String(dificuldade.od).replace(".", ",")}
      />
      <NumeroDestacado
        rotulo="HP"
        valor={String(dificuldade.hp).replace(".", ",")}
      />
      {estrelas !== undefined && (
        <NumeroDestacado rotulo="Estrelas" valor={formatarEstrelas(estrelas)} />
      )}
      {conjunto?.status && (
        <NumeroDestacado rotulo="Status" valor={conjunto.status} />
      )}
    </div>
  )
  const ranking = dificuldade?.beatmapId && conjunto?.origem === "osu" && (
    <PainelDoRankingDoMania
      beatmapId={dificuldade.beatmapId}
      aoAssistir={
        aoAssistir && ((linha) => aoAssistir(conjunto, dificuldade, linha))
      }
    />
  )

  const fundo = (
    // Como no Rock: a capa do mapa, borrada, pinta o fundo e troca junto com a seleção.
    <FundoDaSelecao chave={conjunto?.id}>
      {conjunto && (
        <CapaDoConjunto conjunto={conjunto} className="scale-105 blur-md" />
      )}
    </FundoDaSelecao>
  )
  const cabecalho = (
    <>
      <BarraDaSelecao aoVoltar={aoVoltar}>
        <BotaoDeModificadores ligados={contarMods(mods)}>
          <SeletorDeMods mods={mods} aoMudar={aoMudarMods} />
        </BotaoDeModificadores>
        <BotaoDaSelecao onClick={() => seletor.current?.click()}>
          <FileAudio className="opacity-70" aria-hidden />
          <span className="max-md:sr-only">Importar .osz</span>
        </BotaoDaSelecao>
        {sortearMapa && (
          <BotaoDeAleatoria
            aoSortear={() => sortearMapa(filtroDaAleatoria)}
            filtro={{
              ativos:
                filtroDaAleatoria.teclas.length +
                filtroDaAleatoria.faixas.length,
              conteudo: (
                <FiltroDaAleatoria
                  filtro={filtroDaAleatoria}
                  aoMudar={mudarFiltroDaAleatoria}
                />
              ),
            }}
          />
        )}
        {aoBuscarMapas && (
          <BotaoDaSelecao onClick={aoBuscarMapas}>
            <Download className="opacity-70" aria-hidden />
            <span className="max-md:sr-only">Baixar músicas</span>
          </BotaoDaSelecao>
        )}
      </BarraDaSelecao>
      <input
        ref={seletor}
        type="file"
        accept=".osz"
        multiple
        aria-label="Arquivos .osz"
        className="sr-only"
        onChange={(e) => receber(e.target.files)}
      />
    </>
  )
  const tocar = (
    <BotaoDeTocar
      aoTocar={jogar}
      aoTreinar={
        aoTreinar &&
        (() => conjunto && dificuldade && aoTreinar(conjunto, dificuldade))
      }
      desabilitado={!dificuldade}
    />
  )
  const filtros = !!todos.length && (
    <FiltrosDaBiblioteca
      texto={texto}
      aoMudarTexto={setTexto}
      placeholder="Buscar na biblioteca"
      rotuloDoCampo="Filtrar mapas"
      ordens={ORDENS}
      ordem={ordem}
      aoMudarOrdem={setOrdem}
      soFavoritas={soFavoritas}
      aoAlternarFavoritas={() => setSoFavoritas((ligado) => !ligado)}
    >
      {opcoesDeTeclas.length > 1 && (
        <GrupoDeOpcoes
          titulo="Teclas"
          tituloEscondido
          opcoes={[
            { id: "todas", rotulo: "Todas" },
            ...opcoesDeTeclas.map((t) => ({
              id: String(t),
              rotulo: `${t}K`,
            })),
          ]}
          valor={String(teclas)}
          aoEscolher={(valor) =>
            setTeclas(valor === "todas" ? "todas" : Number(valor))
          }
        />
      )}
    </FiltrosDaBiblioteca>
  )
  const roda = (
    <>
      {conjuntos === null && (
        <p className="text-texto-suave">Abrindo a biblioteca…</p>
      )}
      {conjuntos?.length === 0 && (
        <AvisoDaLista>
          Nenhum mapa ainda. Arraste um .osz para cá ou use o botão de
          importar.
        </AvisoDaLista>
      )}
      {!!todos.length && !lista.length && (
        <AvisoDaLista>Nenhum mapa com esse filtro.</AvisoDaLista>
      )}
      {!!lista.length && (
        <Carrossel
          className="flex-1"
          rotulo="Mapas"
          itens={itens}
          indice={indice}
          dificuldade={dificuldade?.hash ?? ""}
          dificuldades={dificuldades}
          aoEscolherItem={escolher}
          aoEscolherDificuldade={setHash}
          aoJogar={jogar}
          menuDaSelecionada={
            aoRemover &&
            conjunto && (
              <MenuDeApagar
                nome={conjunto.tituloUnicode || conjunto.titulo}
                rotuloDoItem="Apagar mapa"
                descricao="O mapa e os arquivos salvos serão apagados deste aparelho. Isso não pode ser desfeito."
                menuAberto={menuAberto}
                aoMudarMenu={setMenuAberto}
                confirmando={removendo}
                aoMudarConfirmando={setRemovendo}
                aoConfirmar={() => aoRemover(conjunto)}
              />
            )
          }
        />
      )}
    </>
  )

  return (
    <section
      aria-label="Seleção de mapas"
      onDragOver={(e) => {
        e.preventDefault()
        setArrastando(true)
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltar}
      className={cn(
        "relative isolate flex h-full flex-col",
        arrastando &&
          "outline-2 outline-dashed outline-primaria -outline-offset-8",
      )}
    >
      {estreita ? (
        <SelecaoNoCelular
          fundo={fundo}
          cabecalho={cabecalho}
          filtros={filtros}
          lista={roda}
          titulo={conjunto ? conjunto.tituloUnicode || conjunto.titulo : undefined}
          subtitulo={
            conjunto &&
            `${conjunto.artistaUnicode || conjunto.artista} · mapa de ${conjunto.mapper}`
          }
          capa={conjunto && <CapaDoConjunto conjunto={conjunto} />}
          favoritar={
            conjunto && (
              <BotaoDeFavoritar
                favorita={favorita}
                aoAlternar={alternarFavoritaAtual}
              />
            )
          }
          detalhes={detalhes}
          ranking={ranking || undefined}
          tocar={tocar}
        />
      ) : (
        <>
          {fundo}
          <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 p-6">
            <aside className="col-span-5 flex min-h-0 flex-col gap-4">
              {cabecalho}

              {conjunto && (
                <TituloDaSelecao
                  titulo={conjunto.tituloUnicode || conjunto.titulo}
                  subtitulo={`${conjunto.artistaUnicode || conjunto.artista} · mapa de ${conjunto.mapper}`}
                  aviso={
                    conjunto.origem === "importado" &&
                    "Importado · sem XP nem ranking"
                  }
                  faixa={<CapaDoConjunto conjunto={conjunto} />}
                  favoritar={
                    <BotaoDeFavoritar
                      favorita={favorita}
                      aoAlternar={alternarFavoritaAtual}
                    />
                  }
                />
              )}

              {conjunto && (
                // Como no Rock: o ranking ao lado da roda e os números da dificuldade na aba vizinha.
                <Tabs
                  key={ranking ? "com-ranking" : "sem-ranking"}
                  defaultValue={ranking ? "ranking" : "detalhes"}
                  className="min-h-0 flex-1"
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="detalhes">
                      <Info className="opacity-70" /> Detalhes
                    </TabsTrigger>
                    <TabsTrigger value="ranking">
                      <ListOrdered className="opacity-70" /> Ranking
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="detalhes"
                    className="min-h-0 overflow-y-auto"
                  >
                    {detalhes}
                  </TabsContent>
                  <TabsContent
                    value="ranking"
                    className="flex min-h-0 flex-col overflow-y-auto"
                  >
                    {ranking || (
                      <p className="chapa bg-superficie-elevada/90 p-4 text-texto-suave">
                        Só os mapas baixados pela busca do osu! têm ranking.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              )}
              {!conjunto && <div className="flex-1" />}

              {tocar}
            </aside>

            <div className="col-span-6 col-start-7 flex min-h-0 flex-col gap-4">
              {filtros}
              {roda}
            </div>
          </div>
          <RodapeDeComandos comandos={COMANDOS} />
        </>
      )}
    </section>
  )
}
