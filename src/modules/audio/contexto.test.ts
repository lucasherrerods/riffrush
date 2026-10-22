import { AudioContextFalso, comAudioFalso } from "@/test/audioFalso";

const importar = () => comAudioFalso(() => import("./contexto"));

describe("obterContextoDeAudio", () => {
  it("cria um único contexto, pedindo baixa latência", async () => {
    const { obterContextoDeAudio } = await importar();
    expect(obterContextoDeAudio()).toBe(obterContextoDeAudio());
    expect(AudioContextFalso.instancias).toHaveLength(1);
    expect(AudioContextFalso.instancias[0].opcoes?.latencyHint).toBe("interactive");
  });

  it("retoma o contexto quando ele está suspenso", async () => {
    const { obterContextoDeAudio } = await importar();
    const contexto = obterContextoDeAudio() as unknown as AudioContextFalso;
    contexto.state = "suspended";
    obterContextoDeAudio();
    expect(contexto.resume).toHaveBeenCalled();
  });
});
