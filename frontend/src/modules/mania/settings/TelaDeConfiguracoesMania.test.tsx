import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CONFIGURACOES_PADRAO_DO_MANIA, type ConfiguracoesDoMania } from "./configuracoesMania";
import { TelaDeConfiguracoesMania } from "./TelaDeConfiguracoesMania";

function Tela({ aoMudar, aoVoltar = () => {} }: { aoMudar: (o: ConfiguracoesDoMania) => void; aoVoltar?: () => void }) {
  const [opcoes, setOpcoes] = useState(CONFIGURACOES_PADRAO_DO_MANIA);
  return (
    <TelaDeConfiguracoesMania
      aoVoltar={aoVoltar}
      opcoes={opcoes}
      aoMudar={(novas) => {
        setOpcoes(novas);
        aoMudar(novas);
      }}
    />
  );
}

it("é uma tela própria, com as abas do Rock e o botão de voltar", async () => {
  const aoVoltar = vi.fn();
  render(<Tela aoMudar={vi.fn()} aoVoltar={aoVoltar} />);
  expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Áudio/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(aoVoltar).toHaveBeenCalledOnce();
});

it("muda a rolagem e o atraso no gameplay", async () => {
  const aoMudar = vi.fn();
  render(<Tela aoMudar={aoMudar} />);
  await userEvent.click(screen.getByRole("tab", { name: /Gameplay/ }));
  fireEvent.keyDown(screen.getByRole("slider", { name: /Velocidade de rolagem/ }), { key: "ArrowRight" });
  expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ rolagemMs: CONFIGURACOES_PADRAO_DO_MANIA.rolagemMs + 50 }));
  fireEvent.keyDown(screen.getByRole("slider", { name: /Atraso do áudio/ }), { key: "ArrowLeft" });
  expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ atrasoMs: -5 }));
});

it("troca a tecla de uma coluna apertando a nova, e volta ao padrão", async () => {
  const aoMudar = vi.fn();
  render(<Tela aoMudar={aoMudar} />);
  await userEvent.click(screen.getByRole("button", { name: /Coluna 1: D/ }));
  expect(screen.getByRole("button", { name: "Coluna 1: aperte uma tecla" })).toBeInTheDocument();
  fireEvent.keyDown(window, { code: "KeyQ" });
  expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ teclasPersonalizadas: { 4: ["KeyQ", "KeyF", "KeyJ", "KeyK"] } }));
  await userEvent.click(screen.getByRole("button", { name: "Voltar ao padrão de 4K" }));
  expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ teclasPersonalizadas: {} }));
});

it("Esc enquanto espera a tecla só cancela; sem esperar, volta", async () => {
  const aoVoltar = vi.fn();
  render(<Tela aoMudar={vi.fn()} aoVoltar={aoVoltar} />);
  await userEvent.click(screen.getByRole("button", { name: /Coluna 1: D/ }));
  fireEvent.keyDown(window, { code: "Escape", key: "Escape" });
  expect(aoVoltar).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { code: "Escape", key: "Escape" });
  expect(aoVoltar).toHaveBeenCalledOnce();
});

it("mostra as teclas de cada K", async () => {
  render(<Tela aoMudar={vi.fn()} />);
  await userEvent.click(screen.getByRole("radio", { name: "7K" }));
  expect(screen.getAllByRole("button", { name: /^Coluna \d/ })).toHaveLength(7);
});
