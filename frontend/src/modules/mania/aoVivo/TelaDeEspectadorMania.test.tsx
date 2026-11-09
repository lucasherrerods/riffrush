import { act, render, screen } from "@testing-library/react";
import type { PessoaOnline } from "@/modules/presenca";
import { AudioContextFalso } from "@/test/audioFalso";
import { osu } from "@/test/beatmaps";
import { WebSocketFalso } from "@/test/websocketFalso";
import type { ConjuntoSalvo } from "../beatmaps/biblioteca";
import { TelaDeEspectadorMania } from "./TelaDeEspectadorMania";

vi.stubGlobal("AudioContext", AudioContextFalso);

const HASH = "c".repeat(32);
const ana: PessoaOnline = { id: "conta-ana", nome: "Ana", avatar: null, estado: { tipo: "tocando", musica: `osu:${HASH}`, titulo: "Musica", artista: "Banda", dificuldade: "Hard", instrumento: "4K", transmitindo: true, modo: "mania" } };
const conjunto = { id: "osu:1", origem: "osu", titulo: "Musica", artista: "Banda", mapas: [{ hash: HASH, dificuldade: "Hard", teclas: 4 }] } as unknown as ConjuntoSalvo;
const criarSocket = (url: string) => new WebSocketFalso(url);
const partida = { musica: `osu:${HASH}`, dificuldade: "Hard", instrumento: "4K", hashDoChart: HASH, semFalha: false, velocidade: 1, modo: "mania", mods: 0, semente: 7 };

function abrir(conjuntos: ConjuntoSalvo[] = [conjunto]) {
  const carregarMapa = vi.fn(async () => ({ titulo: "Musica", dificuldade: "Hard", texto: osu(), hash: HASH, audio: new Uint8Array([1]) }));
  render(
    <TelaDeEspectadorMania
      pessoa={ana}
      conjuntos={conjuntos}
      carregarMapa={carregarMapa}
      aoSair={vi.fn()}
      aoBuscarMapas={vi.fn()}
      decodificar={async () => ({}) as AudioBuffer}
      urlDoRelay="wss://relay"
      criarSocket={criarSocket}
    />,
  );
  return { socket: WebSocketFalso.ultimo!, carregarMapa };
}

it("com o início e o primeiro lote, monta o mesmo mapa ao vivo", async () => {
  const { socket, carregarMapa } = abrir();
  expect(socket.url).toBe("wss://relay/transmissao/conta-ana");
  act(() => socket.entregar({ tipo: "inicio", partida }));
  act(() => socket.entregar({ tipo: "lote", ate: 3, entradas: [[1000, 1]] }));
  expect(await screen.findByText("AO VIVO · Ana")).toBeInTheDocument();
  expect(carregarMapa).toHaveBeenCalledWith(conjunto, conjunto.mapas[0]);
});

it("mapa que eu não tenho, ou partida do Rock: avisa em vez de tocar", () => {
  const { socket } = abrir([]);
  act(() => socket.entregar({ tipo: "inicio", partida }));
  expect(screen.getByText(/precisa ter o mapa/)).toBeInTheDocument();
});

it("sem partida no ar, avisa", () => {
  const { socket } = abrir();
  act(() => socket.entregar({ tipo: "semPartida" }));
  expect(screen.getByText("Ana não está transmitindo uma partida agora.")).toBeInTheDocument();
});
