import { PISTA_ABERTA } from "@/modules/songs";
import { cores, temaAtivo } from "@/shared/styles/tokens";

/** Cores dos 5 trastes, como no Guitar Hero: verde, vermelho, amarelo, azul e laranja. Vêm da skin do tema. */
export const CORES_DAS_PISTAS = temaAtivo.pista.trastes;
export const NOMES_DAS_PISTAS = ["Verde", "Vermelho", "Amarelo", "Azul", "Laranja"];
/** A nota aberta é roxa, como no Clone Hero. */
export const COR_DA_ABERTA = temaAtivo.pista.aberta;
export const corDaPista = (pista: number) => (pista === PISTA_ABERTA ? COR_DA_ABERTA : CORES_DAS_PISTAS[pista]);
export const COR_DA_ESTRELA = cores.estrela;
export const COR_DA_NOTA_DE_ESTRELA = temaAtivo.pista.notaDeEstrela;
export const CORES_DO_MULTIPLICADOR = temaAtivo.pista.multiplicador;
export const COR_DA_NOTA_PERDIDA = temaAtivo.pista.notaPerdida;
export const TRILHO_DA_ESTRELA = temaAtivo.pista.trilhoDaEstrela;
