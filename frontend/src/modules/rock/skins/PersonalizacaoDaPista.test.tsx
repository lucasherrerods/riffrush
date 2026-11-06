import { render, screen, waitFor } from "@testing-library/react";
import { abrirLink } from "@/modules/platform";
import userEvent from "@testing-library/user-event";
import { carregarHighways } from "./armazenamento";
import { PersonalizacaoDaPista } from "./PersonalizacaoDaPista";
import { SKIN_PADRAO, type SkinDaPista } from "./skins";

vi.mock("@/modules/platform", async (original) => ({ ...(await original<object>()), abrirLink: vi.fn() }));

beforeEach(() => localStorage.clear());

const importada: SkinDaPista = { ...SKIN_PADRAO, id: "highway:a", nome: "Madeira", highway: "data:image/jpeg;base64,..." };

const aberta = { nome: "Madeira.png", url: "blob:madeira", largura: 1920, altura: 1080, fonte: {} as CanvasImageSource };

function abrir(escolhida = "classica", abrirImagem = vi.fn(async () => aberta)) {
  const aoEscolher = vi.fn();
  const recortar = vi.fn(async () => importada);
  render(<PersonalizacaoDaPista escolhida={escolhida} aoEscolher={aoEscolher} abrir={abrirImagem} recortar={recortar} />);
  return { aoEscolher, recortar, usuario: userEvent.setup({ applyAccept: false }) };
}

it("mostra as skins prontas e marca a escolhida", () => {
  abrir("neon");
  expect(screen.getByRole("radio", { name: "Clássica" })).toHaveAttribute("aria-checked", "false");
  expect(screen.getByRole("radio", { name: "Neon" })).toHaveAttribute("aria-checked", "true");
});

it("escolher uma skin avisa quem salva as configurações", async () => {
  const { aoEscolher, usuario } = abrir();
  await usuario.click(screen.getByRole("radio", { name: "Brasa" }));
  expect(aoEscolher).toHaveBeenCalledWith("brasa");
});

it("importar qualquer imagem abre o recorte, e o pedaço escolhido vira a highway", async () => {
  const { aoEscolher, recortar, usuario } = abrir();
  await usuario.upload(screen.getByLabelText("Importar imagem"), new File(["x"], "Madeira.png", { type: "image/png" }));
  await usuario.click(await screen.findByRole("button", { name: "Usar este recorte" }));
  expect(recortar).toHaveBeenCalledWith(aberta, { x: 690, y: 0, largura: 540, altura: 1080 });
  await waitFor(() => expect(aoEscolher).toHaveBeenCalledWith("highway:a"));
  expect(screen.getByRole("radio", { name: "Madeira" })).toBeInTheDocument();
  expect(carregarHighways().map((s) => s.id)).toEqual(["highway:a"]);
});

it("um arquivo que não serve mostra o erro", async () => {
  const abrirImagem = vi.fn(async () => {
    throw new Error("A highway precisa ser uma imagem PNG ou JPG.");
  });
  const { aoEscolher, usuario } = abrir("classica", abrirImagem);
  await usuario.upload(screen.getByLabelText("Importar imagem"), new File(["x"], "anim.webm", { type: "video/webm" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("PNG ou JPG");
  expect(aoEscolher).not.toHaveBeenCalled();
});

it("apagar a highway escolhida volta para a clássica", async () => {
  localStorage.setItem("riffrush.highways", JSON.stringify([importada]));
  const { aoEscolher, usuario } = abrir("highway:a");
  await usuario.click(screen.getByRole("button", { name: "Apagar Madeira" }));
  expect(screen.queryByRole("radio", { name: "Madeira" })).not.toBeInTheDocument();
  expect(aoEscolher).toHaveBeenCalledWith("classica");
});

it("cancelar o recorte não importa nada", async () => {
  const { aoEscolher, recortar, usuario } = abrir();
  await usuario.upload(screen.getByLabelText("Importar imagem"), new File(["x"], "Madeira.png", { type: "image/png" }));
  await usuario.click(await screen.findByRole("button", { name: "Cancelar" }));
  expect(recortar).not.toHaveBeenCalled();
  expect(aoEscolher).not.toHaveBeenCalled();
});

it("explica o formato da imagem e leva ao site de highways prontas", async () => {
  const { usuario } = abrir();
  await usuario.click(screen.getByText("Como deve ser a imagem"));
  expect(screen.getByText(/512x1024/)).toBeVisible();
  await usuario.click(screen.getByRole("button", { name: /Baixar highways prontas/ }));
  expect(abrirLink).toHaveBeenCalledWith("https://www.fullcombo.net/clone-hero/clone-hero-highways/");
});
