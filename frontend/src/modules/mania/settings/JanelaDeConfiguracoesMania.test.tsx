import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { OPCOES_PADRAO_DO_MANIA, type OpcoesDoMania } from "../gameplay/TelaDeJogoMania";
import { JanelaDeConfiguracoesMania } from "./JanelaDeConfiguracoesMania";

function Janela({ aoMudar }: { aoMudar: (o: OpcoesDoMania) => void }) {
  const [opcoes, setOpcoes] = useState(OPCOES_PADRAO_DO_MANIA);
  return (
    <JanelaDeConfiguracoesMania
      aberta
      aoFechar={() => {}}
      opcoes={opcoes}
      aoMudar={(novas) => {
        setOpcoes(novas);
        aoMudar(novas);
      }}
    />
  );
}

it("muda a rolagem, o atraso e o volume", () => {
  const aoMudar = vi.fn();
  render(<Janela aoMudar={aoMudar} />);
  fireEvent.change(screen.getByLabelText(/Velocidade de rolagem/), { target: { value: "500" } });
  expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ rolagemMs: 500 }));
  fireEvent.change(screen.getByLabelText(/Atraso do áudio/), { target: { value: "-25" } });
  expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ atrasoMs: -25 }));
  fireEvent.change(screen.getByLabelText(/Volume da música/), { target: { value: "40" } });
  expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ volumeDaMusica: 0.4 }));
});

it("troca a tecla de uma coluna apertando a nova, e volta ao padrão", async () => {
  const aoMudar = vi.fn();
  render(<Janela aoMudar={aoMudar} />);
  await userEvent.click(screen.getByRole("button", { name: /Coluna 1: D/ }));
  expect(screen.getByRole("button", { name: "Coluna 1: aperte uma tecla" })).toBeInTheDocument();
  fireEvent.keyDown(window, { code: "KeyQ" });
  expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ teclasPersonalizadas: { 4: ["KeyQ", "KeyF", "KeyJ", "KeyK"] } }));
  await userEvent.click(screen.getByRole("button", { name: "Voltar ao padrão de 4K" }));
  expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ teclasPersonalizadas: {} }));
});

it("mostra as teclas de cada K", async () => {
  render(<Janela aoMudar={vi.fn()} />);
  await userEvent.click(screen.getByRole("radio", { name: "7K" }));
  expect(screen.getAllByRole("button", { name: /^Coluna \d/ })).toHaveLength(7);
});
