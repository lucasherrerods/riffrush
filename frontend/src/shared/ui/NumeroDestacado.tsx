/** Um número grande com rótulo, como os cartões do perfil. */
export function NumeroDestacado({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="chapa flex flex-col gap-1 bg-superficie p-4 max-md:gap-0.5 max-md:p-2">
      <span className="text-sm text-texto-suave max-md:text-xs">{rotulo}</span>
      <span className="font-titulo text-4xl leading-none tracking-wide max-md:text-xl">{valor}</span>
      {detalhe && <span className="text-sm text-texto-suave max-md:text-xs">{detalhe}</span>}
    </div>
  );
}
