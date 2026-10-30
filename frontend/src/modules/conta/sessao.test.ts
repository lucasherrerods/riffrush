import type { Resultado } from "@/modules/rock/gameplay";
import { ErroDaApi, type ApiDaConta, type ContaDaApi } from "./api";
import { SessaoDaConta, type Ambiente } from "./sessao";

const conta: ContaDaApi = { id: "1", nome: "Lucas", avatar: null, email: null, xp_total: 0, nivel: { nivel: 1, xp_no_nivel: 0, xp_para_o_proximo: 100 } };

class Memoria {
  dados = new Map<string, string>();
  getItem = (c: string) => this.dados.get(c) ?? null;
  setItem = (c: string, v: string) => void this.dados.set(c, v);
  removeItem = (c: string) => void this.dados.delete(c);
}

function montar(api: Partial<ApiDaConta> = {}, busca = "") {
  const ambiente: Ambiente = {
    api: { entrar: vi.fn(async () => ({ token: "tok", conta })), eu: vi.fn(async () => conta), sair: vi.fn(async () => {}), excluirConta: vi.fn(async () => {}), registrarPartida: vi.fn(), situacaoDaPartida: vi.fn(), registrarPartidaDoMania: vi.fn(), situacaoDaPartidaDoMania: vi.fn(), perfil: vi.fn(), recordes: vi.fn(async () => []), ...api },
    clientId: "id",
    local: new Memoria(),
    temporario: new Memoria(),
    redirectUri: () => "http://app/",
    irPara: vi.fn(),
    busca: () => busca,
    limparBusca: vi.fn(),
  };
  return { sessao: new SessaoDaConta(ambiente), ambiente };
}

const resultado: Resultado = { musicaId: "m", dificuldade: "medio", pontos: 10, acertos: 4, total: 4, maiorSequencia: 4, derrota: false };

describe("SessaoDaConta: conta falsa do desenvolvimento", () => {
  it("abre logado com a conta falsa, sem perguntar à API nem guardar token", async () => {
    const { ambiente } = montar();
    const sessao = new SessaoDaConta({ ...ambiente, contaFalsa: conta });
    await sessao.iniciar();
    expect(sessao.estado()).toEqual({ conta, carregando: false });
    expect(ambiente.api.eu).not.toHaveBeenCalled();
    expect(sessao.token()).toBeNull();
  });
});

