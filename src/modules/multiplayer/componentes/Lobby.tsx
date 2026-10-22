import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2, Play, Smartphone, Users } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { Chibi } from "@/modules/character";
import { DIFICULDADES, type Musica } from "@/modules/songs";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { MAXIMO_DE_JOGADORES, type EstadoDaSala } from "../protocolo";
import { comecar, escolher, type InfoDaSala } from "../sala";

interface Props {
  sala: EstadoDaSala;
  info?: InfoDaSala;
  musicas: Musica[];
  volumeDosEfeitos: number;
}

export function Lobby({ sala, info, musicas, volumeDosEfeitos }: Props) {
  const [qr, setQr] = useState("");
  const [comecando, setComecando] = useState(false);
  const musica = musicas.find((m) => m.id === sala.musica.id);
  const tituloDaMusica = musica?.titulo ?? (sala.musica.tipo === "importada" ? sala.musica.titulo : sala.musica.id);

  useEffect(() => {
    if (info) void QRCode.toDataURL(info.endereco, { margin: 1, width: 220 }).then(setQr);
  }, [info]);

  const darLargada = async () => {
    if (!musica) return;
    setComecando(true);
    tocarEfeito("selecionar", volumeDosEfeitos);
    try {
      await comecar(musica);
    } finally {
      setComecando(false);
    }
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:grid-cols-1 max-md:overflow-y-auto">
      <div className={cn("flex min-h-0 flex-col gap-4", info ? "col-span-8" : "col-span-12")}>
        <ul className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
          {Array.from({ length: MAXIMO_DE_JOGADORES }, (_, i) => {
            const jogador = sala.jogadores[i];
            return (
              <li
                key={jogador?.id ?? `vaga-${i}`}
                className={cn(
                  "flex flex-col items-center rounded-3xl border p-4",
                  jogador ? "border-borda bg-superficie" : "border-dashed border-borda bg-fundo",
                )}
              >
                {jogador ? (
                  <>
                    <Chibi personagem={jogador.personagem} className="h-36 w-auto" />
                    <p className="mt-2 truncate text-base font-bold">{jogador.personagem.nome}</p>
                    <div className="flex gap-1">
                      {jogador.id === sala.hostId && <span className="rounded-full bg-ouro px-2 text-base font-bold text-fundo">Host</span>}
                      {jogador.id === sala.meuId && <span className="rounded-full bg-superficie-elevada px-2 text-base">Você</span>}
                    </div>
                  </>
                ) : (
                  <div className="flex h-44 flex-col items-center justify-center gap-2 text-texto-suave">
                    <Users className="opacity-50" aria-hidden />
                    <p className="text-base">Esperando...</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <section className="flex flex-col gap-4 rounded-3xl border border-borda bg-superficie p-6">
          <p className="text-base font-semibold text-texto-suave">Música</p>
          {sala.souHost ? (
            <div role="radiogroup" aria-label="Música" className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
              {musicas.map((m) => {
                const escolhida = m.id === sala.musica.id;
                return (
                  <button
                    key={m.id}
                    role="radio"
                    aria-checked={escolhida}
                    aria-label={`${m.titulo} - ${m.artista}`}
                    onClick={() => {
                      tocarEfeito("mover", volumeDosEfeitos);
                      escolher(m, sala.dificuldade);
                    }}
                    className={cn("flex items-center gap-4 rounded-lg px-4 py-2 text-left text-base", escolhida ? "bg-primaria" : "hover:bg-superficie-elevada")}
                  >
                    <span className="flex-1 truncate font-semibold">{m.titulo}</span>
                    <span className="truncate text-texto-suave">{m.artista}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-2xl font-black">{tituloDaMusica}</p>
          )}

          {sala.souHost ? (
            <GrupoDeOpcoes
              titulo="Dificuldade"
              opcoes={DIFICULDADES.map((d) => ({ id: d.id, rotulo: d.rotulo }))}
              valor={sala.dificuldade}
              aoEscolher={(dificuldade) => musica && escolher(musica, dificuldade)}
            />
          ) : (
            <p className="text-base text-texto-suave">Dificuldade: {DIFICULDADES.find((d) => d.id === sala.dificuldade)?.rotulo}</p>
          )}

          {sala.souHost ? (
            <Button size="lg" disabled={comecando || !musica} className="h-14 text-lg font-black" onClick={() => void darLargada()}>
              {comecando ? <Loader2 className="animate-spin" /> : <Play className="fill-current opacity-70" />} Começar partida
            </Button>
          ) : (
            <p className="flex items-center justify-center gap-2 py-4 text-base text-texto-suave">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Esperando o host começar...
            </p>
          )}
        </section>
      </div>

      {info && (
        <section className="col-span-4 flex flex-col items-center gap-4 rounded-3xl border border-borda bg-superficie p-6 text-center">
          <Smartphone className="text-primaria opacity-70" aria-hidden />
          <p className="text-base font-bold">Jogar pelo celular</p>
          <p className="text-base text-texto-suave">No mesmo Wi-Fi, abra a câmera no QR code:</p>
          {qr && <img src={qr} alt="QR code da sala" className="rounded-2xl bg-texto p-2" />}
          <p className="font-mono text-lg font-bold">{info.endereco}</p>
          <p className="text-base text-texto-suave">Outros PCs com o Riff Rush acham a sala sozinhos.</p>
        </section>
      )}
    </div>
  );
}
