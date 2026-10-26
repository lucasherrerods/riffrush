import logo from "@jogo/src-tauri/icons/icon.png";
import { IconeGithub } from "@jogo/src/shared/ui/IconeGithub";
import { LINKS } from "@/links";
import { Chamadas, Surge } from "./comuns";

export function Final() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-t border-borda py-32">
        <img src={logo} alt="" className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[720px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-15" />
        <Surge className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center">
          <h2 className="titulo-do-jogo font-letreiro text-[clamp(3.5rem,9vw,7rem)] leading-[0.9]" style={{ transform: "skewX(-6deg)" }}>
            Sobe no palco
          </h2>
          <p className="mt-6 mb-10 max-w-[48ch] text-lg text-texto-suave">A guitarra está afinada e a plateia já chegou. Só falta você.</p>
          <Chamadas />
        </Surge>
      </section>

      <footer className="border-t border-borda">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-texto-suave md:px-6">
          <span>© 2026 Riff Rush</span>
          <span>Shine, de Spektrem, cortesia da NCS.</span>
          <a href={LINKS.github} aria-label="Código do Riff Rush no GitHub" className="flex items-center gap-2 transition-colors hover:text-texto">
            <IconeGithub className="size-5 opacity-70" />
            lucasherrerods/riffrush
          </a>
        </div>
      </footer>
    </>
  );
}
