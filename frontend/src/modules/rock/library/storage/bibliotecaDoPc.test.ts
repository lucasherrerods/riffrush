import { MUSICAS_EMBUTIDAS, type Musica } from "@/modules/rock/songs";
import { abrirBibliotecaDoPc } from "./bibliotecaDoPc";

const registro = {
  id: "arquivo:Riff.mp3:3",
  dados: JSON.stringify({ ...MUSICAS_EMBUTIDAS[0], id: "arquivo:Riff.mp3:3", titulo: "Riff às vezes" }),
  usadaEm: 1,
  nomeDoArquivo: "Riff.mp3",
  tipoDoArquivo: "audio/mpeg",
  temCapa: true,
};

function invokeFalso(respostas: Record<string, unknown> = {}) {
  return vi.fn(async (comando: string, ..._args: unknown[]) => respostas[comando]);
}

beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:capa") }));
});
afterEach(() => vi.unstubAllGlobals());

describe("abrirBibliotecaDoPc", () => {
  it("lista as músicas salvas sem ler os arquivos, marcadas como guardadas no aparelho", async () => {
    const chamar = invokeFalso({ biblioteca_listar: [registro], biblioteca_ler_capa: new ArrayBuffer(3) });
    const [musica] = await (await abrirBibliotecaDoPc(chamar)).listar();
    expect(musica).toMatchObject({ id: "arquivo:Riff.mp3:3", titulo: "Riff às vezes", noAparelho: true, imagemDeCapa: "blob:capa" });
    expect(musica.arquivo).toBeUndefined();
    expect(chamar).not.toHaveBeenCalledWith("biblioteca_ler_arquivo", expect.anything());
  });

  it("abre o arquivo da música só quando pedem, com o nome e o tipo certos", async () => {
    const chamar = invokeFalso({ biblioteca_listar: [registro], biblioteca_ler_capa: new ArrayBuffer(0), biblioteca_ler_arquivo: new TextEncoder().encode("abc").buffer });
    const biblioteca = await abrirBibliotecaDoPc(chamar);
    await biblioteca.listar();
    const arquivo = await biblioteca.abrir("arquivo:Riff.mp3:3");
    expect(chamar).toHaveBeenCalledWith("biblioteca_ler_arquivo", { id: "arquivo:Riff.mp3:3" });
    expect(arquivo).toMatchObject({ name: "Riff.mp3", type: "audio/mpeg" });
    expect(await arquivo?.text()).toBe("abc");
  });

  it("guarda os bytes do arquivo com os dados nos cabeçalhos, e a capa separada", async () => {
    const chamar = invokeFalso();
    const arquivo = new File(["abc"], "Banda - Riff às vezes.mp3", { type: "audio/mpeg" });
    const musica: Musica = { ...MUSICAS_EMBUTIDAS[0], id: "arquivo:x", titulo: "Riff às vezes", arquivo, imagemDeCapa: "blob:velha" };
    await (await abrirBibliotecaDoPc(chamar)).guardar(musica, new Blob(["png"]));

    const [, bytes, opcoes] = chamar.mock.calls.find(([c]) => c === "biblioteca_guardar")!;
    expect(new TextDecoder().decode(bytes as Uint8Array)).toBe("abc");
    const { headers } = opcoes as { headers: Record<string, string> };
    expect(decodeURIComponent(headers["x-nome"])).toBe("Banda - Riff às vezes.mp3");
    expect(headers["x-tipo"]).toBe("audio%2Fmpeg");
    const dados = JSON.parse(decodeURIComponent(headers["x-dados"]));
    expect(dados).toMatchObject({ id: "arquivo:x", titulo: "Riff às vezes" });
    expect(dados).not.toHaveProperty("arquivo");
    expect(dados).not.toHaveProperty("imagemDeCapa");
    expect(chamar).toHaveBeenCalledWith("biblioteca_guardar_capa", expect.any(Uint8Array), { headers: { "x-id": "arquivo%3Ax" } });
  });

  // Bug: o WebView2 descarta cabeçalho vazio, e o .sng (que chega sem tipo) nunca era salvo.
  it("arquivo sem tipo, como o .sng, vai com um tipo genérico em vez de cabeçalho vazio", async () => {
    const chamar = invokeFalso();
    const musica: Musica = { ...MUSICAS_EMBUTIDAS[0], id: "arquivo:x", arquivo: new File(["abc"], "musica.sng") };
    await (await abrirBibliotecaDoPc(chamar)).guardar(musica);
    const [, , opcoes] = chamar.mock.calls.find(([c]) => c === "biblioteca_guardar")!;
    const { headers } = opcoes as { headers: Record<string, string> };
    expect(Object.values(headers)).not.toContain("");
    expect(decodeURIComponent(headers["x-tipo"])).toBe("application/octet-stream");
  });

  it("não guarda música sem arquivo", async () => {
    const chamar = invokeFalso();
    await (await abrirBibliotecaDoPc(chamar)).guardar(MUSICAS_EMBUTIDAS[0]);
    expect(chamar).not.toHaveBeenCalled();
  });

  it("usar e remover chamam os comandos com o id", async () => {
    const chamar = invokeFalso();
    const biblioteca = await abrirBibliotecaDoPc(chamar);
    await biblioteca.usar("a");
    await biblioteca.remover("a");
    expect(chamar).toHaveBeenCalledWith("biblioteca_usar", { id: "a" });
    expect(chamar).toHaveBeenCalledWith("biblioteca_remover", { id: "a" });
  });
});
