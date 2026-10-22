import { motion } from "framer-motion";
import { Disc3 } from "lucide-react";
import type { Musica } from "@/modules/songs";
import { cn } from "@/shared/lib/utils";

/** A imagem de capa da música ou, sem ela, o gradiente com um disco girando. */
export function Capa({ musica, className, girando = false, decorativa = false }: { musica: Musica; className?: string; girando?: boolean; decorativa?: boolean }) {
  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, ${musica.capa[0]}, ${musica.capa[1]})` }}
    >
      {musica.imagemDeCapa ? (
        <img src={musica.imagemDeCapa} alt={decorativa ? "" : `Capa de ${musica.titulo}`} className="absolute inset-0 size-full object-cover" />
      ) : (
        <motion.div animate={girando ? { rotate: 360 } : undefined} transition={{ repeat: Infinity, duration: 4, ease: "linear" }}>
          <Disc3 className="size-1/2 min-h-6 min-w-6 text-texto/80" aria-hidden />
        </motion.div>
      )}
    </div>
  );
}
