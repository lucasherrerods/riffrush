import { PROTOCOLO_DO_JOGO, avisoDeEspectadores, fichaDoPedido, lerComandoDaPresenca, lerEstado, lerMensagemDaTransmissao, linkDoChartConfere, verificarFicha } from "./presenca";

// A mesma ficha do teste da API (backend/src/modules/presenca/dominio.rs): os dois lados precisam concordar.
const FICHA_COM_NIVEL =
  "eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwNyIsIm5vbWUiOiJMdWNhcyIsImF2YXRhciI6bnVsbCwibml2ZWwiOjMsImV4cCI6MTkwMDAwMDAwMH0.GcC-2VOsr_or75WtX3gQNBTBIKzZyYE3vwmey0C-eJY";
const FICHA_COMPLETA =
  "eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwNyIsIm5vbWUiOiJMdWNhcyIsImF2YXRhciI6bnVsbCwibml2ZWwiOjMsImFkbWluIjpmYWxzZSwiYmFuaWRvIjpmYWxzZSwiZXhwIjoxOTAwMDAwMDAwfQ.9401CmmfteL1hrpnUWwo073vskes2uCyA8VskxNS7Ls";
// Fichas de versões antigas da API, sem nível ou sem moderação/banido: continuam valendo, com nível 0 e sem poderes.
const FICHA =
  "eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwNyIsIm5vbWUiOiJMdWNhcyIsImF2YXRhciI6bnVsbCwiZXhwIjoxOTAwMDAwMDAwfQ.g3x_8V8_Mc8fiEU3TwanHW2LnkX5ipNmEHy9XUb6HhA";
const SEGREDO = "segredo-de-teste";

describe("verificarFicha", () => {
  it("aceita a ficha assinada pela API e devolve quem é", async () => {
    expect(await verificarFicha(FICHA_COMPLETA, SEGREDO, 1_800_000_000)).toEqual({ id: "00000000-0000-0000-0000-000000000007", nome: "Lucas", avatar: null, nivel: 3, admin: false, banido: false });
    expect(await verificarFicha(FICHA_COM_NIVEL, SEGREDO, 1_800_000_000)).toMatchObject({ nivel: 3, admin: false, banido: false });
  });

  it("ficha antiga, sem nível, vale como nível 0", async () => {
    expect((await verificarFicha(FICHA, SEGREDO, 1_800_000_000))?.nivel).toBe(0);
  });

  it("recusa ficha vencida, com outro segredo ou adulterada", async () => {
    expect(await verificarFicha(FICHA, SEGREDO, 1_900_000_001)).toBeNull();
    expect(await verificarFicha(FICHA, "outro", 1_800_000_000)).toBeNull();
    expect(await verificarFicha(FICHA.replace("eyJpZCI6", "eyJpZCI7"), SEGREDO, 1_800_000_000)).toBeNull();
    expect(await verificarFicha("lixo", SEGREDO, 1_800_000_000)).toBeNull();
    expect(await verificarFicha(FICHA, "", 1_800_000_000)).toBeNull();
  });
});

describe("lerEstado", () => {
  it("aceita o menu e a música que está tocando", () => {
    expect(lerEstado({ tipo: "menu" })).toEqual({ tipo: "menu" });
    const tocando = { tipo: "tocando", musica: "encore:abc", titulo: "Paint It Black", artista: "The Rolling Stones", dificuldade: "expert", instrumento: "guitarra", transmitindo: true };
    expect(lerEstado(tocando)).toEqual(tocando);
  });

  it("corta textos longos e recusa formatos estranhos", () => {
    const longo = lerEstado({ tipo: "tocando", musica: "x", titulo: "a".repeat(500), artista: "b", dificuldade: "facil", instrumento: "baixo", transmitindo: false });
    expect(longo?.tipo === "tocando" && longo.titulo.length).toBe(80);
    expect(lerEstado({ tipo: "hackeando" })).toBeNull();
    expect(lerEstado(null)).toBeNull();
    expect(lerEstado({ tipo: "tocando", musica: 3 })).toBeNull();
  });
});

describe("lerComandoDaPresenca", () => {
  const amiga = "00000000-0000-0000-0000-000000000007";

  it("lê o estado das versões antigas e os novos da seleção e do multiplayer", () => {
    expect(lerComandoDaPresenca(JSON.stringify({ estado: { tipo: "menu" } }))).toEqual({ tipo: "estado", estado: { tipo: "menu" } });
    expect(lerComandoDaPresenca(JSON.stringify({ estado: { tipo: "selecao" } }))).toEqual({ tipo: "estado", estado: { tipo: "selecao" } });
    expect(lerComandoDaPresenca(JSON.stringify({ estado: { tipo: "multiplayer", codigo: "ABCD" } }))).toEqual({ tipo: "estado", estado: { tipo: "multiplayer" } });
  });

  it("lê o convite com conta e sala válidas", () => {
    expect(lerComandoDaPresenca(JSON.stringify({ tipo: "convite", para: amiga, codigo: "ABCDE" }))).toEqual({ tipo: "convite", para: amiga, codigo: "ABCDE" });
    expect(lerComandoDaPresenca(JSON.stringify({ tipo: "convite", para: "../x", codigo: "ABCDE" }))).toBeNull();
    expect(lerComandoDaPresenca(JSON.stringify({ tipo: "convite", para: amiga, codigo: "nao vale" }))).toBeNull();
    expect(lerComandoDaPresenca("{quebrado")).toBeNull();
  });
});

