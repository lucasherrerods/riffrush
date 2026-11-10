import { Fundo } from "@/modules/menu";
import { usePlayerDeMusica } from "@/modules/player";
import { Capa } from "@/modules/rock/library";
import { playerDeMusica } from "./playerDeMusica";

/** O fundo da tela inicial do Rock: a capa da música que toca, borrada, sobre a grade do palco. */
export function FundoDoRock() {
  const musica = usePlayerDeMusica(playerDeMusica).musica;
  const capa = musica ? { chave: musica.id, imagem: <Capa musica={musica} decorativa className="size-full scale-105 blur-md" /> } : undefined;
  return <Fundo capa={capa} />;
}
