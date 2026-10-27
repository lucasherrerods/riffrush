import { Music } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** A capa nas listas de músicas. Sem imagem, um ícone de música no lugar. */
export function CapaPequena({ capa, className }: { capa?: string | null; className?: string }) {
  if (capa) return <img src={capa} alt="" className={cn("size-10 shrink-0 rounded-sm object-cover", className)} />;
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-sm bg-superficie-elevada", className)}>
      <Music className="size-4 text-texto-suave opacity-70" aria-hidden />
    </span>
  );
}
