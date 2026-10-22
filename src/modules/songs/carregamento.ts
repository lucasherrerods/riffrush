import { obterContextoDeAudio } from "@/modules/audio";
import { chartDaMelodia } from "./chart";
import { chartDoAudio } from "./chartAutomatico";
import { escolherDificuldade, lerChart, lerMidi, lerSng, type ChartLido, type PacoteSng } from "./cloneHero";
import { compor, type Composicao } from "./composicao";
import { mixarFaixas } from "./mixagem";
import { sintetizar, TAXA_DE_AMOSTRAGEM } from "./sintetizador";
import type { Batida, Dificuldade, Musica, MusicaCarregada } from "./tipos";

const AUDIO_DO_SNG = /^(song|guitar|bass|rhythm|keys|vocals?|vocals_\d|drums(_\d)?|backing)\.(opus|ogg|mp3|wav)$/;
const CAPA_DO_SNG = /^album\.(jpe?g|png)$/;
const VIDEO_DO_SNG = /^(video|background)\.(mp4|webm)$/;
const BATIDA_DOS_AUDIOS_IMPORTADOS = 0.5;

export function ehVideo(arquivo: File) {
  return arquivo.type.startsWith("video/") || /\.(mp4|webm|mkv|mov)$/i.test(arquivo.name);
}

export function ehSng(arquivo: File) {
  return /\.sng$/i.test(arquivo.name);
}

function criarAudio(canais: Float32Array<ArrayBuffer>[], taxa: number) {
  const audio = obterContextoDeAudio().createBuffer(canais.length, canais[0].length, taxa);
  canais.forEach((canal, i) => audio.copyToChannel(canal, i));
  return audio;
}

function batidasRegulares(duracao: number, intervalo: number, primeiraForte: number): Batida[] {
  const batidas: Batida[] = [];
  for (let i = 0; i * intervalo <= duracao; i++) batidas.push({ tempo: i * intervalo, forte: (i - primeiraForte) % 4 === 0 });
  return batidas;
}

const embutidas = new Map<string, Promise<{ composicao: Composicao; audio: AudioBuffer }>>();

async function carregarEmbutida(musica: Musica, dificuldade: Dificuldade): Promise<MusicaCarregada> {
  let pronta = embutidas.get(musica.id);
  if (!pronta) {
    pronta = Promise.resolve().then(() => {
      const composicao = compor(musica.estilo!, musica.semente ?? 1);
      return { composicao, audio: criarAudio([sintetizar(musica.estilo!, composicao)], TAXA_DE_AMOSTRAGEM) };
    });
    embutidas.set(musica.id, pronta);
  }
  const { composicao, audio } = await pronta;
  const batida = 60 / musica.bpm;
  return {
    audio,
    notas: chartDaMelodia(composicao.melodia, dificuldade, batida),
    // Os compassos começam depois de 2 batidas de entrada.
    batidas: batidasRegulares(composicao.duracao, batida, 2),
    duracao: composicao.duracao,
  };
}

const pacotes = new Map<string, Promise<{ pacote: PacoteSng; chart: ChartLido; audio: AudioBuffer }>>();

/** Abre o .sng uma vez só: lê o pacote, o chart e mistura as faixas de áudio. */
function abrirSng(musica: Musica) {
  let aberto = pacotes.get(musica.id);
  if (!aberto) {
    aberto = (async () => {
      const pacote = lerSng(await musica.arquivo!.arrayBuffer());
      const texto = pacote.arquivos.get("notes.chart");
      const midi = pacote.arquivos.get("notes.mid");
      if (!texto && !midi) throw new Error("O .sng não tem chart (notes.chart ou notes.mid).");
      const chart = texto ? lerChart(new TextDecoder().decode(texto)) : lerMidi(midi!);
      const faixas = [...pacote.arquivos].filter(([nome]) => AUDIO_DO_SNG.test(nome));
      if (!faixas.length) throw new Error("O .sng não tem áudio.");
      const contexto = obterContextoDeAudio();
      const decodificadas = await Promise.all(faixas.map(([, bytes]) => contexto.decodeAudioData(bytes.slice().buffer)));
      const taxa = decodificadas[0].sampleRate;
      const mix = mixarFaixas(
        decodificadas.map((a) => ({ taxa: a.sampleRate, canais: Array.from({ length: a.numberOfChannels }, (_, c) => a.getChannelData(c)) })),
        taxa,
      );
      return { pacote, chart, audio: criarAudio(mix, taxa) };
    })();
    pacotes.set(musica.id, aberto);
    aberto.catch(() => pacotes.delete(musica.id));
  }
  return aberto;
}

