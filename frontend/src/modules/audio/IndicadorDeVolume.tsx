import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { volumeGeral } from "./volume";

/** Quanto tempo o indicador fica na tela depois do último passo do atalho. */
export const TEMPO_DO_INDICADOR_MS = 1500;

export function useVolumeGeral() {
  return useSyncExternalStore(volumeGeral.inscrever, volumeGeral.estado);
}

/** Aparece no canto quando o volume muda pelo atalho, em qualquer tela, e some sozinho, como no osu!. */
export function IndicadorDeVolume() {
  const { volume, peloAtalho } = useVolumeGeral();
  const [visivel, setVisivel] = useState(false);
  // Só as mudanças depois de a tela abrir contam: o volume de antes não reabre o indicador.
  const vistoAoAbrir = useRef(peloAtalho);

  useEffect(() => {
    if (peloAtalho === vistoAoAbrir.current) return;
    setVisivel(true);
    const esconder = setTimeout(() => setVisivel(false), TEMPO_DO_INDICADOR_MS);
    return () => clearTimeout(esconder);
  }, [peloAtalho]);

  const porcentagem = Math.round(volume * 100);
  const Icone = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    visivel && (
      <motion.div
        role="status"
        aria-label={`Volume ${porcentagem}%`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="chapa pointer-events-none fixed right-6 bottom-6 z-50 flex w-64 items-center gap-4 border-borda bg-superficie px-4 py-2"
      >
        <Icone className="size-6 shrink-0 opacity-70" aria-hidden />
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-superficie-elevada">
          <div className="h-full rounded-full bg-primaria" style={{ width: `${porcentagem}%` }} />
        </div>
        <span className="w-12 shrink-0 text-right font-mono text-base font-bold tabular-nums">{porcentagem}%</span>
      </motion.div>
    )
  );
}
