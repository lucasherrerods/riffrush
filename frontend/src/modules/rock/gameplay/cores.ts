import { PISTA_ABERTA } from "@/modules/rock/songs";
import { TEMA_DO_ROCK, cores } from "@/modules/rock/tema";

/** Cores dos 5 trastes, como no Guitar Hero: verde, vermelho, amarelo, azul e laranja. Vêm da skin do tema. */
export const CORES_DAS_PISTAS = TEMA_DO_ROCK.pista.trastes;
export const NOMES_DAS_PISTAS = ["Verde", "Vermelho", "Amarelo", "Azul", "Laranja"];
/** A nota aberta é roxa, como no Clone Hero. */
export const COR_DA_ABERTA = TEMA_DO_ROCK.pista.aberta;
export const corDaPista = (pista: number) => (pista === PISTA_ABERTA ? COR_DA_ABERTA : CORES_DAS_PISTAS[pista]);
export const COR_DA_ESTRELA = cores.estrela;
export const COR_DA_NOTA_DE_ESTRELA = TEMA_DO_ROCK.pista.notaDeEstrela;
export const CORES_DO_MULTIPLICADOR = TEMA_DO_ROCK.pista.multiplicador;
export const COR_DA_NOTA_PERDIDA = TEMA_DO_ROCK.pista.notaPerdida;
export const TRILHO_DA_ESTRELA = TEMA_DO_ROCK.pista.trilhoDaEstrela;
