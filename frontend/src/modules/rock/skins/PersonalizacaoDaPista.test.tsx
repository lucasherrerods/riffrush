import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { carregarHighways } from "./armazenamento";
import { PersonalizacaoDaPista } from "./PersonalizacaoDaPista";
import { SKIN_PADRAO, type SkinDaPista } from "./skins";

beforeEach(() => localStorage.clear());

const importada: SkinDaPista = { ...SKIN_PADRAO, id: "highway:a", nome: "Madeira", highway: "data:image/jpeg;base64,..." };

function abrir(escolhida = "classica", ler = vi.fn(async () => importada)) {
  const aoEscolher = vi.fn();
  render(<PersonalizacaoDaPista escolhida={escolhida} aoEscolher={aoEscolher} ler={ler} />);
  return { aoEscolher, ler, usuario: userEvent.setup({ applyAccept: false }) };
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

it("importar uma highway do Clone Hero guarda e já escolhe ela", async () => {
  const { aoEscolher, usuario } = abrir();
  await usuario.upload(screen.getByLabelText("Importar highway"), new File(["x"], "Madeira.png", { type: "image/png" }));
  await waitFor(() => expect(aoEscolher).toHaveBeenCalledWith("highway:a"));
  expect(screen.getByRole("radio", { name: "Madeira" })).toBeInTheDocument();
  expect(carregarHighways().map((s) => s.id)).toEqual(["highway:a"]);
});

it("um arquivo que não serve mostra o erro", async () => {
  const ler = vi.fn(async () => {
    throw new Error("A highway precisa ser uma imagem PNG ou JPG.");
  });
  const { aoEscolher, usuario } = abrir("classica", ler);
  await usuario.upload(screen.getByLabelText("Importar highway"), new File(["x"], "anim.webm", { type: "video/webm" }));
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
