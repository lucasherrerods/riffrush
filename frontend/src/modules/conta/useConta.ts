import { useSyncExternalStore } from "react";
import { sessaoDaConta } from "./sessao";

export function useConta() {
  return useSyncExternalStore(sessaoDaConta.inscrever, sessaoDaConta.estado);
}
