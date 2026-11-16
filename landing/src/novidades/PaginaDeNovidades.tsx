import { Chamadas, Surge } from "@/sections/comuns";
import { Rodape } from "@/sections/Rodape";
import { Topo } from "@/sections/Topo";
import { POSTS, emOrdem, formatarData, type Post } from "./posts";

function Artigo({ post }: { post: Post }) {
  return (
    <article id={post.id} className="scroll-mt-24 grid gap-4 border-t border-borda pt-10 md:grid-cols-12 md:gap-8 md:pt-12">
      <div className="flex flex-col gap-2 md:col-span-4">
        <time dateTime={post.data} className="font-titulo text-xl tracking-wide text-texto-suave">
          {formatarData(post.data)}
        </time>
        {post.modo && <span className="w-fit rounded-sm border border-borda px-2 text-sm text-texto-suave">{post.modo}</span>}
      </div>
      <div className="md:col-span-8">
        <h2 className="text-4xl leading-[0.95] md:text-6xl">
          <a href={`#${post.id}`} className="transition-colors hover:text-primaria">
            {post.titulo}
          </a>
        </h2>
        <p className="mt-4 max-w-[60ch] text-lg text-texto-suave">{post.resumo}</p>
        <ul className="mt-6 max-w-[65ch] space-y-3 text-base leading-relaxed">
          {post.itens.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 bg-primaria" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/** O que mudou no jogo, do mais novo para o mais antigo. Cada post tem âncora própria para ser compartilhado. */
export function PaginaDeNovidades() {
  return (
    <>
      <Topo inicio="/" />
      <main className="mx-auto max-w-6xl px-4 pt-32 pb-20 md:px-6 md:pt-40 md:pb-32">
        <Surge>
          <h1 className="text-6xl leading-[0.85] sm:text-8xl md:text-[10rem]">Novidades</h1>
          <p className="mt-6 max-w-[48ch] text-lg text-texto-suave md:text-xl">O que entrou no Riff Rush a cada atualização, nos modos Rock e Mania.</p>
        </Surge>
        <div className="mt-16 flex flex-col gap-16 md:mt-24 md:gap-20">
          {emOrdem(POSTS).map((post) => (
            <Artigo key={post.id} post={post} />
          ))}
        </div>
        <div className="mt-20 border-t border-borda pt-12 md:mt-28">
          <Chamadas />
        </div>
      </main>
      <Rodape inicio="/" />
    </>
  );
}
