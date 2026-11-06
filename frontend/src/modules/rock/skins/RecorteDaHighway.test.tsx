import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecorteDaHighway } from "./RecorteDaHighway";

const imagem = { nome: "foto.jpg", url: "blob:foto", largura: 1920, altura: 1080, fonte: {} as CanvasImageSource };

it("começa com o maior recorte no meio e usa ele", async () => {
  const aoUsar = vi.fn();
  render(<RecorteDaHighway imagem={imagem} aoUsar={aoUsar} aoCancelar={() => {}} />);
  expect(screen.getByRole("dialog", { name: "Recortar a imagem da pista" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Usar este recorte" }));
  expect(aoUsar).toHaveBeenCalledWith({ x: 690, y: 0, largura: 540, altura: 1080 });
});

it("as setas movem o recorte", async () => {
  const aoUsar = vi.fn();
  render(<RecorteDaHighway imagem={imagem} aoUsar={aoUsar} aoCancelar={() => {}} />);
  fireEvent.keyDown(screen.getByLabelText("Área do recorte"), { key: "ArrowLeft" });
  await userEvent.click(screen.getByRole("button", { name: "Usar este recorte" }));
  expect(aoUsar.mock.calls[0][0].x).toBeLessThan(690);
});

it("cancelar fecha sem recortar", async () => {
  const aoCancelar = vi.fn();
  const aoUsar = vi.fn();
  render(<RecorteDaHighway imagem={imagem} aoUsar={aoUsar} aoCancelar={aoCancelar} />);
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(aoCancelar).toHaveBeenCalled();
  expect(aoUsar).not.toHaveBeenCalled();
});
