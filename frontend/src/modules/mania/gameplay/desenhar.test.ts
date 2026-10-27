import { ESPERANDO, SEGURANDO, TERMINADA, aplicarEventos } from "./desenhar";

it("os eventos do motor viram o estado das notas e o último julgamento", () => {
  // Nota 0 simples, nota 1 longa.
  const notas = [0, 1000, -1, 1, 1200, 2000];
  const estados = new Uint8Array(2);
  expect(aplicarEventos(estados, notas, [])).toBeUndefined();
  expect([...estados]).toEqual([ESPERANDO, ESPERANDO]);
  // MAX na nota 0 e 300 na cabeça da nota 1.
  expect(aplicarEventos(estados, notas, [0, 0, 0, 0, 3, 1, 1, 1, 0, 10])).toBe(1);
  expect([...estados]).toEqual([TERMINADA, SEGURANDO]);
  // A ponta da nota 1.
  aplicarEventos(estados, notas, [1, 1, 2, 1, 40]);
  expect(estados[1]).toBe(TERMINADA);
});

it("a cabeça perdida de uma nota longa termina a nota", () => {
  const estados = new Uint8Array(1);
  aplicarEventos(estados, [0, 1000, 2000], [0, 0, 5, 0, NaN]);
  expect(estados[0]).toBe(TERMINADA);
});
