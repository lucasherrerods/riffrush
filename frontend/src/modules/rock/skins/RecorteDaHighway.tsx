import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";
import { Slider } from "@/shared/ui/slider";
import type { ImagemAberta } from "./importacao";
import { moverRecorte, recorteInicial, redimensionarRecorte, type Recorte } from "./recorte";

interface Props {
  imagem: ImagemAberta;
  aoUsar: (recorte: Recorte) => void;
  aoCancelar: () => void;
}

/** Tamanho máximo da imagem dentro do modal, em pixels da tela. */
const VISTA = { largura: 400, altura: 360 };
/** Fração da imagem que cada seta anda. */
const PASSO_DA_SETA = 0.02;

/** Mostra a imagem com a área que vira a highway. O jogador arrasta e muda o tamanho; o corte sai sempre em 1:2. */
export function RecorteDaHighway({ imagem, aoUsar, aoCancelar }: Props) {
  const { largura, altura } = imagem;
  const [recorte, setRecorte] = useState(() => recorteInicial(largura, altura));
  const arraste = useRef<{ x: number; y: number } | null>(null);
  const escala = Math.min(VISTA.largura / largura, VISTA.altura / altura);
  const maxima = recorteInicial(largura, altura).altura;

  const mover = (dx: number, dy: number) => setRecorte((atual) => moverRecorte(atual, dx, dy, largura, altura));

  const aoApertar = (evento: PointerEvent<HTMLDivElement>) => {
    evento.currentTarget.setPointerCapture?.(evento.pointerId);
    arraste.current = { x: evento.clientX, y: evento.clientY };
  };
  const aoArrastar = (evento: PointerEvent<HTMLDivElement>) => {
    if (!arraste.current) return;
    mover((evento.clientX - arraste.current.x) / escala, (evento.clientY - arraste.current.y) / escala);
    arraste.current = { x: evento.clientX, y: evento.clientY };
  };
  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    const passo = Math.max(largura, altura) * PASSO_DA_SETA;
    const direcoes: Record<string, [number, number]> = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] };
    const direcao = direcoes[evento.key];
    if (!direcao) return;
    evento.preventDefault();
    mover(...direcao);
  };

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoCancelar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-2xl">Recortar a imagem da pista</DialogTitle>
        <DialogDescription>Arraste a área clara para escolher o pedaço que vai cobrir a pista. O topo da área é o fim do braço.</DialogDescription>
        <div className="relative mx-auto touch-none select-none overflow-hidden rounded-md" style={{ width: largura * escala, height: altura * escala }}>
          <img src={imagem.url} alt="" draggable={false} className="size-full opacity-30" />
          <div
            role="group"
            aria-label="Área do recorte"
            tabIndex={0}
            onPointerDown={aoApertar}
            onPointerMove={aoArrastar}
            onPointerUp={() => (arraste.current = null)}
            onKeyDown={aoTeclar}
            className="absolute cursor-move overflow-hidden border-2 border-primaria outline-none focus-visible:border-texto"
            style={{ left: recorte.x * escala, top: recorte.y * escala, width: recorte.largura * escala, height: recorte.altura * escala }}
          >
            <img
              src={imagem.url}
              alt=""
              draggable={false}
              className="absolute max-w-none"
              style={{ left: -recorte.x * escala - 2, top: -recorte.y * escala - 2, width: largura * escala, height: altura * escala }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-texto-suave">Tamanho</span>
          <Slider
            aria-label="Tamanho do recorte"
            className="flex-1"
            value={[Math.round((recorte.altura / maxima) * 100)]}
            min={10}
            max={100}
            step={1}
            onValueChange={([novo]) => setRecorte((atual) => redimensionarRecorte(atual, ((novo / 100) * maxima) / atual.altura, largura, altura))}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={aoCancelar}>
            Cancelar
          </Button>
          <Button onClick={() => aoUsar(recorte)}>Usar este recorte</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
