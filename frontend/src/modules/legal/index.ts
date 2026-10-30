import { adiar } from "@/shared/lib/adiar";
export { documentoDoEndereco, type Documento } from "./documentos";
export const TelaDeDocumento = adiar(() => import("./TelaDeDocumento").then((m) => m.TelaDeDocumento));
