import { UserRound } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** A foto do Google com o ponto verde de online. Sem foto, um boneco no lugar. */
export function FotoDaConta({ avatar, className }: { avatar: string | null; className: string }) {
  return (
    <span className="relative shrink-0">
      {avatar ? (
        <img src={avatar} alt="" referrerPolicy="no-referrer" className={cn("rounded-full", className)} />
      ) : (
        <UserRound className={cn("rounded-full bg-superficie-elevada p-1 text-texto-suave", className)} />
      )}
      <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-superficie bg-sucesso" />
    </span>
  );
}
