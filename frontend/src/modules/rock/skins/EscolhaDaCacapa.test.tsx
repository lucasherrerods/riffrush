import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EscolhaDasCores, EscolhaDoFormato } from "./EscolhaDaCacapa";

const valores = { formatoDaCacapa: "redonda" as const, coresDaCacapa: "classica", brilhoDaCacapa: 1, contornoForte: false };

it("escolhe o formato, e a miniatura mostra cada um nas cores escolhidas", async () => {
  const aoMudar = vi.fn();
  render(<EscolhaDoFormato {...valores} aoMudar={aoMudar} />);
  expect(screen.getByRole("radio", { name: "Redonda" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("radio", { name: "Hexagonal" }).querySelector("[data-formato]")).toHaveAttribute("data-formato", "hexagonal");
  await userEvent.click(screen.getByRole("radio", { name: "Hexagonal" }));
  expect(aoMudar).toHaveBeenCalledWith({ formatoDaCacapa: "hexagonal" });
});

it("escolhe o esquema de cores, e a miniatura mantém o formato escolhido", async () => {
  const aoMudar = vi.fn();
  render(<EscolhaDasCores {...valores} formatoDaCacapa="retangular" aoMudar={aoMudar} />);
  expect(screen.getByRole("radio", { name: "Neon" }).querySelector("[data-formato]")).toHaveAttribute("data-formato", "retangular");
  await userEvent.click(screen.getByRole("radio", { name: "Tritanopia" }));
  expect(aoMudar).toHaveBeenCalledWith({ coresDaCacapa: "tritanopia" });
});

it("marca os esquemas para daltonismo", () => {
  render(<EscolhaDasCores {...valores} aoMudar={() => {}} />);
  expect(screen.getAllByText("Daltonismo").length).toBeGreaterThanOrEqual(2);
});

it("liga o contorno forte", async () => {
  const aoMudar = vi.fn();
  render(<EscolhaDasCores {...valores} aoMudar={aoMudar} />);
  await userEvent.click(screen.getByRole("switch", { name: "Contorno forte nas notas" }));
  expect(aoMudar).toHaveBeenCalledWith({ contornoForte: true });
});

it("tem o controle do brilho", () => {
  render(<EscolhaDasCores {...valores} brilhoDaCacapa={0.4} aoMudar={() => {}} />);
  expect(screen.getByRole("slider", { name: "Brilho das notas" })).toHaveAttribute("aria-valuenow", "40");
});
