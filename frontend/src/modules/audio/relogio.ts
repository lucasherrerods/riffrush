/** O que o relógio precisa saber do AudioContext. */
export interface EstadoDoAudio {
  state: AudioContextState;
  currentTime: number;
  outputLatency: number;
  baseLatency: number;
  timestamp?: { contextTime?: number; performanceTime?: number };
}

const ATRASO_MAXIMO_DO_EVENTO = 0.1;
/** Mais longe do currentTime que isso, o timestamp é de antes de uma pausa e não vale. */
const DESVIO_MAXIMO_DO_TIMESTAMP = 0.2;

/**
 * Posição do áudio que está saindo no alto-falante agora, em segundos.
 * O currentTime anda em blocos de ~10 ms e não desconta a latência de saída.
 */
export function tempoDeSaida(audio: EstadoDoAudio, agoraPerformance: number) {
  const { contextTime, performanceTime } = audio.timestamp ?? {};
  const peloCurrentTime = audio.currentTime - (audio.outputLatency || audio.baseLatency || 0);
  if (audio.state === "running" && contextTime && performanceTime) {
    const peloTimestamp = contextTime + (agoraPerformance - performanceTime) / 1000;
    if (Math.abs(peloTimestamp - peloCurrentTime) <= DESVIO_MAXIMO_DO_TIMESTAMP) return peloTimestamp;
  }
  return peloCurrentTime;
}

/** Instante em que o evento de input aconteceu, no relógio do áudio. */
export function tempoDoEvento(tempoAudioAgora: number, agoraPerformance: number, timestampDoEvento: number) {
  const atraso = Math.max(0, agoraPerformance - timestampDoEvento) / 1000;
  return tempoAudioAgora - Math.min(atraso, ATRASO_MAXIMO_DO_EVENTO);
}

function estadoDe(contexto: AudioContext): EstadoDoAudio {
  return {
    state: contexto.state,
    currentTime: contexto.currentTime,
    outputLatency: contexto.outputLatency,
    baseLatency: contexto.baseLatency,
    timestamp: contexto.getOutputTimestamp?.(),
  };
}

export function agoraNoAudio(contexto: AudioContext) {
  return tempoDeSaida(estadoDe(contexto), performance.now());
}

export function momentoDoEvento(contexto: AudioContext, evento: Event) {
  const agora = performance.now();
  return tempoDoEvento(tempoDeSaida(estadoDe(contexto), agora), agora, evento.timeStamp);
}
