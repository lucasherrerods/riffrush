import { UserRound } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** A foto do Google com o ponto de online (verde) ou offline. Sem foto, um boneco no lugar. */
export function FotoDaConta({ avatar, className, online = true }: { avatar: string | null; className: string; online?: boolean }) {
  return (
    <span className="relative shrink-0">
      {avatar ? (
        <img src={avatar} alt="" referrerPolicy="no-referrer" className={cn("rounded-full", className)} />
      ) : (
        <UserRound className={cn("rounded-full bg-superficie-elevada p-1 text-texto-suave", className)} />
      )}
      <span className={cn("absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-superficie", online ? "bg-sucesso" : "bg-texto-suave")} />
    </span>
  );
}
