import { cn } from "@/shared/lib/utils";

/** O selo de quem é da moderação do chat, igual no chat, no cabeçalho e no perfil. */
export function SeloMod({ className }: { className?: string }) {
  return <span className={cn("w-fit rounded-full bg-ouro px-2 text-base leading-tight font-bold text-fundo", className)}>Mod</span>;
}
