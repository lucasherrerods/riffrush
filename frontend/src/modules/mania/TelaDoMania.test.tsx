import { render, screen } from "@testing-library/react";
import { TelaDoMania } from "./TelaDoMania";

it("mostra o nome do Riff Rush Mania", () => {
  render(<TelaDoMania />);
  expect(screen.getByRole("heading", { name: "Riff Rush Mania" })).toBeInTheDocument();
});
