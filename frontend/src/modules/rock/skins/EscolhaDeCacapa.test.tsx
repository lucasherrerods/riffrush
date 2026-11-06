import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EscolhaDeCacapa } from "./EscolhaDeCacapa";

it("mostra as caçapas prontas, marca a escolhida e avisa a troca", async () => {
  const aoEscolher = vi.fn();
  render(<EscolhaDeCacapa escolhida="colmeia" aoEscolher={aoEscolher} />);
  expect(screen.getByRole("radio", { name: "Colmeia" })).toHaveAttribute("aria-checked", "true");
  await userEvent.click(screen.getByRole("radio", { name: "Neon quadrada" }));
  expect(aoEscolher).toHaveBeenCalledWith("neon");
});

it("a miniatura mostra o formato das caçapas", () => {
  render(<EscolhaDeCacapa escolhida="classica" aoEscolher={() => {}} />);
  expect(screen.getByRole("radio", { name: "Colmeia" }).querySelector("[data-formato]")).toHaveAttribute("data-formato", "hexagonal");
});
