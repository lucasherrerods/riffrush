import type { OpcoesDaPartida } from "@/modules/gameplay";
import { antecedenciaDasNotas, nomeDaTecla, type Configuracoes } from "@/modules/settings";

/** A partida não conhece as configurações: o App traduz o que ela precisa. */
export function opcoesDaPartida(c: Configuracoes): OpcoesDaPartida {
  return {
    teclas: c.teclas,
    teclaDaEstrela: c.teclaDaEstrela,
    rotuloDaTeclaDaEstrela: nomeDaTecla(c.teclaDaEstrela),
    antecedencia: antecedenciaDasNotas(c.velocidade),
    volumeDaMusica: c.volumeDaMusica,
    volumeDosEfeitos: c.volumeDosEfeitos,
    atrasoMs: c.atrasoMs,
    semFalha: c.semFalha,
    velocidadeDaMusica: c.velocidadeDaMusica,
    bot: c.bot,
    efeitos: c.efeitos,
    personagem: c.personagem3d,
    mostrarFps: c.mostrarFps,
    qualidadeDoPalco: c.qualidadeDoPalco,
    modoCompetitivo: c.modoCompetitivo,
  };
}

const iguais = (a: unknown, b: unknown) =>
  Object.is(a, b) || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => Object.is(item, b[i])));

/** Opções com o mesmo conteúdo: a partida só deve receber um objeto novo quando algo dela mudou de verdade. */
export function mesmasOpcoes(a: OpcoesDaPartida, b: OpcoesDaPartida) {
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof OpcoesDaPartida>;
  return [...chaves].every((chave) => iguais(a[chave], b[chave]));
}
