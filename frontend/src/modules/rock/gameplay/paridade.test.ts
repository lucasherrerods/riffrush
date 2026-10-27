import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Nota } from "@/modules/rock/songs";
import { avancar, criarPartida } from "./partida";
import { aplicarEntradas, desempacotarReplay } from "./replay";

/** Os mesmos casos que o motor em Rust da API confere em `backend/motor/tests/paridade.rs`. */
const casos: { notas: Nota[]; replay: string; fim: number; esperado: unknown }[] = JSON.parse(readFileSync(resolve(process.cwd(), "../backend/motor/tests/paridade.json"), "utf8"));

describe("paridade com o motor da API", () => {
  casos.forEach((caso, i) => it(`o caso ${i} dá o resultado gravado`, async () => {
    const replay = await desempacotarReplay(Uint8Array.from(Buffer.from(caso.replay, "base64")));
    const partida = criarPartida(caso.notas, { semFalha: replay.semFalha, fantasma: replay.fantasma, velocidade: replay.velocidade, semAberta: replay.semAberta });
    aplicarEntradas(partida, replay.entradas, 0, Infinity, []);
    avancar(partida, caso.fim);
    const { pontos, acertos, erros, julgamentos, valorDosAcertos, sequencia, maiorSequencia, vida, estrelaEmTicks, estrelaAtiva, derrota, fantasma } = partida;
    expect({ pontos, acertos, erros, julgamentos, valorDosAcertos, sequencia, maiorSequencia, vida, estrelaEmTicks, estrelaAtiva, derrota, fantasma }).toEqual(caso.esperado);
  }));
});
