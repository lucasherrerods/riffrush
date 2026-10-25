import { HOST, LIMITE_DE_MENSAGENS_POR_SEGUNDO, MAXIMO_DE_JOGADORES, TAMANHO_MAXIMO_DA_MENSAGEM, VALIDADE_DA_ENTRADA_MS, codigoValido, dentroDoLimite, embrulhar, gerarCodigo, listarSalas, mensagemDoServidor, nomeDoHost, expulsoPeloHost, novoHost, salaPublica, type EntradaDaSala } from "./regras";

describe("gerarCodigo", () => {
  it("gera 5 caracteres sem letras que se confundem", () => {
    const codigo = gerarCodigo(() => 0.99);
    expect(codigo).toHaveLength(5);
    expect(codigo).not.toMatch(/[IO01L]/);
  });

  it("usa o sorteio recebido", () => {
    expect(gerarCodigo(() => 0)).toBe("AAAAA");
  });
});

describe("codigoValido", () => {
  it("aceita só códigos no formato gerado", () => {
    expect(codigoValido(gerarCodigo(Math.random))).toBe(true);
    expect(codigoValido("abcde")).toBe(false);
    expect(codigoValido("AB")).toBe(false);
    expect(codigoValido("ABCD0")).toBe(false);
  });
});

describe("embrulhar", () => {
  it("embrulha a mensagem com quem mandou, igual ao servidor da LAN", () => {
    expect(embrulhar(3, '{"tipo":"oi"}')).toBe('{"de":3,"msg":{"tipo":"oi"}}');
  });

  it("não repassa o que não é JSON", () => {
    expect(embrulhar(1, "isso não é json")).toBeNull();
  });

  it("não repassa mensagens gigantes", () => {
    expect(embrulhar(1, JSON.stringify({ x: "a".repeat(TAMANHO_MAXIMO_DA_MENSAGEM) }))).toBeNull();
  });
});

describe("mensagemDoServidor", () => {
  it("o servidor fala com o id 0", () => {
    expect(JSON.parse(mensagemDoServidor({ tipo: "bemVindo", id: HOST, codigo: "ABCDE" }))).toEqual({ de: 0, msg: { tipo: "bemVindo", id: 1, codigo: "ABCDE" } });
  });

  it("avisa a saída em nome de quem saiu", () => {
    expect(JSON.parse(mensagemDoServidor({ tipo: "saiu" }, 2))).toEqual({ de: 2, msg: { tipo: "saiu" } });
  });
});

describe("dentroDoLimite", () => {
  it(`deixa passar até ${LIMITE_DE_MENSAGENS_POR_SEGUNDO} mensagens por segundo`, () => {
    let janela = { inicio: 0, contagem: 0 };
    for (let i = 0; i < LIMITE_DE_MENSAGENS_POR_SEGUNDO; i++) {
      const r = dentroDoLimite(janela, 500);
      expect(r.passa).toBe(true);
      janela = r.janela;
    }
    expect(dentroDoLimite(janela, 900).passa).toBe(false);
  });

  it("a contagem recomeça no segundo seguinte", () => {
    const cheia = { inicio: 0, contagem: LIMITE_DE_MENSAGENS_POR_SEGUNDO };
    expect(dentroDoLimite(cheia, 1000)).toEqual({ passa: true, janela: { inicio: 1000, contagem: 1 } });
  });
});

describe("listarSalas", () => {
  const agora = 1_000_000;
  const sala = (codigo: string, extra: Partial<EntradaDaSala> = {}): EntradaDaSala => ({ codigo, nome: "Lucas", jogadores: 1, atualizadaEm: agora, ...extra });

  it("mostra as salas com vaga primeiro, as mais novas antes", () => {
    const lista = listarSalas([sala("AAAAA", { atualizadaEm: agora - 1000 }), sala("BBBBB"), sala("CCCCC", { jogadores: MAXIMO_DE_JOGADORES })], agora);
    expect(lista.map((s) => s.codigo)).toEqual(["BBBBB", "AAAAA", "CCCCC"]);
  });

  it("esconde salas que pararam de se renovar: o host sumiu sem avisar", () => {
    expect(listarSalas([sala("AAAAA", { atualizadaEm: agora - VALIDADE_DA_ENTRADA_MS - 1 })], agora)).toEqual([]);
  });

  it("não entrega a hora interna da entrada", () => {
    expect(listarSalas([sala("AAAAA")], agora)[0]).toEqual({ codigo: "AAAAA", nome: "Lucas", jogadores: 1 });
  });
});

describe("nomeDoHost", () => {
  it("limita o tamanho e tira espaços", () => {
    expect(nomeDoHost("  Lucas  ")).toBe("Lucas");
    expect(nomeDoHost("x".repeat(100))).toHaveLength(24);
  });

  it("sem nome, usa um padrão", () => {
    expect(nomeDoHost(null)).toBe("Sala sem nome");
  });
});

describe("novoHost", () => {
  const pedido = (id: unknown) => JSON.stringify({ tipo: "transferirHost", id, expulsos: [] });
  const ids = [1, 2, 3];

  it("o host atual passa a sala para quem está nela", () => {
    expect(novoHost(1, 1, pedido(2), ids)).toBe(2);
  });

  it("convidado não se promove, e não vale passar para quem não está na sala", () => {
    expect(novoHost(2, 1, pedido(2), ids)).toBeNull();
    expect(novoHost(1, 1, pedido(9), ids)).toBeNull();
    expect(novoHost(1, 1, pedido("2"), ids)).toBeNull();
  });

  it("outras mensagens não mudam o host", () => {
    expect(novoHost(1, 1, '{"tipo":"oi"}', ids)).toBeNull();
    expect(novoHost(1, 1, "lixo", ids)).toBeNull();
  });
});

describe("expulsoPeloHost", () => {
  const expulsar = (id: unknown) => JSON.stringify({ tipo: "expulsar", id });

  it("o host atual expulsa quem está na sala, e o relay derruba a conexão", () => {
    expect(expulsoPeloHost(1, 1, expulsar(3), [1, 2, 3])).toBe(3);
    // Depois de passar a liderança, quem expulsa é o host novo.
    expect(expulsoPeloHost(2, 2, expulsar(1), [1, 2])).toBe(1);
  });

  it("convidado não expulsa, ninguém expulsa o host nem quem não está", () => {
    expect(expulsoPeloHost(2, 1, expulsar(3), [1, 2, 3])).toBeNull();
    expect(expulsoPeloHost(1, 1, expulsar(1), [1, 2])).toBeNull();
    expect(expulsoPeloHost(1, 1, expulsar(9), [1, 2])).toBeNull();
    expect(expulsoPeloHost(1, 1, expulsar("2"), [1, 2])).toBeNull();
    expect(expulsoPeloHost(1, 1, "lixo", [1, 2])).toBeNull();
  });
});

describe("salaPublica", () => {
  it("aparece na lista a não ser que o host peça sala privada", () => {
    expect(salaPublica(null)).toBe(true);
    expect(salaPublica("1")).toBe(true);
    expect(salaPublica("0")).toBe(false);
  });
});
