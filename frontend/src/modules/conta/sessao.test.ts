import type { Resultado } from "@/modules/gameplay";
import { ErroDaApi, type ApiDaConta, type ContaDaApi } from "./api";
import { SessaoDaConta, type Ambiente } from "./sessao";

const conta: ContaDaApi = { id: "1", nome: "Lucas", avatar: null, xp_total: 0, nivel: { nivel: 1, xp_no_nivel: 0, xp_para_o_proximo: 100 } };

class Memoria {
  dados = new Map<string, string>();
  getItem = (c: string) => this.dados.get(c) ?? null;
  setItem = (c: string, v: string) => void this.dados.set(c, v);
  removeItem = (c: string) => void this.dados.delete(c);
}

function montar(api: Partial<ApiDaConta> = {}, busca = "") {
  const ambiente: Ambiente = {
    api: { entrar: vi.fn(async () => ({ token: "tok", conta })), eu: vi.fn(async () => conta), sair: vi.fn(async () => {}), excluirConta: vi.fn(async () => {}), registrarPartida: vi.fn(), ...api },
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
    expect(xp?.xp_ganho).toBe(150);
    expect(vi.mocked(ambiente.api.registrarPartida).mock.calls[0][1]).toMatchObject({ musica_id: "m", instrumento: "guitarra", acertos: 4, fantasma: false });
    expect(sessao.estado().conta).toMatchObject({ xp_total: 150, nivel: depois });
  });

  it("sem conta, a partida não vai para a API", async () => {
    const { sessao, ambiente } = montar();
    expect(await sessao.registrarPartida(resultado)).toBeNull();
    expect(ambiente.api.registrarPartida).not.toHaveBeenCalled();
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
