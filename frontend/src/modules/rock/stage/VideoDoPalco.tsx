import { useEffect, useRef } from "react";

interface Props {
  /** O vídeo não carregou ou não pode tocar: quem usa troca pelo palco 3D. */
  aoFalhar: () => void;
}

const VIDEO_DO_SHOW = "/palco/show.mp4";

/** Show em loop atrás da pista. Só decoração: mudo, sem controles e sem receber toques. */
export function VideoDoPalco({ aoFalhar }: Props) {
  const video = useRef<HTMLVideoElement>(null);

  // Com a janela escondida o vídeo para, e volta quando ela aparece.
  useEffect(() => {
    const aoMudarVisibilidade = () => {
      if (document.hidden) video.current?.pause();
      else void video.current?.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, []);

  return (
    <video
      ref={video}
      src={VIDEO_DO_SHOW}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      data-parte="video-do-palco"
      onError={aoFalhar}
      className="video-do-palco pointer-events-none absolute inset-0 size-full bg-fundo object-cover object-center"
    />
  );
}
