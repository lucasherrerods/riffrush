import { carregarHighways, salvarHighways } from "./armazenamento";
import { SKIN_PADRAO } from "./skins";

beforeEach(() => localStorage.clear());

it("guarda e lê as highways importadas", () => {
  const skin = { ...SKIN_PADRAO, id: "highway:a", nome: "A", highway: "data:image/jpeg;base64,..." };
  salvarHighways([skin]);
  expect(carregarHighways()).toEqual([skin]);
});

it("ignora o que estiver corrompido", () => {
  localStorage.setItem("riffrush.highways", "{nao é json");
  expect(carregarHighways()).toEqual([]);
  localStorage.setItem("riffrush.highways", JSON.stringify([{ id: "x" }, { ...SKIN_PADRAO, id: "highway:b", nome: "B", highway: "data:..." }]));
  expect(carregarHighways().map((s) => s.id)).toEqual(["highway:b"]);
});

it("devolve a mesma lista enquanto nada muda, para a partida não reiniciar", () => {
  salvarHighways([{ ...SKIN_PADRAO, id: "highway:a", nome: "A", highway: "data:..." }]);
  expect(carregarHighways()).toBe(carregarHighways());
});
