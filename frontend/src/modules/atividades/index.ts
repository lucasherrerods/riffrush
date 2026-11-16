import { adiar } from "@/shared/lib/adiar";
export const TelaDeAtividades = adiar(() => import("./TelaDeAtividades").then((m) => m.TelaDeAtividades));
