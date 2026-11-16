import type { Atividade, EventoDaAtividade } from "./api";
import { descreverAtividade, horaDaAtividade, juntarSemRepetir } from "./descrever";

const rock: EventoDaAtividade = { tipo: "partida_do_rock", musica_id: "abc", titulo: "Música", artista: "Banda", instrumento: "baixo", dificuldade: "expert", precisao: 0.9734, derrota: false };
const mania: EventoDaAtividade = { tipo: "partida_do_mania", beatmap_id: 10, beatmapset_id: 7, titulo: "Mapa", artista: "Artista", dificuldade: "Hard", precisao: 0.95, derrota: true };

const atividade = (evento: EventoDaAtividade, quando = "2026-11-12T14:05:00Z", conta_id = "a"): Atividade => ({ conta_id, nome: "Ana", avatar: null, quando, evento });

describe("descreverAtividade", () => {
  it("partida do Rock: música, banda, instrumento, dificuldade e precisão", () => {
    expect(descreverAtividade(rock)).toEqual({ modo: "rock", acao: "jogou", oQue: "Música — Banda", detalhe: "Baixo · Expert · 97,34%" });
  });

  it("partida do Mania: mapa, dificuldade e precisão, e avisa quando falhou", () => {
    expect(descreverAtividade(mania)).toEqual({ modo: "mania", acao: "falhou em", oQue: "Mapa — Artista", detalhe: "Hard · 95,00%" });
  });

  it("sem o nome na API, usa o nome local e, sem ele, um genérico", () => {
    const semNome = { ...rock, titulo: null, artista: null, precisao: null };
    expect(descreverAtividade(semNome, { tituloDaMusica: () => "Da biblioteca" }).oQue).toBe("Da biblioteca");
    expect(descreverAtividade(semNome).oQue).toBe("uma música");
    expect(descreverAtividade(semNome).detalhe).toBe("Baixo · Expert");
    expect(descreverAtividade({ ...mania, titulo: null, artista: null, dificuldade: null }).oQue).toBe("o mapa 10");
  });

  it("conta nova", () => {
    expect(descreverAtividade({ tipo: "conta_nova" })).toEqual({ acao: "entrou no Riff Rush" });
  });
});

describe("horaDaAtividade", () => {
  it("hoje só a hora; outro dia, com a data", () => {
    const agora = new Date(2026, 10, 12, 18, 0);
    expect(horaDaAtividade(new Date(2026, 10, 12, 9, 5).toISOString(), agora)).toBe("09:05");
    expect(horaDaAtividade(new Date(2026, 10, 10, 22, 30).toISOString(), agora)).toBe("10/11 22:30");
  });
});

describe("juntarSemRepetir", () => {
  it("põe as novas no topo sem repetir as que já estavam", () => {
    const velha = atividade(rock, "2026-11-12T14:00:00Z");
    const nova = atividade(mania, "2026-11-12T15:00:00Z");
    expect(juntarSemRepetir([nova, velha], [velha])).toEqual([nova, velha]);
  });
});
