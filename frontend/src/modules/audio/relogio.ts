/** O que o relógio precisa saber do AudioContext. */
export interface EstadoDoAudio {
  state: AudioContextState;
  currentTime: number;
  outputLatency: number;
  baseLatency: number;
  timestamp?: { contextTime?: number; performanceTime?: number };
}

const ATRASO_MAXIMO_DO_EVENTO = 0.1;

/**
 * Posição do áudio que está saindo no alto-falante agora, em segundos.
 * O currentTime anda em blocos de ~10 ms e não desconta a latência de saída.
 */
export function tempoDeSaida(audio: EstadoDoAudio, agoraPerformance: number) {
  const { contextTime, performanceTime } = audio.timestamp ?? {};
  if (audio.state === "running" && contextTime && performanceTime) {
    return contextTime + (agoraPerformance - performanceTime) / 1000;
  }
  return audio.currentTime - (audio.outputLatency || audio.baseLatency || 0);
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
