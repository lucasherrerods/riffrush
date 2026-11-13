import { NOMES_DOS_JEITOS, type JeitoDeJogar } from "@/modules/rock/gameplay";

/**
 * Tapping e gamepad disputam o mesmo ranking: o gamepad só compensa a velocidade do controle.
 * A API junta os dois; aqui o par é pedido sempre como "gamepad", para a escolha ficar marcada.
 */
export const rankingDoJeito = (jeito: JeitoDeJogar): JeitoDeJogar => (jeito === "palhetada" ? "palhetada" : "gamepad");

export const OPCOES_DOS_JEITOS: { id: JeitoDeJogar; rotulo: string }[] = [
  { id: "gamepad", rotulo: `${NOMES_DOS_JEITOS.tapping} e ${NOMES_DOS_JEITOS.gamepad}` },
  { id: "palhetada", rotulo: NOMES_DOS_JEITOS.palhetada },
];
