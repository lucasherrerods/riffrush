// Toda cor do app mora num arquivo de tema: shared/styles para a interface e modules/<modo>/tema.ts para o canvas de cada jogo.
// Assim trocar ou criar um tema é mexer num lugar só.
const arquivos = import.meta.glob(
  ["/src/**/*.{ts,tsx,css}", "!/src/shared/styles/**", "!/src/modules/*/tema.ts", "!/src/test/**", "!**/*.test.{ts,tsx}", "!**/wasm/**"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

/** Marcas de terceiros têm cor própria, que não muda com o tema. */
const EXCECOES = ["/src/modules/conta/LogoDoGoogle.tsx"];

const COR = /#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?\b|\brgba?\(\s*\d|\bhsla?\(\s*\d/gi;

it("nenhuma cor fora dos arquivos de tema", () => {
  const soltas = Object.entries(arquivos)
    .filter(([caminho]) => !EXCECOES.includes(caminho))
    .flatMap(([caminho, codigo]) =>
      codigo
        .split("\n")
        .map((linha, i) => [linha, i + 1] as const)
        .filter(([linha]) => (linha.match(COR) ?? []).length > 0)
        .map(([linha, numero]) => `${caminho}:${numero} ${linha.trim()}`),
    );
  expect(soltas).toEqual([]);
});

it("confere os arquivos do app", () => {
  expect(Object.keys(arquivos).length).toBeGreaterThan(100);
});
