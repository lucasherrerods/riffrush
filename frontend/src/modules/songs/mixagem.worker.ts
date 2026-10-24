import { mixarFaixas, type PedidoDeMixagem } from "./mixagem";

self.onmessage = (evento: MessageEvent<PedidoDeMixagem>) => {
  const saida = mixarFaixas(evento.data.faixas, evento.data.taxa);
  self.postMessage(saida, { transfer: saida.map((canal) => canal.buffer) });
};
