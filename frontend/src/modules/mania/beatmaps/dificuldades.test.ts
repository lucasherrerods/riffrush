import { faixaDasEstrelas } from "./dificuldades";

it.each([
  [0, "Easy"],
  [1.99, "Easy"],
  [2, "Normal"],
  [2.69, "Normal"],
  [2.7, "Hard"],
  [4, "Insane"],
  [5.3, "Expert"],
  [6.49, "Expert"],
  [6.5, "Expert+"],
  [12, "Expert+"],
])("%s estrelas é %s", (estrelas, faixa) => {
  expect(faixaDasEstrelas(estrelas)).toBe(faixa);
});
