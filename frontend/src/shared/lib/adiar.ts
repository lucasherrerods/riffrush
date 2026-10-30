import { lazy, type ComponentType } from "react";

/**
 * Uma tela que só é baixada quando aparece pela primeira vez: tira o código dela da abertura do jogo.
 * O módulo dono exporta a tela por aqui no `index.ts`, então quem usa continua importando do mesmo lugar.
 * Quem mostra a tela precisa de um `Suspense` acima.
 */
export function adiar<P extends object>(carregar: () => Promise<ComponentType<P>>) {
  return lazy(async () => ({ default: await carregar() }));
}
