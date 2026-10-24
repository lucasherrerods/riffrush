import { obterContextoDeAudio } from "@/modules/audio";
import { chartDoAudio } from "./chartAutomatico";
import { dificuldadesDoChart, escolherDificuldade, lerChart, lerMidi, lerSng, type ChartLido, type PacoteSng } from "./cloneHero";
import { mixarFaixas } from "./mixagem";
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

export type AoProgredir = (fracao: number) => void;

/** Lê o arquivo aos pedaços, avisando quanto já leu. Sem leitura em partes, lê de uma vez. */
async function lerComProgresso(arquivo: Blob, aoProgredir: AoProgredir): Promise<ArrayBuffer> {
  if (typeof arquivo.stream !== "function" || !arquivo.size) {
    const bytes = await arquivo.arrayBuffer();
    aoProgredir(1);
    return bytes;
  }
  const leitor = arquivo.stream().getReader();
  const bytes = new Uint8Array(arquivo.size);
  let lidos = 0;
  for (let pedaco = await leitor.read(); !pedaco.done; pedaco = await leitor.read()) {
    bytes.set(pedaco.value, lidos);
    lidos += pedaco.value.length;
    aoProgredir(lidos / arquivo.size);
  }
  return bytes.buffer;
}

/** No .sng, ler o arquivo é metade do trabalho; decodificar as faixas é a outra metade. */
const PESO_DA_LEITURA = 0.5;

const pacotes = new Map<string, Promise<{ pacote: PacoteSng; chart: ChartLido; audio: AudioBuffer }>>();

/** Abre o .sng uma vez só: lê o pacote, o chart e mistura as faixas de áudio. */
function abrirSng(musica: Musica, aoProgredir: AoProgredir = () => {}) {
  let aberto = pacotes.get(musica.id);
  if (!aberto) {
    aberto = (async () => {
      const pacote = lerSng(await lerComProgresso(musica.arquivo!, (fracao) => aoProgredir(fracao * PESO_DA_LEITURA)));
      const texto = pacote.arquivos.get("notes.chart");
      const midi = pacote.arquivos.get("notes.mid");
      if (!texto && !midi) throw new Error("O .sng não tem chart (notes.chart ou notes.mid).");
      const chart = texto ? lerChart(new TextDecoder().decode(texto)) : lerMidi(midi!);
      if (!dificuldadesDoChart(chart).length) throw new Error("O chart não tem notas de guitarra.");
      const faixas = [...pacote.arquivos].filter(([nome]) => AUDIO_DO_SNG.test(nome));
      if (!faixas.length) throw new Error("O .sng não tem áudio.");
      const contexto = obterContextoDeAudio();
      let prontas = 0;
      const decodificadas = await Promise.all(
        faixas.map(async ([, bytes]) => {
          const audio = await contexto.decodeAudioData(bytes.slice().buffer);
          aoProgredir(PESO_DA_LEITURA + (1 - PESO_DA_LEITURA) * (++prontas / faixas.length));
          return audio;
        }),
      );
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

/** Áudio comum, importado ou embutido no jogo: decodifica uma vez e gera o chart pelos ataques do som. */
async function carregarAudio(musica: Musica, bytes: () => Promise<ArrayBuffer>, dificuldade: Dificuldade): Promise<MusicaCarregada> {
  let decodificado = decodificados.get(musica.id);
  if (!decodificado) {
    decodificado = bytes().then((lidos) => obterContextoDeAudio().decodeAudioData(lidos));
    decodificados.set(musica.id, decodificado);
    decodificado.catch(() => decodificados.delete(musica.id));
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
  const { arquivo, audioEmbutido } = musica;
  if (arquivo) return musica.sng ? carregarSng(musica, dificuldade) : carregarAudio(musica, () => arquivo.arrayBuffer(), dificuldade);
  if (!audioEmbutido) throw new Error(`${musica.titulo} não tem áudio.`);
  return carregarAudio(musica, async () => (await (await fetch(audioEmbutido)).blob()).arrayBuffer(), dificuldade);
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

/**
 * Importa um áudio, um clipe ou um .sng. O .sng traz nome, artista, capa e vídeo de dentro do pacote.
 * Áudio e clipe só são lidos na hora de tocar, então terminam na hora.
 */
export async function importarArquivo(arquivo: File, aoProgredir: AoProgredir = () => {}): Promise<Musica> {
  const base = musicaDoNome(arquivo);
  if (!ehSng(arquivo)) {
    aoProgredir(1);
    return base;
  }
  const musica: Musica = { ...base, sng: true, genero: "Clone Hero", capa: ["#f59e0b", "#7c2d12"] };
  const { pacote, chart } = await abrirSng(musica, aoProgredir);
  aoProgredir(1);
  const { metadados, arquivos } = pacote;
  const capa = [...arquivos].find(([nome]) => CAPA_DO_SNG.test(nome));
  const video = [...arquivos].find(([nome]) => VIDEO_DO_SNG.test(nome));
  return {
    ...musica,
    titulo: metadados.name || base.titulo,
    artista: metadados.artist || base.artista,
    genero: metadados.genre || musica.genero,
    intensidade: Math.max(1, Math.min(5, Number(metadados.diff_guitar) + 1 || Object.keys(chart.notas).length + 1)),
    dificuldades: dificuldadesDoChart(chart),
    imagemDeCapa: capa ? URL.createObjectURL(new Blob([capa[1].slice()])) : undefined,
    video: !!video,
    arquivoDeVideo: video ? new Blob([video[1].slice()], { type: video[0].endsWith("webm") ? "video/webm" : "video/mp4" }) : undefined,
  };
}
