import { compor } from "./composicao";
import { MUSICAS_EMBUTIDAS } from "./catalogo";
import { TAXA_DE_AMOSTRAGEM, sintetizar } from "./sintetizador";

const musica = MUSICAS_EMBUTIDAS[0];
const composicao = compor(musica.estilo!, musica.semente!);

describe("sintetizar", () => {
  const amostras = sintetizar(musica.estilo!, composicao);

  it("gera a música inteira", () => {
    expect(amostras.length).toBe(Math.ceil(composicao.duracao * TAXA_DE_AMOSTRAGEM));
  });

  it("não gera silêncio", () => {
    let energia = 0;
    for (const a of amostras) energia += a * a;
    expect(Math.sqrt(energia / amostras.length)).toBeGreaterThan(0.01);
  });

  it("limita o volume para não estourar", () => {
    let pico = 0;
    for (const a of amostras) pico = Math.max(pico, Math.abs(a));
    expect(pico).toBeLessThanOrEqual(0.86);
  });

  it("sintetiza igual toda vez", () => {
    expect(sintetizar(musica.estilo!, composicao).slice(0, 5000)).toEqual(amostras.slice(0, 5000));
  });

  // Bug do projeto antigo: com OfflineAudioContext a música levava mais de 15 s para carregar.
  it("sintetiza uma música inteira em menos de 3 segundos", () => {
    const inicio = performance.now();
    sintetizar(MUSICAS_EMBUTIDAS[4].estilo!, compor(MUSICAS_EMBUTIDAS[4].estilo!, MUSICAS_EMBUTIDAS[4].semente!));
    expect(performance.now() - inicio).toBeLessThan(3000);
  });
});
