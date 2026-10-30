import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { FotoDaConta } from "@/modules/conta";
import { presenca, type ConviteParaSala } from "@/modules/presenca";
import { Button } from "@/shared/ui/button";
import { listaDeAmigos } from "./loja";

/** Quanto tempo o convite fica na tela antes de sumir sozinho. */
export const DURACAO_DO_CONVITE_MS = 20_000;
/** Mais que isso, os mais antigos saem para não cobrir a tela. */
const CONVITES_NA_TELA = 3;

/**
 * Convites de amigos para a sala, num cartão no canto da tela, com entrar ou ignorar.
 * O relay entrega convite de qualquer conta: o de quem não é amigo nem aparece.
 */
export function ConvitesDeAmigos({ aoEntrar, duracaoMs = DURACAO_DO_CONVITE_MS }: { aoEntrar: (codigo: string) => void; duracaoMs?: number }) {
  const [convites, setConvites] = useState<ConviteParaSala[]>([]);
  const dispensar = (convite: ConviteParaSala) => setConvites((atuais) => atuais.filter((c) => c !== convite));

  useEffect(
    () =>
      presenca.ouvirConvites((convite) => {
        const amigos = listaDeAmigos.estado().listas?.amigos ?? [];
        if (!amigos.some((a) => a.conta_id === convite.de.id)) return;
        // O mesmo amigo chamando de novo troca o convite antigo pelo novo.
        setConvites((atuais) => [...atuais.filter((c) => c.de.id !== convite.de.id), convite].slice(-CONVITES_NA_TELA));
        setTimeout(() => dispensar(convite), duracaoMs);
      }),
    [duracaoMs],
  );

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2 max-md:inset-x-2 max-md:top-2 max-md:bottom-auto max-md:w-auto">
      <AnimatePresence>
        {convites.map((convite) => (
          <motion.div
            key={`${convite.de.id}-${convite.codigo}`}
            role="alert"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.15 }}
            className="chapa pointer-events-auto flex flex-col gap-2 border-borda bg-superficie-elevada p-4"
          >
            <div className="flex items-start gap-2">
              <FotoDaConta avatar={convite.de.avatar} className="size-10" />
              <p className="min-w-0 flex-1 text-base">
                <span className="font-bold">{convite.de.nome}</span> chamou você para a sala <span className="font-titulo text-lg">{convite.codigo}</span>
              </p>
              <Button variant="ghost" size="icon-sm" aria-label="Fechar convite" onClick={() => dispensar(convite)}>
                <X />
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => dispensar(convite)}>
                Ignorar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  dispensar(convite);
                  aoEntrar(convite.codigo);
                }}
              >
                Entrar
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
