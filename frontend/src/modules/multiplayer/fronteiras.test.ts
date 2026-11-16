import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

describe("fronteiras do multijogador", () => {
  it("o módulo neutro não importa de nenhum modo", () => {
    const proibidos = arquivos(__dirname).filter((arquivo) => /@\/modules\/(rock|mania)\b/.test(readFileSync(arquivo, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/fronteiras/g, "")));
    expect(proibidos).toEqual([]);
  });

  it("o Mania não importa do Rock", () => {
    const proibidos = arquivos(join(__dirname, "..", "mania")).filter((arquivo) => /@\/modules\/rock/.test(readFileSync(arquivo, "utf8")));
    expect(proibidos).toEqual([]);
  });
});