describe("lerMensagemDaTransmissao", () => {
  it("aceita o início, os lotes de entradas, a pausa e o fim", () => {
    expect(lerMensagemDaTransmissao('{"tipo":"lote","ate":12.5,"entradas":[[12001,0],[12100,5]]}')).toEqual({ tipo: "lote", ate: 12.5, entradas: [[12001, 0], [12100, 5]] });
    expect(lerMensagemDaTransmissao('{"tipo":"pausa","pausado":true}')).toEqual({ tipo: "pausa", pausado: true });
    expect(lerMensagemDaTransmissao('{"tipo":"fim"}')).toEqual({ tipo: "fim" });
    const inicio = { tipo: "inicio", partida: { musica: "encore:abc", dificuldade: "expert", instrumento: "guitarra", hashDoChart: "a".repeat(32), semFalha: false, velocidade: 1.25 } };
    expect(lerMensagemDaTransmissao(JSON.stringify(inicio))).toEqual(inicio);
  });

  it("velocidade que o jogo não oferece, ou de app antigo que não manda, vira a normal", () => {
    const partida = { musica: "encore:abc", dificuldade: "expert", instrumento: "guitarra", hashDoChart: "a".repeat(32), semFalha: false };
    const velocidadeLida = (extra: object) => {
      const lida = lerMensagemDaTransmissao(JSON.stringify({ tipo: "inicio", partida: { ...partida, ...extra } }));
      return lida?.tipo === "inicio" ? lida.partida.velocidade : null;
    };
    expect(velocidadeLida({ velocidade: 3 })).toBe(1);
    expect(velocidadeLida({ velocidade: "1.5" })).toBe(1);
    expect(velocidadeLida({})).toBe(1);
    expect(velocidadeLida({ velocidade: 0.5 })).toBe(0.5);
  });

  it("recusa lotes com entradas inválidas, mensagens grandes e JSON quebrado", () => {
    expect(lerMensagemDaTransmissao('{"tipo":"lote","ate":1,"entradas":[[1,13]]}')).toBeNull();
    expect(lerMensagemDaTransmissao('{"tipo":"lote","ate":1,"entradas":[["x",0]]}')).toBeNull();
    expect(lerMensagemDaTransmissao(`{"tipo":"lote","ate":1,"entradas":[${"[1,0],".repeat(2000)}[1,0]]}`)).toBeNull();
    expect(lerMensagemDaTransmissao("{quebrado")).toBeNull();
  });
});

describe("link do chart", () => {
  const md5 = "0123456789abcdef0123456789abcdef";
  const musica = `encore:${md5}`;

  it("aceita os caminhos de chart do Encore da mesma música", () => {
    expect(linkDoChartConfere(`https://files.enchor.us/${md5}.sng`, musica)).toBe(true);
    expect(linkDoChartConfere(`https://files.enchor.us/charts/v2/${md5}_novideo.sng`, musica)).toBe(true);
  });

  it("recusa outro site, outro caminho, outra música e truques na URL", () => {
    const outra = "f".repeat(32);
    for (const url of [
      `https://evil.com/${md5}.sng`,
      `http://files.enchor.us/${md5}.sng`,
      `https://files.enchor.us.evil.com/${md5}.sng`,
      `https://files.enchor.us@evil.com/${md5}.sng`,
      `https://files.enchor.us/../${md5}.sng`,
      `https://files.enchor.us/${md5}.sng?x=1`,
      `https://files.enchor.us/${md5}.exe`,
      `https://files.enchor.us/${outra}.sng`,
      `javascript:alert(1)`,
    ]) {
      expect(linkDoChartConfere(url, musica), url).toBe(false);
    }
    expect(linkDoChartConfere(`https://files.enchor.us/${md5}.sng`, "embutida:neon")).toBe(false);
  });

  it("o início leva o link só quando ele confere, sem derrubar a mensagem", () => {
    const inicio = (urlDoEncore: string) =>
      lerMensagemDaTransmissao(JSON.stringify({ tipo: "inicio", partida: { musica, dificuldade: "expert", instrumento: "guitarra", hashDoChart: "a".repeat(32), urlDoEncore } }));
    expect(inicio(`https://files.enchor.us/${md5}.sng`)).toMatchObject({ partida: { urlDoEncore: `https://files.enchor.us/${md5}.sng` } });
    const ruim = inicio("https://evil.com/x.sng");
    expect(ruim?.tipo).toBe("inicio");
    expect(ruim?.tipo === "inicio" && ruim.partida.urlDoEncore).toBeUndefined();
  });
});

describe("avisoDeEspectadores", () => {
  it("diz a quem joga quantas pessoas estão assistindo", () => {
    expect(JSON.parse(avisoDeEspectadores(3))).toEqual({ tipo: "espectadores", quantos: 3 });
  });
});

describe("fichaDoPedido", () => {
  const pedido = (url: string, protocolos?: string) =>
    new Request(url, { headers: protocolos ? { "Sec-WebSocket-Protocol": protocolos } : {} });

  it("lê a ficha do subprotocolo do WebSocket, que não fica em log de URL", () => {
    expect(fichaDoPedido(pedido("https://r/chat", `${PROTOCOLO_DO_JOGO}, abc.def`))).toEqual({ ficha: "abc.def", peloProtocolo: true });
  });

  it("aceita ainda a ficha na URL, das versões antigas do app", () => {
    expect(fichaDoPedido(pedido("https://r/chat?ficha=abc.def"))).toEqual({ ficha: "abc.def", peloProtocolo: false });
  });

  it("sem ficha, devolve vazio", () => {
    expect(fichaDoPedido(pedido("https://r/chat"))).toEqual({ ficha: "", peloProtocolo: false });
  });
});
