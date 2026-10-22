import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("exibe o nome do jogo", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Riff Rush" })).toBeInTheDocument();
  });
});
