import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const pasta = __dirname;
const componentes = readdirSync(pasta).filter((arquivo) => arquivo.endsWith(".tsx"));

// O CLI do shadcn às vezes gera `from "cn"` e instala o pacote "cn" do npm no lugar do utilitário local.
describe("componentes de ui", () => {
  it.each(componentes)("%s importa o cn do utilitário local", (arquivo: string) => {
    const codigo = readFileSync(join(pasta, arquivo), "utf8");
    if (!codigo.includes("cn(")) return;
    expect(codigo).toMatch(/import \{ cn \} from "@\/compartilhado\/lib\/utils"/);
  });

  it("o pacote npm 'cn' não é dependência do projeto", () => {
    const pacote = JSON.parse(readFileSync(join(pasta, "../../../package.json"), "utf8"));
    expect({ ...pacote.dependencies, ...pacote.devDependencies }).not.toHaveProperty("cn");
  });
});
