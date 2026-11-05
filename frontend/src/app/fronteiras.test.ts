// Os dois modos são jogos à parte: um não importa nada do outro. O que for comum vai para shared ou para um módulo fora deles.
const arquivos = import.meta.glob(["/src/modules/rock/**/*.{ts,tsx}", "/src/modules/mania/**/*.{ts,tsx}", "/src/modules/selecao/**/*.{ts,tsx}", "/src/modules/player/**/*.{ts,tsx}", "/src/shared/**/*.{ts,tsx}", "!**/wasm/**"], {
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

// O que é dos dois modos é burro: recebe os dados de cada um por props e não importa nenhum deles.
it.each(["selecao", "player", "shared"])("%s, que é dos dois modos, não importa de modules/rock nem de modules/mania", (neutro) => {
  const raiz = neutro === "shared" ? "/src/shared/" : `/src/modules/${neutro}/`;
  const proibidos = Object.entries(arquivos)
    .filter(([caminho]) => caminho.startsWith(raiz))
    .flatMap(([caminho, codigo]) => importsDe(codigo).filter((i) => /modules\/(rock|mania)/.test(i)).map((i) => `${caminho} → ${i}`));
  expect(proibidos).toEqual([]);
});
