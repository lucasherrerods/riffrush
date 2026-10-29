import { useEffect, useState } from "react";
import { Avatar, type Personagem } from "@/modules/rock/character";

/** O personagem do jogador palhetando a guitarra no ritmo da música, duas vezes por batida. */
export function AvatarPalhetando({ personagem, bpm, className }: { personagem: Personagem; bpm: number; className?: string }) {
  const [pulso, setPulso] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPulso((p) => p + 1), (60 / bpm / 2) * 1000);
    return () => clearInterval(id);
  }, [bpm]);
  return <Avatar personagem={{ ...personagem, instrumento: "guitarra" }} tocando bpm={bpm} pulso={pulso} className={className} />;
}
