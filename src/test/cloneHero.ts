const texto = new TextEncoder();

const u64 = (n: number) => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(n), true);
  return bytes;
};
const i32 = (n: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, n, true);
  return bytes;
};

export function juntar(partes: Uint8Array[]) {
  const saida = new Uint8Array(partes.reduce((total, p) => total + p.length, 0));
  let posicao = 0;
  for (const parte of partes) {
    saida.set(parte, posicao);
    posicao += parte.length;
  }
  return saida;
}

/** Monta um .sng (pacote do Clone Hero) com a máscara XOR, como o formato oficial. */
export function construirSng(metadados: Record<string, string>, arquivos: Record<string, Uint8Array>) {
  const mascara = Uint8Array.from({ length: 16 }, (_, i) => (i * 37 + 11) & 0xff);
  const cabecalho = juntar([texto.encode("SNGPKG"), i32(1), mascara]);
  const corpoDosMetadados = juntar(
    Object.entries(metadados).flatMap(([chave, valor]) => [
      i32(texto.encode(chave).length),
      texto.encode(chave),
      i32(texto.encode(valor).length),
      texto.encode(valor),
    ]),
  );
  const metadadosSecao = juntar([u64(corpoDosMetadados.length + 8), u64(Object.keys(metadados).length), corpoDosMetadados]);
  const nomes = Object.keys(arquivos);
  const tamanhoDoIndice = 8 + nomes.reduce((total, nome) => total + 1 + texto.encode(nome).length + 16, 0);
  let posicao = cabecalho.length + metadadosSecao.length + 8 + tamanhoDoIndice + 8;
  const entradas: Uint8Array[] = [];
  const dados: Uint8Array[] = [];
  for (const nome of nomes) {
    const conteudo = arquivos[nome];
    entradas.push(Uint8Array.of(texto.encode(nome).length), texto.encode(nome), u64(conteudo.length), u64(posicao));
    const mascarado = conteudo.slice();
    for (let j = 0; j < mascarado.length; j++) mascarado[j] ^= mascara[j & 15] ^ (j & 0xff);
    dados.push(mascarado);
    posicao += conteudo.length;
  }
  const indice = juntar([u64(tamanhoDoIndice), u64(nomes.length), ...entradas]);
  const totalDeDados = dados.reduce((total, d) => total + d.length, 0);
  return juntar([cabecalho, metadadosSecao, indice, u64(totalDeDados), ...dados]);
}

const quantidadeVariavel = (n: number) => {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
};

export interface EventoMidi {
  delta: number;
  bytes: number[];
}

const faixa = (eventos: EventoMidi[]) => {
  const corpo = Uint8Array.from(eventos.flatMap((e) => [...quantidadeVariavel(e.delta), ...e.bytes]));
  const cabecalho = new Uint8Array(8);
  cabecalho.set(texto.encode("MTrk"));
  new DataView(cabecalho.buffer).setUint32(4, corpo.length);
  return juntar([cabecalho, corpo]);
};

export const nomeDaFaixa = (nome: string): EventoMidi => ({ delta: 0, bytes: [0xff, 0x03, nome.length, ...texto.encode(nome)] });
export const andamento = (microssegundosPorSeminima: number, delta = 0): EventoMidi => ({
  delta,
  bytes: [0xff, 0x51, 3, (microssegundosPorSeminima >> 16) & 0xff, (microssegundosPorSeminima >> 8) & 0xff, microssegundosPorSeminima & 0xff],
});
export const notaLigada = (delta: number, nota: number): EventoMidi => ({ delta, bytes: [0x90, nota, 100] });
export const notaDesligada = (delta: number, nota: number): EventoMidi => ({ delta, bytes: [0x80, nota, 0] });

/** Monta um notes.mid (formato 1) com uma faixa de andamento e as faixas pedidas. */
export function construirMidi(resolucao: number, faixaDeAndamento: EventoMidi[], ...faixas: EventoMidi[][]) {
  const fim: EventoMidi = { delta: 0, bytes: [0xff, 0x2f, 0] };
  const cabecalho = new Uint8Array(14);
  cabecalho.set(texto.encode("MThd"));
  const vista = new DataView(cabecalho.buffer);
  vista.setUint32(4, 6);
  vista.setUint16(8, 1);
  vista.setUint16(10, faixas.length + 1);
  vista.setUint16(12, resolucao);
  return juntar([cabecalho, faixa([...faixaDeAndamento, fim]), ...faixas.map((f) => faixa([...f, fim]))]);
}

/** Um WAV mono de 16 bits com um tom constante. */
export function construirWav(segundos: number, frequencia: number, taxa = 8000) {
  const total = Math.floor(segundos * taxa);
  const buffer = new ArrayBuffer(44 + total * 2);
  const vista = new DataView(buffer);
  const escrever = (posicao: number, s: string) => [...s].forEach((c, i) => vista.setUint8(posicao + i, c.charCodeAt(0)));
  escrever(0, "RIFF");
  vista.setUint32(4, 36 + total * 2, true);
  escrever(8, "WAVEfmt ");
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true);
  vista.setUint16(22, 1, true);
  vista.setUint32(24, taxa, true);
  vista.setUint32(28, taxa * 2, true);
  vista.setUint16(32, 2, true);
  vista.setUint16(34, 16, true);
  escrever(36, "data");
  vista.setUint32(40, total * 2, true);
  for (let i = 0; i < total; i++) vista.setInt16(44 + i * 2, Math.sin((2 * Math.PI * frequencia * i) / taxa) * 8000, true);
  return new Uint8Array(buffer);
}
