// Os dois modos são jogos à parte: um não importa nada do outro. O que for comum vai para shared ou para um módulo fora deles.
const arquivos = import.meta.glob(["/src/modules/rock/**/*.{ts,tsx}", "/src/modules/mania/**/*.{ts,tsx}", "!**/wasm/**"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const importsDe = (codigo: string) => [...codigo.matchAll(/from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']/g)].map((m) => m[1] ?? m[2]);

it.each([
  ["rock", "mania"],
  ["mania", "rock"],
])("modules/%s não importa de modules/%s", (de, para) => {
  const proibidos = Object.entries(arquivos)
    .filter(([caminho]) => caminho.startsWith(`/src/modules/${de}/`))
    .flatMap(([caminho, codigo]) => importsDe(codigo).filter((i) => i.includes(`modules/${para}`)).map((i) => `${caminho} → ${i}`));
  expect(proibidos).toEqual([]);
});

it("encontra os arquivos dos dois modos", () => {
  const caminhos = Object.keys(arquivos);
  expect(caminhos.some((c) => c.startsWith("/src/modules/rock/"))).toBe(true);
  expect(caminhos.some((c) => c.startsWith("/src/modules/mania/"))).toBe(true);
});