async function carregarSng(musica: Musica, dificuldade: Dificuldade): Promise<MusicaCarregada> {
  const { pacote, chart, audio } = await abrirSng(musica);
  // "delay" do song.ini: quanto o áudio atrasa em relação ao chart.
  const atraso = (Number(pacote.metadados.delay) || 0) / 1000;
  return {
    audio,
    notas: escolherDificuldade(chart, dificuldade).map((n) => ({ ...n, tempo: n.tempo - atraso })),
    batidas: chart.mapa.batidas(audio.duration + atraso).map((b) => ({ ...b, tempo: b.tempo - atraso })),
    duracao: audio.duration,
  };
}

const decodificados = new Map<string, Promise<AudioBuffer>>();

async function carregarAudioImportado(musica: Musica, dificuldade: Dificuldade): Promise<MusicaCarregada> {
  let decodificado = decodificados.get(musica.id);
  if (!decodificado) {
    decodificado = musica.arquivo!.arrayBuffer().then((bytes) => obterContextoDeAudio().decodeAudioData(bytes));
    decodificados.set(musica.id, decodificado);
  }
  const audio = await decodificado;
  return {
    audio,
    notas: chartDoAudio(audio.getChannelData(0), audio.sampleRate, dificuldade),
    batidas: batidasRegulares(audio.duration, BATIDA_DOS_AUDIOS_IMPORTADOS, 0),
    duracao: audio.duration,
  };
}

export function carregarMusica(musica: Musica, dificuldade: Dificuldade) {
  if (!musica.arquivo) return carregarEmbutida(musica, dificuldade);
  return musica.sng ? carregarSng(musica, dificuldade) : carregarAudioImportado(musica, dificuldade);
}

function musicaDoNome(arquivo: File): Musica {
  const nome = arquivo.name.replace(/\.[^.]+$/, "");
  const [artista, titulo] = nome.includes(" - ") ? nome.split(" - ", 2) : ["Importada", nome];
  return {
    id: `arquivo:${arquivo.name}:${arquivo.size}`,
    titulo: titulo.trim(),
    artista: artista.trim(),
    genero: ehVideo(arquivo) ? "Clipe" : "Sua música",
    bpm: 0,
    capa: ["#14b8a6", "#1a1722"],
    intensidade: 3,
    arquivo,
    video: ehVideo(arquivo),
  };
}

/** Importa um áudio, um clipe ou um .sng. O .sng traz nome, artista, capa e vídeo de dentro do pacote. */
export async function importarArquivo(arquivo: File): Promise<Musica> {
  const base = musicaDoNome(arquivo);
  if (!ehSng(arquivo)) return base;
  const musica: Musica = { ...base, sng: true, genero: "Clone Hero", capa: ["#f59e0b", "#7c2d12"] };
  const { pacote, chart } = await abrirSng(musica);
  const { metadados, arquivos } = pacote;
  const capa = [...arquivos].find(([nome]) => CAPA_DO_SNG.test(nome));
  const video = [...arquivos].find(([nome]) => VIDEO_DO_SNG.test(nome));
  return {
    ...musica,
    titulo: metadados.name || base.titulo,
    artista: metadados.artist || base.artista,
    genero: metadados.genre || musica.genero,
    intensidade: Math.max(1, Math.min(5, Number(metadados.diff_guitar) + 1 || Object.keys(chart.notas).length + 1)),
    imagemDeCapa: capa ? URL.createObjectURL(new Blob([capa[1].slice()])) : undefined,
    video: !!video,
    arquivoDeVideo: video ? new Blob([video[1].slice()], { type: video[0].endsWith("webm") ? "video/webm" : "video/mp4" }) : undefined,
  };
}
