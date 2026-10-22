/** WebSocket de mentira: guarda o que foi enviado e deixa o teste simular o servidor. */
export class WebSocketFalso {
  static OPEN = 1;
  static ultimo: WebSocketFalso | null = null;
  readyState = 0;
  enviadas: unknown[] = [];
  fechado = false;
  onopen: (() => void) | null = null;
  onmessage: ((evento: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    WebSocketFalso.ultimo = this;
  }

  abrir() {
    this.readyState = WebSocketFalso.OPEN;
    this.onopen?.();
  }

  /** Simula o servidor entregando `msg`, enviada pelo jogador `de`. */
  receber(de: number, msg: object) {
    this.onmessage?.({ data: JSON.stringify({ de, msg }) });
  }

  send(texto: string) {
    this.enviadas.push(JSON.parse(texto));
  }

  close() {
    this.fechado = true;
    this.readyState = 3;
    this.onclose?.();
  }

  falhar() {
    this.onerror?.();
    this.onclose?.();
  }
}
