import { render } from "@testing-library/react";
import { EVENTOS } from "./calendario";
import { DecoracaoDoEvento } from "./DecoracaoDoEvento";

const natal = EVENTOS.find((evento) => evento.id === "natal")!;

it("sem evento não desenha nada", () => {
  const { container } = render(<DecoracaoDoEvento />);
  expect(container).toBeEmptyDOMElement();
});

it("no Natal cai neve e o varal de luzes fica no topo, sem bloquear cliques", () => {
  const { container } = render(<DecoracaoDoEvento evento={natal} />);
  const camada = container.firstElementChild as HTMLElement;
  expect(camada).toHaveAttribute("aria-hidden", "true");
  expect(camada.className).toContain("pointer-events-none");
  expect(container.querySelectorAll("[data-floco]").length).toBeGreaterThan(0);
  expect(container.querySelectorAll("[data-luz]").length).toBeGreaterThan(0);
});

it("o Natal pendura varais nas laterais também, para enfeitar os cantos", () => {
  const { container } = render(<DecoracaoDoEvento evento={natal} />);
  expect(container.querySelectorAll("[data-varal]").length).toBeGreaterThanOrEqual(3);
});
