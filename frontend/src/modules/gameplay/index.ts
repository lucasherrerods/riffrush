export { criarBot, jogarSozinho, type Bot } from "./bot";
export { CORES_DAS_PISTAS, CORES_DO_MULTIPLICADOR, COR_DA_ABERTA, COR_DA_ESTRELA, NOMES_DAS_PISTAS } from "./cores";
export {
  JANELA_DE_ACERTO,
  ativarEstrela,
  avancar,
  criarPartida,
  iniciarMotor,
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
export { resultadoDaPartida, type Resultado } from "./resultado";
export { codigoDaEntrada, desempacotarReplay, emTicks, entradaDoCodigo, hashDoChart, type EntradaDoReplay, type EventoDaTransmissao, type Replay } from "./replay";
export type { EstadoDoJogador } from "./rede";
export { OPCOES_PADRAO_DA_PARTIDA, TelaDeJogo, type OpcoesDaPartida } from "./TelaDeJogo";
export { EntradaDaPartida } from "./componentes/EntradaDaPartida";
export { MedidorDeVida } from "./componentes/MedidorDeVida";
export { corDaPrecisao } from "./componentes/PainelDePontos";
export { estrelasPorPontos, progressoDasEstrelas } from "./estrelas";
export { criarSprites } from "./pista/sprites";
