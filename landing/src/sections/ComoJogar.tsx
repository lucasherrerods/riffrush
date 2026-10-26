import { Surge, Titulo } from "./comuns";

const PASSOS = [
  { titulo: "Abra o jogo", texto: "Jogue direto no navegador ou baixe a versão de PC, que também abre a sala da LAN." },
  { titulo: "Escolha a música", texto: "Comece pela que vem com o jogo ou importe as suas do Clone Hero e do Encore." },
  { titulo: "Chame a galera", texto: "Os amigos entram pelo QR code ou pelo código da sala. Contou até três, é show." },
];

export function ComoJogar() {
  return (
    <section id="como-jogar" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Surge>
          <Titulo selo="Como jogar">Do zero ao palco em um minuto</Titulo>
        </Surge>
        <ol className="grid gap-4 md:grid-cols-3">
          {PASSOS.map((passo, i) => (
            <Surge key={passo.titulo} atraso={i * 0.1} className="h-full">
              <li className="placa h-full p-8">
                <span className="titulo-do-jogo block font-letreiro text-7xl leading-none text-primaria">{i + 1}</span>
                <h3 className="mt-6 mb-2 text-3xl leading-none">{passo.titulo}</h3>
                <p className="text-base leading-relaxed text-texto-suave">{passo.texto}</p>
              </li>
            </Surge>
          ))}
        </ol>
      </div>
    </section>
  );
}
