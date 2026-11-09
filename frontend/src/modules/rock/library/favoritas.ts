import { carregarFavoritas as carregarDaChave } from "@/modules/selecao";

/** Onde as favoritas do Rock ficam guardadas. */
export const CHAVE_DAS_FAVORITAS = "riffrush:favoritas";

export const carregarFavoritas = () => carregarDaChave(CHAVE_DAS_FAVORITAS);