describe("SessaoDaConta", () => {
  it("entrar guarda o verificador e manda para o Google com o desafio", async () => {
    const { sessao, ambiente } = montar();
    await sessao.entrar();
    const url = new URL(vi.mocked(ambiente.irPara).mock.calls[0][0]);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(ambiente.temporario.getItem("riffrush:pkce-estado"));
    expect(ambiente.temporario.getItem("riffrush:pkce")).toBeTruthy();
  });

  it("na volta do Google troca o código, guarda o token e limpa a URL", async () => {
    const { sessao, ambiente } = montar({}, "?code=abc&state=e");
    ambiente.temporario.setItem("riffrush:pkce", "verif");
    ambiente.temporario.setItem("riffrush:pkce-estado", "e");
    await sessao.iniciar();
    expect(ambiente.api.entrar).toHaveBeenCalledWith("abc", "verif", "http://app/", "web");
    expect(ambiente.local.getItem("riffrush:token")).toBe("tok");
    expect(ambiente.limparBusca).toHaveBeenCalled();
    expect(ambiente.temporario.getItem("riffrush:pkce")).toBeNull();
    expect(sessao.estado().conta).toBe(conta);
  });

  it("volta do Google cancelada avisa e não entra", async () => {
    const { sessao, ambiente } = montar({}, "?error=access_denied&state=e");
    ambiente.temporario.setItem("riffrush:pkce-estado", "e");
    await expect(sessao.iniciar()).rejects.toThrow("cancelado");
    expect(sessao.estado().conta).toBeNull();
  });

  it("no desktop, entra pelo navegador do sistema e usa o redirect do loopback", async () => {
    const { sessao, ambiente } = montar();
    ambiente.loginPeloNavegador = vi.fn(async (url: string) => {
      const pedido = new URL(url);
      expect(pedido.searchParams.has("redirect_uri")).toBe(false);
      return { busca: `?code=abc&state=${pedido.searchParams.get("state")}`, redirectUri: "http://127.0.0.1:5000/" };
    });
    await sessao.entrar();
    expect(ambiente.irPara).not.toHaveBeenCalled();
    expect(ambiente.api.entrar).toHaveBeenCalledWith("abc", expect.any(String), "http://127.0.0.1:5000/", "desktop");
    expect(ambiente.local.getItem("riffrush:token")).toBe("tok");
  });

  it("no desktop, volta com estado errado não entra", async () => {
    const { sessao, ambiente } = montar();
    ambiente.loginPeloNavegador = vi.fn(async () => ({ busca: "?code=abc&state=outro", redirectUri: "x" }));
    await expect(sessao.entrar()).rejects.toThrow("cancelado");
    expect(ambiente.api.entrar).not.toHaveBeenCalled();
  });

  it("retoma a sessão guardada", async () => {
    const { sessao, ambiente } = montar();
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    expect(ambiente.api.eu).toHaveBeenCalledWith("tok");
    expect(sessao.estado()).toEqual({ conta, carregando: false });
  });

  it("sessão vencida apaga o token; sem rede, mantém", async () => {
    const vencida = montar({ eu: vi.fn(async () => Promise.reject(new ErroDaApi(401, "x"))) });
    vencida.ambiente.local.setItem("riffrush:token", "tok");
    await vencida.sessao.iniciar();
    expect(vencida.ambiente.local.getItem("riffrush:token")).toBeNull();

    const semRede = montar({ eu: vi.fn(async () => Promise.reject(new TypeError("offline"))) });
    semRede.ambiente.local.setItem("riffrush:token", "tok");
    await semRede.sessao.iniciar();
    expect(semRede.ambiente.local.getItem("riffrush:token")).toBe("tok");
  });

  it("entrega o token só com a conta carregada, para outros módulos mostrarem dados da pessoa", async () => {
    const { sessao, ambiente } = montar();
    ambiente.local.setItem("riffrush:token", "tok");
    expect(sessao.token()).toBeNull();
    await sessao.iniciar();
    expect(sessao.token()).toBe("tok");
  });

  it("registrar a partida atualiza o nível da conta", async () => {
    const depois = { nivel: 2, xp_no_nivel: 50, xp_para_o_proximo: 283 };
    const { sessao, ambiente } = montar({ registrarPartida: vi.fn(async () => ({ xp_ganho: 150, antes: conta.nivel, depois })) });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    const xp = await sessao.registrarPartida(resultado);
    expect(xp).toMatchObject({ xp_ganho: 150 });
    expect(vi.mocked(ambiente.api.registrarPartida).mock.calls[0][1]).toMatchObject({ musica_id: "m", instrumento: "guitarra", acertos: 4, fantasma: false, maior_sequencia: 4 });
    expect(sessao.estado().conta).toMatchObject({ xp_total: 150, nivel: depois });
  });

  it("manda a rodada da sala, para a partida em grupo contar uma vez no ranking", async () => {
    const { sessao, ambiente } = montar({ registrarPartida: vi.fn(async () => ({ xp_ganho: 0, antes: conta.nivel, depois: conta.nivel })) });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    await sessao.registrarPartida(resultado, undefined, "r-1");
    await sessao.registrarPartida(resultado);
    const corpos = vi.mocked(ambiente.api.registrarPartida).mock.calls.map(([, corpo]) => corpo);
    expect(corpos[0]).toMatchObject({ rodada_id: "r-1" });
    expect(corpos[1]).not.toHaveProperty("rodada_id");
  });

  it("manda o valor dos acertos, para o perfil mostrar a mesma precisão do jogo", async () => {
    const { sessao, ambiente } = montar({ registrarPartida: vi.fn(async () => ({ xp_ganho: 0, antes: conta.nivel, depois: conta.nivel })) });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    await sessao.registrarPartida({ ...resultado, julgamentos: { perfeito: 2, otimo: 2, bom: 0 } });
    expect(vi.mocked(ambiente.api.registrarPartida).mock.calls[0][1]).toMatchObject({ valor_dos_acertos: 1000 });
  });

  it("partida que foi para a fila de validação não mexe no XP da conta", async () => {
    const { sessao, ambiente } = montar({ registrarPartida: vi.fn(async () => ({ pendente: true as const, id: "p1" })) });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    expect(await sessao.registrarPartida(resultado)).toEqual({ pendente: true, id: "p1" });
    expect(sessao.estado().conta).toMatchObject({ xp_total: conta.xp_total });
  });

  it("pergunta pela partida da fila até o XP entrar, e soma o XP na conta", async () => {
    const depois = { nivel: 2, xp_no_nivel: 50, xp_para_o_proximo: 200 };
    const situacaoDaPartida = vi
      .fn()
      .mockResolvedValueOnce({ pendente: true, recusada: false })
      .mockResolvedValueOnce({ xp_ganho: 150, antes: conta.nivel, depois });
    const { sessao, ambiente } = montar({ situacaoDaPartida });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    expect(await sessao.esperarXp("p1", { intervalo: 0 })).toMatchObject({ xp_ganho: 150 });
    expect(situacaoDaPartida).toHaveBeenCalledTimes(2);
    expect(situacaoDaPartida).toHaveBeenCalledWith("tok", "p1");
    expect(sessao.estado().conta).toMatchObject({ xp_total: conta.xp_total + 150, nivel: depois });
  });

  it("partida recusada pelo servidor volta como recusada, sem XP", async () => {
    const { sessao, ambiente } = montar({ situacaoDaPartida: vi.fn(async () => ({ pendente: false, recusada: true })) });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    expect(await sessao.esperarXp("p1", { intervalo: 0 })).toEqual({ recusada: true });
    expect(sessao.estado().conta).toMatchObject({ xp_total: conta.xp_total });
  });

  it("desiste de esperar depois das tentativas e continua pendente", async () => {
    const situacaoDaPartida = vi.fn(async () => ({ pendente: true, recusada: false }));
    const { sessao, ambiente } = montar({ situacaoDaPartida });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    expect(await sessao.esperarXp("p1", { intervalo: 0, tentativas: 3 })).toEqual({ pendente: true, id: "p1" });
    expect(situacaoDaPartida).toHaveBeenCalledTimes(3);
  });

  it("partida do Mania vai com o mapa e o replay em base64, e o XP vem pela rota do Mania", async () => {
    const depois = { nivel: 6, xp_no_nivel: 10, xp_para_o_proximo: 400 };
    const registrarPartidaDoMania = vi.fn(async () => ({ pendente: true as const, id: "m1" }));
    const situacaoDaPartidaDoMania = vi.fn(async () => ({ xp_ganho: 80, antes: conta.nivel, depois }));
    const { sessao, ambiente } = montar({ registrarPartidaDoMania, situacaoDaPartidaDoMania });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    expect(await sessao.registrarPartidaDoMania(42, new Uint8Array([1, 2, 3]))).toEqual({ pendente: true, id: "m1" });
    expect(registrarPartidaDoMania).toHaveBeenCalledWith("tok", { beatmap_id: 42, replay: "AQID" });
    expect(await sessao.esperarXp("m1", { intervalo: 0, modo: "mania" })).toMatchObject({ xp_ganho: 80 });
    expect(situacaoDaPartidaDoMania).toHaveBeenCalledWith("tok", "m1");
    expect(ambiente.api.situacaoDaPartida).not.toHaveBeenCalled();
    expect(sessao.estado().conta).toMatchObject({ xp_total: conta.xp_total + 80 });
  });

  it("sem conta, a partida do Mania não vai para a API", async () => {
    const { sessao, ambiente } = montar();
    expect(await sessao.registrarPartidaDoMania(42, new Uint8Array([1]))).toBeNull();
    expect(ambiente.api.registrarPartidaDoMania).not.toHaveBeenCalled();
  });

  it("sem conta, a partida não vai para a API", async () => {
    const { sessao, ambiente } = montar();
    expect(await sessao.registrarPartida(resultado)).toBeNull();
    expect(ambiente.api.registrarPartida).not.toHaveBeenCalled();
  });

  it("manda o replay em base64 junto com a partida", async () => {
    const { sessao, ambiente } = montar({ registrarPartida: vi.fn(async () => ({ xp_ganho: 0, antes: conta.nivel, depois: conta.nivel })) });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    await sessao.registrarPartida(resultado, Uint8Array.of(1, 255, 0));
    expect(vi.mocked(ambiente.api.registrarPartida).mock.calls[0][1].replay).toBe("Af8A");
  });

  it("o perfil vai para a API com o token de quem está logado", async () => {
    const perfil = vi.fn(async () => ({ nome: "Lucas" }) as never);
    const { sessao, ambiente } = montar({ perfil });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    await sessao.perfil();
    expect(perfil).toHaveBeenCalledWith("tok", undefined);
  });

  it("sem conta, o perfil falha sem chamar a API", async () => {
    const { sessao, ambiente } = montar();
    await expect(sessao.perfil()).rejects.toThrow();
    expect(ambiente.api.perfil).not.toHaveBeenCalled();
  });

  it("sair apaga o token e avisa a API", async () => {
    const { sessao, ambiente } = montar();
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    await sessao.sair();
    expect(ambiente.local.getItem("riffrush:token")).toBeNull();
    expect(ambiente.api.sair).toHaveBeenCalledWith("tok");
    expect(sessao.estado().conta).toBeNull();
  });

  it("excluir a conta apaga na API, esquece o token e volta a ser convidado", async () => {
    const { sessao, ambiente } = montar();
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    await sessao.excluirConta();
    expect(ambiente.api.excluirConta).toHaveBeenCalledWith("tok");
    expect(ambiente.local.getItem("riffrush:token")).toBeNull();
    expect(sessao.estado().conta).toBeNull();
  });

  it("se a API falha ao excluir, a conta continua e o erro sobe", async () => {
    const { sessao, ambiente } = montar({ excluirConta: vi.fn(async () => Promise.reject(new ErroDaApi(500, "falhou"))) });
    ambiente.local.setItem("riffrush:token", "tok");
    await sessao.iniciar();
    await expect(sessao.excluirConta()).rejects.toThrow("falhou");
    expect(ambiente.local.getItem("riffrush:token")).toBe("tok");
    expect(sessao.estado().conta).toBe(conta);
  });
});
