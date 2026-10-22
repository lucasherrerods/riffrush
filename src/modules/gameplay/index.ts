export { criarBot, jogarSozinho, type Bot } from "./bot";
export { CORES_DAS_PISTAS, CORES_DO_MULTIPLICADOR, COR_DA_ESTRELA } from "./cores";
export {
  JANELA_DE_ACERTO,
  ativarEstrela,
  avancar,
  criarPartida,
  multiplicador,
  retirarEventos,
  soltar,
  tocar,
  type Evento,
  type NotaEmJogo,
  type Partida,
} from "./partida";
export { desenharPista, type Cena, type Sprites } from "./pista/desenhar";
export { layoutDaPista, type LayoutDaPista } from "./pista/geometria";
export { criarSprites } from "./pista/sprites";
