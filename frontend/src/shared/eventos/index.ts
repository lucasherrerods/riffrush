import { escolherEvento } from "./calendario";

export { EVENTOS, escolherEvento, eventoDoDia, estaNoPeriodo, type Evento, type Periodo } from "./calendario";
export { DecoracaoDoEvento } from "./DecoracaoDoEvento";

/** O evento de agora, decidido uma vez ao abrir o app. `?evento=natal` força um, `?evento=nenhum` desliga. */
export const eventoAtual = escolherEvento(new Date(), typeof location === "undefined" ? null : new URLSearchParams(location.search).get("evento"));
