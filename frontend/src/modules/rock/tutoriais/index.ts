import { adiar } from "@/shared/lib/adiar";
/** Só carrega quando alguém abre os tutoriais: o texto e as demonstrações não pesam na abertura do menu. */
export const ModalDeTutoriais = adiar(() => import("./ModalDeTutoriais").then((m) => m.ModalDeTutoriais));
