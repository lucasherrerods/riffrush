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
    bot: c.bot,
    efeitos: c.efeitos,
    personagem: c.personagem3d,
    mostrarFps: c.mostrarFps,
  };
}
