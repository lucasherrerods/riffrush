import { desafioDoVerificador, gerarVerificador, lerRetornoDoGoogle, urlDoLoginDoGoogle } from "./pkce";

describe("gerarVerificador", () => {
  it("gera 64 caracteres seguros para URL, diferentes a cada vez", () => {
    const a = gerarVerificador();
    expect(a).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(gerarVerificador()).not.toBe(a);
  });
});

describe("desafioDoVerificador", () => {
  it("é o SHA-256 em base64url, como pede o PKCE", async () => {
    // Exemplo da RFC 7636, apêndice B.
    expect(await desafioDoVerificador("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("urlDoLoginDoGoogle", () => {
  it("pede o código com PKCE, o estado e o perfil básico", () => {
    const url = new URL(urlDoLoginDoGoogle({ clientId: "id", redirectUri: "http://localhost:1420/", desafio: "d", estado: "e" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "id",
      redirect_uri: "http://localhost:1420/",
      response_type: "code",
      scope: "openid profile email",
      code_challenge: "d",
      code_challenge_method: "S256",
      state: "e",
      prompt: "select_account",
    });
  });
});

describe("lerRetornoDoGoogle", () => {
  it("pega o código quando o estado confere", () => {
    expect(lerRetornoDoGoogle("?code=abc&state=e", "e")).toEqual({ tipo: "codigo", codigo: "abc" });
  });

  it("recusa estado diferente: o retorno não veio do nosso pedido", () => {
    expect(lerRetornoDoGoogle("?code=abc&state=outro", "e")).toEqual({ tipo: "erro" });
  });

  it("a pessoa cancelou no Google", () => {
    expect(lerRetornoDoGoogle("?error=access_denied&state=e", "e")).toEqual({ tipo: "erro" });
  });

  it("sem retorno na URL, não há nada a fazer", () => {
    expect(lerRetornoDoGoogle("", "e")).toEqual({ tipo: "nada" });
    expect(lerRetornoDoGoogle("?code=abc", null)).toEqual({ tipo: "nada" });
  });
});
